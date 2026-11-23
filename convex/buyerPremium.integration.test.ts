/// <reference types="vite/client" />

/**
 * Integration coverage (real in-memory Convex backend) for the single buyer
 * premium rule: settlement and the fee read path charge exactly ONE premium
 * (auction snapshot, active buyer % fee rows, or the platform default), plus
 * the seller VAT snapshot taken at assignment and the fee-fraction migration.
 */

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import { calculateAndRecordFees } from "./auctions/internal";
import { resolveBuyerPremium } from "./lib/buyerPremium";
import schema from "./schema";
import type { Doc, Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

const ADMIN = "user_admin";
const SELLER = "user_seller";
const WINNER = "user_winner";

const createTestContext = () => convexTest(schema, modules);
type TestContext = ReturnType<typeof createTestContext>;

const asAdmin = (t: TestContext) => t.withIdentity({ subject: ADMIN });
const asWinner = (t: TestContext) => t.withIdentity({ subject: WINNER });

/**
 * Seeds the actors' profiles.
 *
 * @param t - The convex-test context.
 * @param sellerProfile - Extra fields for the seller profile.
 */
async function seedProfiles(
  t: TestContext,
  sellerProfile: Partial<Doc<"profiles">> = {}
): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [userId, role] of [
      [ADMIN, "admin"],
      [SELLER, "seller"],
      [WINNER, "buyer"],
    ] as const) {
      await ctx.db.insert("profiles", {
        userId,
        name: userId,
        email: `${userId}@example.com`,
        role,
        isVerified: true,
        kycStatus: "verified",
        createdAt: now,
        updatedAt: now,
        ...(userId === SELLER ? sellerProfile : {}),
      });
    }
  });
}

/**
 * Inserts a platform fee row.
 *
 * @param t - The convex-test context.
 * @param fee - Row fields.
 * @param fee.feeType - Percentage (fraction) or fixed amount.
 * @param fee.value - Fraction (0.05 = 5%) or rand amount.
 * @param fee.appliesTo - Who pays it.
 * @param fee.isActive - Whether settlement applies it.
 * @returns The new fee id.
 */
async function insertFee(
  t: TestContext,
  fee: {
    feeType: "percentage" | "fixed";
    value: number;
    appliesTo: "buyer" | "seller" | "both";
    isActive: boolean;
  }
): Promise<Id<"platformFees">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("platformFees", {
      name: `${fee.appliesTo} ${fee.feeType} fee`,
      feeType: fee.feeType,
      value: fee.value,
      appliesTo: fee.appliesTo,
      isActive: fee.isActive,
      visibleToBuyer: true,
      visibleToSeller: true,
      sortOrder: 1,
      createdAt: 1,
      updatedAt: 1,
    })
  );
}

/**
 * Sets the platform default buyer premium (percent).
 *
 * @param t - The convex-test context.
 * @param pct - Percent (0-100).
 */
async function setPlatformPremium(t: TestContext, pct: number): Promise<void> {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "buyer_premium_pct"))
      .unique();
    if (row) {
      await ctx.db.patch("settings", row._id, { value: pct });
    } else {
      await ctx.db.insert("settings", {
        key: "buyer_premium_pct",
        value: pct,
        updatedAt: 1,
      });
    }
  });
}

/**
 * Inserts a sold lot with the given premium fields.
 *
 * @param t - The convex-test context.
 * @param fields - Lot overrides.
 * @returns The new lot id.
 */
async function insertLot(
  t: TestContext,
  fields: Partial<Doc<"lots">> = {}
): Promise<Id<"lots">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("lots", {
      title: "Tractor",
      make: "M",
      model: "X",
      year: 2020,
      operatingHours: 1,
      location: "Pretoria",
      reservePrice: 100,
      startingPrice: 100,
      currentPrice: 10_000,
      minIncrement: 10,
      sellerId: SELLER,
      winnerId: WINNER,
      status: "sold",
      images: { front: "https://img.test/front.jpg", additional: [] },
      createdAt: 1,
      ...fields,
    })
  );
}

/**
 * Settles fees for a lot and returns the buyer-side outcome.
 *
 * @param t - The convex-test context.
 * @param lotId - The lot.
 * @param price - The sale price.
 * @returns Buyer/seller counter totals and the persisted buyer ledger rows.
 */
async function settle(t: TestContext, lotId: Id<"lots">, price: number) {
  await t.run(async (ctx) => {
    const lot = await ctx.db.get("lots", lotId);
    if (!lot) throw new Error("missing lot");
    await calculateAndRecordFees(ctx, lot, price);
  });
  return await t.run(async (ctx) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "lotFees"))
      .unique();
    const rows = await ctx.db
      .query("lotFees")
      .withIndex("by_lot", (q) => q.eq("lotId", lotId))
      .collect();
    return {
      buyerTotal: counter?.buyerTotal ?? 0,
      sellerTotal: counter?.sellerTotal ?? 0,
      // `platformFees`-backed ledger rows only; the resolved premium and
      // commission rows (source "auction"/"platform") are in `ledger`.
      buyerRows: rows.filter(
        (r) => r.appliedTo === "buyer" && r.feeId !== undefined
      ),
      sellerRows: rows.filter(
        (r) => r.appliedTo === "seller" && r.feeId !== undefined
      ),
      ledger: rows,
    };
  });
}

/**
 * Reads the winner's fee view of a lot.
 *
 * @param t - The convex-test context.
 * @param lotId - The lot.
 * @returns The caller's buyer and seller fee lines.
 */
const winnerFees = (t: TestContext, lotId: Id<"lots">) =>
  asWinner(t).query(api.admin.getLotFeesForUser, { lotId });

describe("settlement charges exactly one buyer premium", () => {
  it("auction snapshot wins over an active buyer % fee row", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "auction",
    });

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(1200);
    expect(result.buyerRows).toHaveLength(0);
  });

  it("legacy lot (snapshot, no premiumSource) is treated as auction-sourced", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await insertLot(t, { resolvedBuyerPremiumPct: 0.1 });

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(1000);
    expect(result.buyerRows).toHaveLength(0);
  });

  it("platform-sourced snapshot yields to active buyer % fee rows", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "platform",
    });

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(500);
    expect(result.buyerRows).toHaveLength(1);
    expect(result.buyerRows[0]?.calculatedAmount).toBe(500);
  });

  it("platform-sourced lot with no active buyer rows uses the platform default read at settlement time", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: false,
    });
    const lotId = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "platform",
    });
    // Changed after the snapshot was taken: settlement reads the live value.
    await setPlatformPremium(t, 8);

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(800);
    expect(result.buyerRows).toHaveLength(0);
  });

  it("legacy lot with no snapshot uses active buyer rows when present", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.03,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await insertLot(t);

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(300);
    expect(result.buyerRows).toHaveLength(1);
  });

  it("legacy lot with no snapshot and no rows falls back to the 12% platform default", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const lotId = await insertLot(t);

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(1200);
    expect(result.buyerRows).toHaveLength(0);
  });

  it("a 'both' percentage row still charges the seller but not the buyer under a snapshot", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.02,
      appliesTo: "both",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "auction",
    });

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(1200);
    expect(result.sellerTotal).toBe(200);
    expect(result.sellerRows).toHaveLength(1);
    expect(result.buyerRows).toHaveLength(0);
  });

  it("a 'both' percentage row is the buyer premium when the fee rows win", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.02,
      appliesTo: "both",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "platform",
    });

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(200);
    expect(result.sellerTotal).toBe(200);
  });

  it("fixed buyer fees stay additive to the snapshot premium", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "fixed",
      value: 50,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "auction",
    });

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(1250);
    expect(result.buyerRows).toHaveLength(1);
  });

  it("fixed buyer fees stay additive to the platform default", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "fixed",
      value: 50,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "platform",
    });

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(1250);
  });

  it("rounds the premium to the cent exactly like fee rows do", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const lotId = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.1235,
      premiumSource: "auction",
    });

    // 1234.57 * 0.1235 = 152.469395 -> 152.47
    const result = await settle(t, lotId, 1234.57);

    expect(result.buyerTotal).toBe(152.47);
  });

  it("is idempotent for persisted fee rows when settlement re-runs", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.03,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await insertLot(t, { premiumSource: "platform" });

    await settle(t, lotId, 10_000);
    const again = await settle(t, lotId, 10_000);

    expect(again.buyerRows).toHaveLength(1);
  });
});

describe("fee rows toggled after assignment", () => {
  /**
   * Seeds profiles, a draft auction and an approved lot, then assigns the lot
   * through the real mutation (so the snapshot is taken by production code).
   *
   * @param t - The convex-test context.
   * @param auctionPremium - The auction's own buyer premium, if any.
   * @returns The assigned lot id.
   */
  async function assign(
    t: TestContext,
    auctionPremium?: number
  ): Promise<Id<"lots">> {
    await seedProfiles(t);
    const auctionId = await t.run(async (ctx) =>
      ctx.db.insert("auctions", {
        title: "Sale",
        status: "draft",
        startTime: Date.now() + 60_000,
        endTime: Date.now() + 600_000,
        defaultBuyerPremiumPct: auctionPremium,
        createdBy: ADMIN,
        createdAt: 1,
        updatedAt: 1,
      })
    );
    const lotId = await insertLot(t, {
      status: "approved",
      winnerId: undefined,
    });
    await asAdmin(t).mutation(
      api.auctions.mutations.assignment.assignLotToAuction,
      { lotId, auctionId }
    );
    return lotId;
  }

  it("auction-sourced lot ignores a buyer % row activated after assignment", async () => {
    const t = createTestContext();
    const lotId = await assign(t, 0.1);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
    });

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(1000);
    expect(result.buyerRows).toHaveLength(0);
  });

  it("platform-sourced lot switches to a buyer % row activated after assignment", async () => {
    const t = createTestContext();
    const lotId = await assign(t);
    const lot = await t.run(async (ctx) => ctx.db.get("lots", lotId));
    expect(lot?.premiumSource).toBe("platform");
    expect(lot?.resolvedBuyerPremiumPct).toBe(0.12);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
    });

    const result = await settle(t, lotId, 10_000);

    expect(result.buyerTotal).toBe(500);
  });

  it("platform-sourced lot reverts to the platform default when the row is deactivated", async () => {
    const t = createTestContext();
    const feeId = await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await assign(t);
    await t.run(async (ctx) => {
      await ctx.db.patch("platformFees", feeId, { isActive: false });
    });

    const result = await settle(t, lotId, 10_000);

    // The snapshot is taken even though a buyer % row was active at assignment.
    expect(result.buyerTotal).toBe(1200);
    expect(result.buyerRows).toHaveLength(0);
  });
});

describe("settlement charges exactly one seller commission", () => {
  it("seeded-shaped lot (snapshot + active seller % row) charges only the snapshot", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "seller",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedSellerCommissionPct: 0.05,
      commissionSource: "auction",
    });

    const result = await settle(t, lotId, 10_000);

    expect(result.sellerTotal).toBe(500);
    expect(result.sellerRows).toHaveLength(0);
  });

  it("legacy lot (snapshot, no commissionSource) is treated as auction-sourced", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "seller",
      isActive: true,
    });
    const lotId = await insertLot(t, { resolvedSellerCommissionPct: 0.07 });

    const result = await settle(t, lotId, 10_000);

    expect(result.sellerTotal).toBe(700);
    expect(result.sellerRows).toHaveLength(0);
  });

  it("no snapshot + active seller % row charges only the row", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "seller",
      isActive: true,
    });
    const lotId = await insertLot(t);

    const result = await settle(t, lotId, 10_000);

    expect(result.sellerTotal).toBe(500);
    expect(result.sellerRows).toHaveLength(1);
  });

  it("no snapshot and no seller row charges no seller commission", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const lotId = await insertLot(t);

    const result = await settle(t, lotId, 10_000);

    expect(result.sellerTotal).toBe(0);
    expect(result.sellerRows).toHaveLength(0);
  });

  it("a 'both' percentage row still charges the buyer side under a seller snapshot", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.02,
      appliesTo: "both",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedSellerCommissionPct: 0.05,
      commissionSource: "auction",
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "platform",
    });

    const result = await settle(t, lotId, 10_000);

    // Seller: snapshot only (the both-row's seller half is ignored).
    expect(result.sellerTotal).toBe(500);
    expect(result.sellerRows).toHaveLength(0);
    // Buyer: the both-row is the premium (platform-sourced snapshot yields).
    expect(result.buyerTotal).toBe(200);
  });

  it("fixed seller fees stay additive to the snapshot commission", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "fixed",
      value: 75,
      appliesTo: "seller",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedSellerCommissionPct: 0.05,
      commissionSource: "auction",
    });

    const result = await settle(t, lotId, 10_000);

    expect(result.sellerTotal).toBe(575);
    expect(result.sellerRows).toHaveLength(1);
  });

  describe("fee rows toggled after assignment", () => {
    /**
     * Assigns an approved lot through the real mutation.
     *
     * @param t - The convex-test context.
     * @param auctionCommission - The auction's own seller commission, if any.
     * @returns The assigned lot id.
     */
    async function assign(
      t: TestContext,
      auctionCommission?: number
    ): Promise<Id<"lots">> {
      await seedProfiles(t);
      const auctionId = await t.run(async (ctx) =>
        ctx.db.insert("auctions", {
          title: "Sale",
          status: "draft",
          startTime: Date.now() + 60_000,
          endTime: Date.now() + 600_000,
          defaultSellerCommissionPct: auctionCommission,
          createdBy: ADMIN,
          createdAt: 1,
          updatedAt: 1,
        })
      );
      const lotId = await insertLot(t, {
        status: "approved",
        winnerId: undefined,
      });
      await asAdmin(t).mutation(
        api.auctions.mutations.assignment.assignLotToAuction,
        { lotId, auctionId }
      );
      return lotId;
    }

    it("assignment records commissionSource 'auction' only when the auction sets a commission", async () => {
      const withCommission = createTestContext();
      const lotA = await assign(withCommission, 0.06);
      const a = await withCommission.run(async (ctx) =>
        ctx.db.get("lots", lotA)
      );
      expect(a?.resolvedSellerCommissionPct).toBe(0.06);
      expect(a?.commissionSource).toBe("auction");

      const without = createTestContext();
      const lotB = await assign(without);
      const b = await without.run(async (ctx) => ctx.db.get("lots", lotB));
      expect(b?.resolvedSellerCommissionPct).toBeUndefined();
      expect(b?.commissionSource).toBeUndefined();
    });

    it("auction-sourced lot ignores a seller % row activated after assignment", async () => {
      const t = createTestContext();
      const lotId = await assign(t, 0.06);
      await insertFee(t, {
        feeType: "percentage",
        value: 0.05,
        appliesTo: "seller",
        isActive: true,
      });

      const result = await settle(t, lotId, 10_000);

      expect(result.sellerTotal).toBe(600);
      expect(result.sellerRows).toHaveLength(0);
    });

    it("lot without an auction commission picks up a seller % row activated after assignment", async () => {
      const t = createTestContext();
      const lotId = await assign(t);
      await insertFee(t, {
        feeType: "percentage",
        value: 0.05,
        appliesTo: "seller",
        isActive: true,
      });

      const result = await settle(t, lotId, 10_000);

      expect(result.sellerTotal).toBe(500);
      expect(result.sellerRows).toHaveLength(1);
    });
  });
});

describe("getLotFeesForUser charges exactly one seller commission", () => {
  /**
   * Reads the seller's fee view of a lot.
   *
   * @param t - The convex-test context.
   * @param lotId - The lot.
   * @returns The caller's buyer and seller fee lines.
   */
  const sellerFees = (t: TestContext, lotId: Id<"lots">) =>
    t.withIdentity({ subject: SELLER }).query(api.admin.getLotFeesForUser, {
      lotId,
    });

  /**
   * Persists a seller % lotFees row as settlement would have.
   *
   * @param t - The convex-test context.
   * @param lotId - The lot.
   * @param feeId - The platform fee row.
   */
  async function insertSellerLotFee(
    t: TestContext,
    lotId: Id<"lots">,
    feeId: Id<"platformFees">
  ): Promise<void> {
    await t.run(async (ctx) => {
      await ctx.db.insert("lotFees", {
        lotId,
        feeId,
        feeName: "seller percentage fee",
        appliedTo: "seller",
        feeType: "percentage",
        rate: 0.05,
        salePrice: 10_000,
        calculatedAmount: 500,
        createdAt: 1,
      });
    });
  }

  it("auction snapshot, no ledger rows: one derived live line", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const lotId = await insertLot(t, {
      status: "assigned",
      resolvedSellerCommissionPct: 0.06,
      commissionSource: "auction",
    });

    const fees = await sellerFees(t, lotId);

    expect(fees.sellerFees).toEqual([
      {
        feeName: "Auction Seller Commission",
        feeType: "percentage",
        rate: 0.06,
        calculatedAmount: 600,
      },
    ]);
  });

  it("with a persisted ledger row the ledger wins over the snapshot", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const feeId = await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "seller",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedSellerCommissionPct: 0.06,
      commissionSource: "auction",
    });
    await insertSellerLotFee(t, lotId, feeId);

    const fees = await sellerFees(t, lotId);

    expect(fees.sellerFees).toHaveLength(1);
    expect(fees.sellerFees[0]).toMatchObject({
      feeName: "seller percentage fee",
      calculatedAmount: 500,
    });
  });

  it("no snapshot: only the persisted seller % row", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const feeId = await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "seller",
      isActive: true,
    });
    const lotId = await insertLot(t);
    await insertSellerLotFee(t, lotId, feeId);

    const fees = await sellerFees(t, lotId);

    expect(fees.sellerFees).toHaveLength(1);
    expect(fees.sellerFees[0]).toMatchObject({
      feeName: "seller percentage fee",
      calculatedAmount: 500,
    });
  });

  it("no snapshot and no row: no seller fees", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const lotId = await insertLot(t);

    const fees = await sellerFees(t, lotId);

    expect(fees.sellerFees).toEqual([]);
  });
});

describe("resolveBuyerPremium", () => {
  it("falls through to the platform default when an auction-sourced lot lacks a snapshot", async () => {
    const t = createTestContext();
    const resolved = await t.run(async (ctx) =>
      resolveBuyerPremium(ctx, {
        premiumSource: "auction",
        resolvedBuyerPremiumPct: undefined,
      })
    );
    expect(resolved).toEqual({ source: "platformDefault", rate: 0.12 });
  });

  it("rounds a fractional platform percent to 4 dp", async () => {
    const t = createTestContext();
    await setPlatformPremium(t, 12.3456);
    const resolved = await t.run(async (ctx) =>
      resolveBuyerPremium(ctx, {
        premiumSource: "platform",
        resolvedBuyerPremiumPct: 0.5,
      })
    );
    expect(resolved).toEqual({ source: "platformDefault", rate: 0.1235 });
  });
});

describe("getLotFeesForUser charges exactly one buyer premium", () => {
  it("with a persisted ledger row the ledger wins over the auction snapshot", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const feeId = await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "auction",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("lotFees", {
        lotId,
        feeId,
        feeName: "buyer percentage fee",
        appliedTo: "buyer",
        feeType: "percentage",
        rate: 0.05,
        salePrice: 10_000,
        calculatedAmount: 500,
        createdAt: 1,
      });
    });

    const fees = await winnerFees(t, lotId);

    expect(fees.buyerFees).toHaveLength(1);
    expect(fees.buyerFees[0]).toMatchObject({
      feeName: "buyer percentage fee",
      calculatedAmount: 500,
    });
  });

  it("auction snapshot, unsettled lot: one derived live line", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      status: "assigned",
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "auction",
    });

    const fees = await winnerFees(t, lotId);

    expect(fees.buyerFees).toEqual([
      {
        feeName: "Auction Buyer Premium",
        feeType: "percentage",
        rate: 0.12,
        calculatedAmount: 1200,
      },
    ]);
  });

  it("platform-sourced with an active buyer % row: only the persisted row", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const feeId = await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "platform",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("lotFees", {
        lotId,
        feeId,
        feeName: "buyer percentage fee",
        appliedTo: "buyer",
        feeType: "percentage",
        rate: 0.05,
        salePrice: 10_000,
        calculatedAmount: 500,
        createdAt: 1,
      });
    });

    const fees = await winnerFees(t, lotId);

    expect(fees.buyerFees).toHaveLength(1);
    expect(fees.buyerFees[0]).toMatchObject({
      feeName: "buyer percentage fee",
      calculatedAmount: 500,
    });
  });

  it("platform-sourced with no active buyer % row: one platform default line", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await setPlatformPremium(t, 9);
    const lotId = await insertLot(t, {
      status: "assigned",
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "platform",
    });

    const fees = await winnerFees(t, lotId);

    expect(fees.buyerFees).toEqual([
      {
        feeName: "Buyer Premium",
        feeType: "percentage",
        rate: 0.09,
        calculatedAmount: 900,
      },
    ]);
  });
});

describe("settled lots read fees from the persisted ledger only", () => {
  const sellerView = (t: TestContext, lotId: Id<"lots">) =>
    t.withIdentity({ subject: SELLER }).query(api.admin.getLotFeesForUser, {
      lotId,
    });

  /**
   * Settles a snapshot-sourced lot plus a fixed fee and returns what both
   * parties see right after settlement.
   *
   * @param t - The convex-test context.
   * @returns The lot id, the fixed fee id and both parties' fee views.
   */
  async function settleWithSnapshots(t: TestContext) {
    await seedProfiles(t);
    const fixedId = await insertFee(t, {
      feeType: "fixed",
      value: 50,
      appliesTo: "both",
      isActive: true,
    });
    const auctionId = await t.run(async (ctx) =>
      ctx.db.insert("auctions", {
        title: "Sale",
        status: "published",
        startTime: 1,
        endTime: 2,
        defaultBuyerPremiumPct: 0.12,
        defaultSellerCommissionPct: 0.05,
        createdBy: ADMIN,
        createdAt: 1,
        updatedAt: 1,
      })
    );
    const lotId = await insertLot(t, {
      auctionId,
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "auction",
      resolvedSellerCommissionPct: 0.05,
      commissionSource: "auction",
      settledAt: 1,
    });
    await settle(t, lotId, 10_000);
    return {
      lotId,
      auctionId,
      fixedId,
      buyer: await winnerFees(t, lotId),
      seller: await sellerView(t, lotId),
    };
  }

  it("persists the premium and commission as ledger rows with their source", async () => {
    const t = createTestContext();
    const { lotId } = await settleWithSnapshots(t);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("lotFees")
        .withIndex("by_lot", (q) => q.eq("lotId", lotId))
        .collect()
    );
    const premium = rows.filter(
      (r) => r.appliedTo === "buyer" && r.source === "auction"
    );
    const commission = rows.filter(
      (r) => r.appliedTo === "seller" && r.source === "auction"
    );
    expect(premium).toHaveLength(1);
    expect(premium[0]).toMatchObject({
      feeName: "Auction Buyer Premium",
      rate: 0.12,
      salePrice: 10_000,
      calculatedAmount: 1200,
    });
    expect(premium[0]?.feeId).toBeUndefined();
    expect(commission).toHaveLength(1);
    expect(commission[0]?.calculatedAmount).toBe(500);
    expect(rows.filter((r) => r.source === "fee_row")).toHaveLength(2);
  });

  it("re-running settlement neither duplicates rows nor re-counts totals", async () => {
    const t = createTestContext();
    const { lotId } = await settleWithSnapshots(t);

    const again = await settle(t, lotId, 10_000);

    expect(again.ledger).toHaveLength(4);
    expect(again.buyerTotal).toBe(1250);
    expect(again.sellerTotal).toBe(550);
  });

  it("is unchanged by toggling buyer % fee rows, premium setting, seller rows and auction default", async () => {
    const t = createTestContext();
    const { lotId, auctionId, fixedId, buyer, seller } =
      await settleWithSnapshots(t);
    expect(buyer.buyerFees.map((f) => f.calculatedAmount)).toEqual([50, 1200]);
    expect(seller.sellerFees.map((f) => f.calculatedAmount)).toEqual([50, 500]);

    // (a) buyer % rows toggled active (and the fixed row deactivated)
    const buyerPct = await insertFee(t, {
      feeType: "percentage",
      value: 0.2,
      appliesTo: "buyer",
      isActive: true,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch("platformFees", fixedId, { isActive: false });
    });
    expect(await winnerFees(t, lotId)).toEqual(buyer);
    await t.run(async (ctx) => {
      await ctx.db.patch("platformFees", buyerPct, { isActive: false });
    });
    expect(await winnerFees(t, lotId)).toEqual(buyer);

    // (b) platform default premium changed
    await setPlatformPremium(t, 30);
    expect(await winnerFees(t, lotId)).toEqual(buyer);

    // (c) seller % rows toggled
    const sellerPct = await insertFee(t, {
      feeType: "percentage",
      value: 0.4,
      appliesTo: "seller",
      isActive: true,
    });
    expect(await sellerView(t, lotId)).toEqual(seller);
    await t.run(async (ctx) => {
      await ctx.db.patch("platformFees", sellerPct, { isActive: false });
    });
    expect(await sellerView(t, lotId)).toEqual(seller);

    // (d) the auction default changes
    await t.run(async (ctx) => {
      await ctx.db.patch("auctions", auctionId, {
        defaultBuyerPremiumPct: 0.5,
        defaultSellerCommissionPct: 0.5,
      });
    });
    expect(await winnerFees(t, lotId)).toEqual(buyer);
    expect(await sellerView(t, lotId)).toEqual(seller);
  });

  it("platform-default premium charged at settlement stays after the default changes", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    await setPlatformPremium(t, 9);
    const lotId = await insertLot(t, { settledAt: 1 });
    await settle(t, lotId, 10_000);

    await setPlatformPremium(t, 20);

    expect((await winnerFees(t, lotId)).buyerFees).toEqual([
      {
        feeName: "Buyer Premium",
        feeType: "percentage",
        rate: 0.09,
        calculatedAmount: 900,
      },
    ]);
  });

  it("a fee-row premium settled earlier still shows after its row is deactivated", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const feeId = await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
    });
    const lotId = await insertLot(t, { settledAt: 1 });
    await settle(t, lotId, 10_000);

    await t.run(async (ctx) => {
      await ctx.db.patch("platformFees", feeId, {
        isActive: false,
        deletedAt: 5,
      });
    });

    const fees = await winnerFees(t, lotId);
    expect(fees.buyerFees).toHaveLength(1);
    expect(fees.buyerFees[0]).toMatchObject({ calculatedAmount: 500 });
  });

  it("a settled legacy lot with no ledger rows falls back to its snapshots", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const auctionLot = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.1,
      premiumSource: "auction",
      resolvedSellerCommissionPct: 0.04,
      settledAt: 1,
    });
    const platformLot = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.12,
      premiumSource: "platform",
      settledAt: 1,
    });
    const bareLot = await insertLot(t, { settledAt: 1 });
    await setPlatformPremium(t, 30);

    expect(await winnerFees(t, auctionLot)).toEqual({
      buyerFees: [
        {
          feeName: "Auction Buyer Premium",
          feeType: "percentage",
          rate: 0.1,
          calculatedAmount: 1000,
        },
      ],
      sellerFees: [
        {
          feeName: "Auction Seller Commission",
          feeType: "percentage",
          rate: 0.04,
          calculatedAmount: 400,
        },
      ],
    });
    expect((await winnerFees(t, platformLot)).buyerFees).toEqual([
      {
        feeName: "Buyer Premium",
        feeType: "percentage",
        rate: 0.12,
        calculatedAmount: 1200,
      },
    ]);
    // Never re-resolves the live platform default for a settled lot.
    expect(await winnerFees(t, bareLot)).toEqual({
      buyerFees: [],
      sellerFees: [],
    });
  });

  it("a lot with only a legacy fixed buyer row still gets its snapshot premium line", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const feeId = await insertFee(t, {
      feeType: "fixed",
      value: 50,
      appliesTo: "buyer",
      isActive: false,
    });
    const lotId = await insertLot(t, {
      resolvedBuyerPremiumPct: 0.1,
      premiumSource: "auction",
      settledAt: 1,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("lotFees", {
        lotId,
        feeId,
        feeName: "legacy fixed",
        appliedTo: "buyer",
        feeType: "fixed",
        rate: 50,
        salePrice: 10_000,
        calculatedAmount: 50,
        createdAt: 1,
      });
    });

    const fees = await winnerFees(t, lotId);

    expect(fees.buyerFees.map((f) => f.calculatedAmount)).toEqual([50, 1000]);
  });
});

describe("seller VAT snapshot", () => {
  /**
   * Creates an approved lot for the seller and an auction, then assigns it.
   *
   * @param t - The convex-test context.
   * @returns The assigned lot id.
   */
  async function assignLot(t: TestContext): Promise<Id<"lots">> {
    const auctionId = await t.run(async (ctx) =>
      ctx.db.insert("auctions", {
        title: "Sale",
        status: "draft",
        startTime: Date.now() + 60_000,
        endTime: Date.now() + 600_000,
        createdBy: ADMIN,
        createdAt: 1,
        updatedAt: 1,
      })
    );
    const lotId = await insertLot(t, {
      status: "approved",
      winnerId: undefined,
    });
    await asAdmin(t).mutation(
      api.auctions.mutations.assignment.assignLotToAuction,
      { lotId, auctionId }
    );
    return lotId;
  }

  it("snapshots the seller profile at assignment and ignores later profile edits", async () => {
    const t = createTestContext();
    await seedProfiles(t, {
      vatRegistered: false,
      sellerType: "private_farmer",
    });
    const lotId = await assignLot(t);

    const lot = await t.run(async (ctx) => ctx.db.get("lots", lotId));
    expect(lot).toMatchObject({
      sellerVatRegistered: false,
      sellerType: "private_farmer",
    });
    const before = await t.query(api.auctions.getLotById, { lotId });
    expect(before).toMatchObject({
      sellerVatKind: "private",
      sellerTypeLabel: "Private farmer",
    });

    // Both edit paths only affect future assignments.
    await t
      .withIdentity({ subject: SELLER })
      .mutation(api.users.updateMyProfile, {
        vatRegistered: true,
        sellerType: "dealer",
      });
    await asAdmin(t).mutation(api.users.adminSetSellerVatProfile, {
      userId: SELLER,
      vatRegistered: true,
      sellerType: "dealer",
    });

    const after = await t.query(api.auctions.getLotById, { lotId });
    expect(after).toMatchObject({
      sellerVatKind: "private",
      sellerTypeLabel: "Private farmer",
    });
  });

  it("an assigned lot of a seller with no VAT info stays VAT after the profile changes", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const lotId = await assignLot(t);

    await asAdmin(t).mutation(api.users.adminSetSellerVatProfile, {
      userId: SELLER,
      vatRegistered: false,
      sellerType: "private_farmer",
    });

    const detail = await t.query(api.auctions.getLotById, { lotId });
    expect(detail).toMatchObject({ sellerVatKind: "vat" });
    expect(detail?.sellerTypeLabel).toBeUndefined();
  });

  it("a never-assigned lot follows the live seller profile", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const lotId = await insertLot(t, {
      status: "pending_review",
      winnerId: undefined,
    });

    await asAdmin(t).mutation(api.users.adminSetSellerVatProfile, {
      userId: SELLER,
      vatRegistered: false,
      sellerType: "private_farmer",
    });

    const detail = await asAdmin(t).query(api.auctions.getLotById, { lotId });
    expect(detail).toMatchObject({
      sellerVatKind: "private",
      sellerTypeLabel: "Private farmer",
    });
  });
});

describe("adminSetLotSellerVat", () => {
  it("corrects the lot snapshot and audits before/after", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const lotId = await insertLot(t, {
      premiumSource: "auction",
      sellerVatRegistered: true,
      sellerType: "dealer",
    });

    await asAdmin(t).mutation(api.auctions.adminSetLotSellerVat, {
      lotId,
      sellerVatRegistered: false,
      sellerType: "private_farmer",
    });

    const lot = await t.run(async (ctx) => ctx.db.get("lots", lotId));
    expect(lot).toMatchObject({
      sellerVatRegistered: false,
      sellerType: "private_farmer",
    });
    const detail = await t.query(api.auctions.getLotById, { lotId });
    expect(detail).toMatchObject({ sellerVatKind: "private" });

    const audits = await t.run(async (ctx) =>
      (await ctx.db.query("auditLogs").collect()).filter(
        (row) => row.action === "UPDATE_LOT_SELLER_VAT"
      )
    );
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0]?.details ?? "{}")).toEqual({
      before: { sellerVatRegistered: true, sellerType: "dealer" },
      after: { sellerVatRegistered: false, sellerType: "private_farmer" },
    });
  });

  it("leaves omitted fields unchanged", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const lotId = await insertLot(t, {
      sellerVatRegistered: true,
      sellerType: "dealer",
    });

    await asAdmin(t).mutation(api.auctions.adminSetLotSellerVat, {
      lotId,
      sellerVatRegistered: false,
    });

    const lot = await t.run(async (ctx) => ctx.db.get("lots", lotId));
    expect(lot).toMatchObject({
      sellerVatRegistered: false,
      sellerType: "dealer",
    });
  });

  it("rejects non-admins, unknown lots and empty updates", async () => {
    const t = createTestContext();
    await seedProfiles(t);
    const lotId = await insertLot(t);

    await expect(
      asWinner(t).mutation(api.auctions.adminSetLotSellerVat, {
        lotId,
        sellerVatRegistered: false,
      })
    ).rejects.toThrow();
    await expect(
      asAdmin(t).mutation(api.auctions.adminSetLotSellerVat, { lotId })
    ).rejects.toThrow("Provide a VAT status or seller type to set");

    await t.run(async (ctx) => {
      await ctx.db.delete("lots", lotId);
    });
    await expect(
      asAdmin(t).mutation(api.auctions.adminSetLotSellerVat, {
        lotId,
        sellerVatRegistered: false,
      })
    ).rejects.toThrow("Lot not found");
  });
});

describe("migrations:convertPercentageFeesToFractions", () => {
  it("converts whole-percent rows, skips fractions/fixed/out-of-range, and is idempotent", async () => {
    const t = createTestContext();
    const buyer = await insertFee(t, {
      feeType: "percentage",
      value: 12,
      appliesTo: "buyer",
      isActive: true,
    });
    const seller = await insertFee(t, {
      feeType: "percentage",
      value: 12.1,
      appliesTo: "seller",
      isActive: false,
    });
    const fraction = await insertFee(t, {
      feeType: "percentage",
      value: 0.05,
      appliesTo: "seller",
      isActive: true,
    });
    const one = await insertFee(t, {
      feeType: "percentage",
      value: 1,
      appliesTo: "seller",
      isActive: true,
    });
    const fixed = await insertFee(t, {
      feeType: "fixed",
      value: 250,
      appliesTo: "buyer",
      isActive: true,
    });
    const tooBig = await insertFee(t, {
      feeType: "percentage",
      value: 250,
      appliesTo: "buyer",
      isActive: true,
    });

    const first = await t.mutation(
      internal.migrations.convertPercentageFeesToFractions,
      {}
    );

    expect(first.converted).toBe(2);
    expect(first.skipped).toBe(4);
    expect(first.details).toEqual(
      expect.arrayContaining([
        { id: buyer, name: "buyer percentage fee", from: 12, to: 0.12 },
        { id: seller, name: "seller percentage fee", from: 12.1, to: 0.121 },
      ])
    );
    const values = await t.run(async (ctx) => {
      const out: Record<string, number | undefined> = {};
      for (const id of [buyer, seller, fraction, one, fixed, tooBig]) {
        out[id] = (await ctx.db.get("platformFees", id))?.value;
      }
      return out;
    });
    expect(values).toEqual({
      [buyer]: 0.12,
      [seller]: 0.121,
      [fraction]: 0.05,
      [one]: 1,
      [fixed]: 250,
      [tooBig]: 250,
    });

    const second = await t.mutation(
      internal.migrations.convertPercentageFeesToFractions,
      {}
    );
    expect(second).toEqual({ converted: 0, skipped: 6, details: [] });
  });
});
