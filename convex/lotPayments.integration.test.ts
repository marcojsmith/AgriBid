/// <reference types="vite/client" />

/**
 * Won-lot payments end to end against an in-memory Convex backend: every path
 * that sells a lot creates one record with the lot-page amounts, the deposit is
 * credited once, and collection details stay private until an admin confirms.
 */

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { calculateBuyerTotal } from "./lib/buyerTotal";
import { addBusinessDays } from "./lib/businessDays";
import { encryptPII } from "./lib/encryption";
import { DEMO_BIDDER_IDS } from "./lib/wbtImport";
import {
  createLotPayment,
  generateUniqueReference,
  getLotPaymentByLot,
} from "./lib/lotPayments";
import { sellerDisplayName } from "./lotPayments";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const SELLER = "user_seller";
const PRIVATE_SELLER = "user_private_seller";
const BUYER = "user_buyer";
const OTHER = "user_other";
const ADMIN = "user_admin";
const DAY = 24 * 60 * 60 * 1000;
/** Fri 27 Nov 2026 11:00 SAST. */
const FRIDAY = Date.UTC(2026, 10, 27, 9, 0);
/** Tue 1 Dec 2026 11:00 SAST: two business days after FRIDAY. */
const TUESDAY = Date.UTC(2026, 11, 1, 9, 0);

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

const as = (t: Ctx, subject: string) => t.withIdentity({ subject });

/**
 * Seeds profiles (an admin, a VAT seller, a private seller, two buyers), the
 * lots counter, an active 5% buyer premium and a live sale.
 *
 * @param t - Test context
 * @returns The sale id
 */
async function seedWorld(t: Ctx): Promise<Id<"auctions">> {
  const phone = await encryptPII("+27825550147");
  return await t.run(async (ctx) => {
    const now = Date.now();
    const profiles: [string, "buyer" | "seller" | "admin", object][] = [
      [ADMIN, "admin", {}],
      [
        SELLER,
        "seller",
        {
          name: "Seller Co",
          companyName: "Karoo Farm Equipment",
          phoneNumber: phone,
        },
      ],
      [PRIVATE_SELLER, "seller", { vatRegistered: false }],
      [BUYER, "buyer", { name: "Thandi Nkosi" }],
      [OTHER, "buyer", { name: "Other Buyer" }],
    ];
    for (const [userId, role, extra] of profiles) {
      await ctx.db.insert("profiles", {
        userId,
        role,
        isVerified: true,
        createdAt: now,
        updatedAt: now,
        ...extra,
      });
    }
    await ctx.db.insert("counters", {
      name: "lots",
      total: 0,
      active: 0,
      soldCount: 0,
      salesVolume: 0,
      updatedAt: now,
    });
    await ctx.db.insert("platformFees", {
      name: "Buyer Premium",
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
      visibleToBuyer: true,
      visibleToSeller: false,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.insert("auctions", {
      title: "November Sale",
      status: "published",
      startTime: now - 10 * 60_000,
      endTime: now + 10 * 60_000,
      createdBy: SELLER,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Inserts a lot.
 *
 * @param t - Test context
 * @param auctionId - The sale
 * @param overrides - Field overrides
 * @returns The lot id
 */
async function insertLot(
  t: Ctx,
  auctionId: Id<"auctions">,
  overrides: Partial<Doc<"lots">> = {}
): Promise<Id<"lots">> {
  return await t.run(async (ctx) => {
    const categoryId = await ctx.db.insert("equipmentCategories", {
      name: `Tractors ${String(Math.random())}`,
      isActive: true,
    });
    return await ctx.db.insert("lots", {
      title: "John Deere 8R",
      make: "John Deere",
      model: "8R",
      year: 2020,
      operatingHours: 1000,
      location: "Bloemfontein",
      categoryId,
      reservePrice: 5000,
      startingPrice: 1000,
      currentPrice: 1000,
      minIncrement: 100,
      sellerId: SELLER,
      status: "assigned",
      auctionId,
      lotNumber: 7,
      images: { additional: [] },
      createdAt: Date.now(),
      ...overrides,
    });
  });
}

/**
 * Inserts a bid.
 *
 * @param t - Test context
 * @param lotId - The lot
 * @param bidderId - The bidder
 * @param amount - The amount
 */
async function insertBid(
  t: Ctx,
  lotId: Id<"lots">,
  bidderId: string,
  amount: number
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("bids", {
      lotId,
      bidderId,
      amount,
      timestamp: Date.now(),
      status: "valid",
    });
    await ctx.db.patch("lots", lotId, { currentPrice: amount });
  });
}

/**
 * Inserts a registration deposit.
 *
 * @param t - Test context
 * @param status - Deposit status
 * @param extra - Field overrides
 */
async function insertDeposit(
  t: Ctx,
  status: Doc<"registrationDeposits">["status"] = "received",
  extra: Partial<Doc<"registrationDeposits">> = {}
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("registrationDeposits", {
      userId: BUYER,
      reference: "AB-DEP01",
      status,
      amount: 5000,
      receivedAmount: status === "received" ? 5000 : undefined,
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    });
  });
}

/**
 * Creates the payment for a lot through the shared helper.
 *
 * @param t - Test context
 * @param lotId - The lot
 * @param bid - The hammer price
 * @param buyer - The winner
 * @param at - The sale time
 * @returns The payment
 */
async function pay(
  t: Ctx,
  lotId: Id<"lots">,
  bid: number,
  buyer = BUYER,
  at = FRIDAY
): Promise<Doc<"lotPayments">> {
  return await t.run(async (ctx) => {
    const lot = await ctx.db.get("lots", lotId);
    if (!lot) throw new Error("lot missing");
    const payment = await createLotPayment(ctx, lot, buyer, bid, at);
    if (!payment) throw new Error("no payment created");
    return payment;
  });
}

const payments = (t: Ctx) =>
  t.run((ctx) => ctx.db.query("lotPayments").collect());
const notificationsFor = (t: Ctx, userId: string) =>
  t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .collect()
  );

describe("createLotPayment amounts", () => {
  it("matches calculateBuyerTotal for a VAT-registered seller", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);

    const payment = await pay(t, lotId, 123_457);

    const expected = calculateBuyerTotal({
      bid: 123_457,
      premium: 123_457 * 0.05,
      vatRatePct: 15,
    });
    expect(payment).toMatchObject({
      bid: expected.bid,
      premium: expected.premium,
      vat: expected.vat,
      total: expected.total,
      vatKind: "vat",
      depositCredit: 0,
      amountDue: expected.total,
      status: "awaiting",
      buyerId: BUYER,
      sellerId: SELLER,
    });
  });

  it("charges VAT on the premium only for a private seller", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, { sellerId: PRIVATE_SELLER });

    const payment = await pay(t, lotId, 100_000);

    expect(payment).toMatchObject({
      premium: 5000,
      vat: 750,
      total: 105_750,
      vatKind: "private",
    });
  });

  it("adds fixed buyer fees to the premium before VAT", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("platformFees", {
        name: "Admin fee",
        feeType: "fixed",
        value: 500,
        appliesTo: "buyer",
        isActive: true,
        visibleToBuyer: true,
        visibleToSeller: false,
        sortOrder: 2,
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const lotId = await insertLot(t, auctionId);

    const payment = await pay(t, lotId, 100_000);

    const expected = calculateBuyerTotal({
      bid: 100_000,
      premium: 5500,
      vatRatePct: 15,
    });
    expect(payment).toMatchObject({
      premium: 5500,
      vat: expected.vat,
      total: expected.total,
    });
  });

  it("uses the lot's auction snapshot and the admin VAT rate", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("settings", {
        key: "vat_rate_pct",
        value: 10,
        updatedAt: 1,
      });
    });
    const lotId = await insertLot(t, auctionId, {
      resolvedBuyerPremiumPct: 0.1,
      premiumSource: "auction",
    });

    const payment = await pay(t, lotId, 50_000);

    expect(payment).toMatchObject({ premium: 5000, vat: 5500, total: 60_500 });
  });

  it("sets payBy to two business days after the sale", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);

    const payment = await pay(t, lotId, 10_000, BUYER, FRIDAY);

    expect(payment.payBy).toBe(TUESDAY);
    expect(payment.payBy).toBe(addBusinessDays(FRIDAY, 2));
    expect(payment.createdAt).toBe(FRIDAY);
  });

  it("is idempotent: a second call returns the same record", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    await insertDeposit(t);
    const lotId = await insertLot(t, auctionId);

    const first = await pay(t, lotId, 20_000);
    const second = await pay(t, lotId, 99_999);

    expect(second._id).toBe(first._id);
    expect(second.bid).toBe(20_000);
    expect(await payments(t)).toHaveLength(1);
    expect(await notificationsFor(t, BUYER)).toHaveLength(1);
  });

  it("tells the winner what to pay and by when", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);

    const payment = await pay(t, lotId, 100_000);

    const [note] = await notificationsFor(t, BUYER);
    expect(note.message).toBe(
      `You won Lot 7 John Deere 8R. Pay R ${String(payment.amountDue).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} by Tue 1 Dec, 11:00.`
    );
    expect(note.link).toBe("/dashboard/bids");
  });
});

describe("deposit credit", () => {
  it("credits a received deposit against the first won lot only", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    await insertDeposit(t);
    const first = await insertLot(t, auctionId);
    const second = await insertLot(t, auctionId, { lotNumber: 8 });

    const a = await pay(t, first, 100_000);
    const b = await pay(t, second, 100_000);

    expect(a.depositCredit).toBe(5000);
    expect(a.amountDue).toBe(a.total - 5000);
    expect(b.depositCredit).toBe(0);
    expect(b.amountDue).toBe(b.total);
    const deposit = await t.run((ctx) =>
      ctx.db.query("registrationDeposits").first()
    );
    expect(deposit).toMatchObject({ creditedLotId: first, creditedAt: FRIDAY });
  });

  it("credits what was received when that differs from the amount", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    await insertDeposit(t, "received", { receivedAmount: 7500 });
    const lotId = await insertLot(t, auctionId);

    expect((await pay(t, lotId, 100_000)).depositCredit).toBe(7500);
  });

  it("never credits more than the total", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    await insertDeposit(t);
    const lotId = await insertLot(t, auctionId);

    const payment = await pay(t, lotId, 1000);

    expect(payment.depositCredit).toBe(payment.total);
    expect(payment.amountDue).toBe(0);
  });

  it.each(["awaiting", "paid_claimed", "refunded"] as const)(
    "gives no credit while the deposit is %s",
    async (status) => {
      const t = makeContext();
      const auctionId = await seedWorld(t);
      await insertDeposit(t, status);
      const lotId = await insertLot(t, auctionId);

      const payment = await pay(t, lotId, 100_000);

      expect(payment.depositCredit).toBe(0);
      const deposit = await t.run((ctx) =>
        ctx.db.query("registrationDeposits").first()
      );
      expect(deposit?.creditedLotId).toBeUndefined();
    }
  );

  it("gives no credit when the buyer has no deposit", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);

    expect((await pay(t, lotId, 100_000)).depositCredit).toBe(0);
  });
});

describe("payment references", () => {
  it("avoids deposit and payment references", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    await insertDeposit(t, "awaiting", { reference: "AB-22222" });
    const lotId = await insertLot(t, auctionId);
    await pay(t, lotId, 10_000);
    const taken = (await payments(t))[0].reference;

    // First two attempts collide (deposit, then payment), the third is free.
    const sequence = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5];
    let i = 0;
    const reference = await t.run((ctx) =>
      generateUniqueReference(ctx, () => sequence[i++] ?? 0.9)
    );

    expect(reference).not.toBe("AB-22222");
    expect(reference).not.toBe(taken);
    expect(reference).toMatch(/^AB-[2-9A-HJKMNP-Z]{5}$/);
  });

  it("throws after five collisions", async () => {
    const t = makeContext();
    await seedWorld(t);
    await insertDeposit(t, "awaiting", { reference: "AB-22222" });

    await expect(
      t.run((ctx) => generateUniqueReference(ctx, () => 0))
    ).rejects.toThrow("payment reference");
  });

  it("startMyDeposit will not reuse a lot payment reference", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    const original = Math.random;
    try {
      Math.random = () => 0;
      expect((await pay(t, lotId, 10_000)).reference).toBe("AB-22222");
      await expect(
        as(t, BUYER).mutation(api.registration.startMyDeposit, {})
      ).rejects.toThrow("payment reference");
    } finally {
      Math.random = original;
    }
  });
});

describe("every path that sells a lot creates exactly one payment", () => {
  it("settlement cron", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await insertBid(t, lotId, OTHER, 6000);
    await insertBid(t, lotId, BUYER, 7000);
    await t.run((ctx) =>
      ctx.db.patch("auctions", auctionId, { endTime: Date.now() - 1000 })
    );

    await t.mutation(internal.auctions.internal.settleExpiredLots, {});

    const rows = await payments(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ lotId, buyerId: BUYER, bid: 7000 });
    const lot = await t.run((ctx) => ctx.db.get("lots", lotId));
    expect(rows[0].createdAt).toBe(lot?.settledAt);
    expect(await notificationsFor(t, BUYER)).toHaveLength(1);
  });

  it("admin early close", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await insertBid(t, lotId, BUYER, 8000);

    const result = await as(t, ADMIN).mutation(api.auctions.closeLotEarly, {
      lotId,
    });

    expect(result.finalStatus).toBe("sold");
    const rows = await payments(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ lotId, buyerId: BUYER, bid: 8000 });
    expect(await notificationsFor(t, BUYER)).toHaveLength(1);
  });

  it("seller accepting an under-consideration bid, paying from the accept time", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, { reservePrice: 50_000 });
    await insertBid(t, lotId, BUYER, 9000);
    await t.run((ctx) =>
      ctx.db.patch("auctions", auctionId, { endTime: Date.now() - 1000 })
    );
    await t.mutation(internal.auctions.internal.settleExpiredLots, {});
    expect(await payments(t)).toHaveLength(0);

    await as(t, SELLER).mutation(api.auctions.acceptTopBid, {
      lotId,
      expectedAmount: 9000,
    });

    const rows = await payments(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ lotId, buyerId: BUYER, bid: 9000 });
    const lot = await t.run((ctx) => ctx.db.get("lots", lotId));
    expect(rows[0].createdAt).toBe(lot?.settledAt);
    expect(rows[0].payBy).toBe(addBusinessDays(lot?.settledAt ?? 0, 2));
    // One notification, the payment one (not a second "You won" text).
    const notes = await notificationsFor(t, BUYER);
    expect(notes.filter((n) => n.title === "You won this lot")).toHaveLength(1);
    expect(notes[notes.length - 1].message).toContain("Pay R");
  });

  it("creates nothing for unsold lots or declined bids", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    await insertLot(t, auctionId);
    const low = await insertLot(t, auctionId, {
      reservePrice: 50_000,
      lotNumber: 8,
    });
    await insertBid(t, low, BUYER, 2000);
    await t.run((ctx) =>
      ctx.db.patch("auctions", auctionId, { endTime: Date.now() - 1000 })
    );
    await t.mutation(internal.auctions.internal.settleExpiredLots, {});
    await as(t, SELLER).mutation(api.auctions.declineTopBid, { lotId: low });

    expect(await payments(t)).toHaveLength(0);
  });
});

describe("voidBid after sale", () => {
  it("is refused for a sold lot that has a payment record", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await insertBid(t, lotId, BUYER, 8000);
    await as(t, ADMIN).mutation(api.auctions.closeLotEarly, { lotId });
    const bid = await t.run((ctx) => ctx.db.query("bids").first());

    await expect(
      as(t, ADMIN).mutation(api.admin.mutations.voidBid, {
        bidId: bid?._id as Id<"bids">,
        reason: "test",
      })
    ).rejects.toThrow("payment record");

    const after = await t.run((ctx) =>
      ctx.db.get("bids", bid?._id as Id<"bids">)
    );
    expect(after?.status).toBe("valid");
  });

  it("still works for a legacy sold lot without a payment record", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, {
      status: "sold",
      winnerId: BUYER,
    });
    await insertBid(t, lotId, BUYER, 8000);
    const bid = await t.run((ctx) => ctx.db.query("bids").first());

    const result = await as(t, ADMIN).mutation(api.admin.mutations.voidBid, {
      bidId: bid?._id as Id<"bids">,
      reason: "legacy",
    });

    expect(result.success).toBe(true);
  });
});

describe("getMyWonLots", () => {
  it("lists the caller's payments newest first with lot details", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const a = await insertLot(t, auctionId, { lotNumber: 1, title: "Older" });
    const b = await insertLot(t, auctionId, {
      lotNumber: 2,
      title: "Newer",
      province: "free_state",
      settledAt: FRIDAY,
    });
    await pay(t, a, 10_000, BUYER, FRIDAY - DAY);
    await pay(t, b, 20_000, BUYER, FRIDAY);
    const lotC = await insertLot(t, auctionId, { lotNumber: 3 });
    await pay(t, lotC, 30_000, OTHER);

    const result = await as(t, BUYER).query(api.lotPayments.getMyWonLots, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page.map((row) => row.title)).toEqual(["Newer", "Older"]);
    expect(result.page[0]).toMatchObject({
      lotId: b,
      lotNumber: 2,
      auctionTitle: "November Sale",
      closedAt: FRIDAY,
      status: "awaiting",
      bid: 20_000,
    });
    expect(result.page[0]).not.toHaveProperty("confirmedBy");
    expect(result.page[0].collectBy).toBeUndefined();
  });

  it("adds collectBy seven days after confirmation", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    const payment = await pay(t, lotId, 10_000);
    await t.run((ctx) =>
      ctx.db.patch("lotPayments", payment._id, {
        status: "confirmed",
        confirmedAt: FRIDAY,
        confirmedBy: ADMIN,
      })
    );

    const result = await as(t, BUYER).query(api.lotPayments.getMyWonLots, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page[0].collectBy).toBe(FRIDAY + 7 * DAY);
    expect(result.page[0]).not.toHaveProperty("confirmedBy");
  });

  it("requires sign-in and skips payments whose lot is gone", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await pay(t, lotId, 10_000);
    await t.run((ctx) => ctx.db.delete("lots", lotId));

    await expect(
      t.query(api.lotPayments.getMyWonLots, {
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).rejects.toThrow("Not authenticated");
    const result = await as(t, BUYER).query(api.lotPayments.getMyWonLots, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page).toHaveLength(0);
  });
});

describe("claimLotPaid", () => {
  it("moves awaiting to paid_claimed and is safe to repeat", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await pay(t, lotId, 10_000);

    await as(t, BUYER).mutation(api.lotPayments.claimLotPaid, { lotId });
    const first = (await payments(t))[0];
    await as(t, BUYER).mutation(api.lotPayments.claimLotPaid, { lotId });
    const second = (await payments(t))[0];

    expect(first.status).toBe("paid_claimed");
    expect(first.paidClaimedAt).toBeGreaterThan(0);
    expect(second.paidClaimedAt).toBe(first.paidClaimedAt);
  });

  it("refuses another user, a lot with no payment and a confirmed payment", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    const bare = await insertLot(t, auctionId, { lotNumber: 9 });
    const payment = await pay(t, lotId, 10_000);

    await expect(
      as(t, OTHER).mutation(api.lotPayments.claimLotPaid, { lotId })
    ).rejects.toThrow("No payment found");
    await expect(
      as(t, BUYER).mutation(api.lotPayments.claimLotPaid, { lotId: bare })
    ).rejects.toThrow("No payment found");
    await expect(
      t.mutation(api.lotPayments.claimLotPaid, { lotId })
    ).rejects.toThrow("Not authenticated");

    await t.run((ctx) =>
      ctx.db.patch("lotPayments", payment._id, { status: "confirmed" })
    );
    await expect(
      as(t, BUYER).mutation(api.lotPayments.claimLotPaid, { lotId })
    ).rejects.toThrow("already confirmed");
    expect((await payments(t))[0].status).toBe("confirmed");
  });
});

describe("admin lot payments", () => {
  it("lists payments with lot and buyer names, optionally by status", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const a = await insertLot(t, auctionId, { title: "Tractor A" });
    const b = await insertLot(t, auctionId, {
      title: "Tractor B",
      lotNumber: 8,
    });
    await pay(t, a, 10_000);
    await pay(t, b, 20_000);
    await as(t, BUYER).mutation(api.lotPayments.claimLotPaid, { lotId: b });

    const all = await as(t, ADMIN).query(
      api.admin.lotPayments.listLotPayments,
      {
        paginationOpts: { numItems: 10, cursor: null },
      }
    );
    const claimed = await as(t, ADMIN).query(
      api.admin.lotPayments.listLotPayments,
      {
        status: "paid_claimed",
        paginationOpts: { numItems: 10, cursor: null },
      }
    );

    expect(all.page).toHaveLength(2);
    expect(claimed.page).toHaveLength(1);
    expect(claimed.page[0]).toMatchObject({
      lotTitle: "Tractor B",
      lotNumber: 8,
      buyerName: "Thandi Nkosi",
      status: "paid_claimed",
    });
    expect(claimed.page[0].reference).toMatch(/^AB-/);
  });

  it("is admin only", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    const payment = await pay(t, lotId, 10_000);

    await expect(
      as(t, BUYER).query(api.admin.lotPayments.listLotPayments, {
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).rejects.toThrow("Admin");
    await expect(
      as(t, BUYER).mutation(api.admin.lotPayments.confirmLotPayment, {
        paymentId: payment._id,
      })
    ).rejects.toThrow("Admin");
    await expect(
      t.mutation(api.admin.lotPayments.confirmLotPayment, {
        paymentId: payment._id,
      })
    ).rejects.toThrow("Not authenticated");
    expect((await payments(t))[0].status).toBe("awaiting");
  });

  it("confirms from awaiting or paid_claimed, audits and notifies", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    const payment = await pay(t, lotId, 10_000);
    await as(t, BUYER).mutation(api.lotPayments.claimLotPaid, { lotId });

    await as(t, ADMIN).mutation(api.admin.lotPayments.confirmLotPayment, {
      paymentId: payment._id,
    });

    const row = (await payments(t))[0];
    expect(row).toMatchObject({ status: "confirmed", confirmedBy: ADMIN });
    expect(row.confirmedAt).toBeGreaterThan(0);
    const notes = await notificationsFor(t, BUYER);
    expect(notes[notes.length - 1].message).toBe(
      "Payment received for Lot 7. Collection details are in My bids."
    );
    const audits = await t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(audits.map((a) => a.action)).toContain("LOT_PAYMENT_CONFIRMED");
    await expect(
      as(t, ADMIN).mutation(api.admin.lotPayments.confirmLotPayment, {
        paymentId: payment._id,
      })
    ).rejects.toThrow("already confirmed");
  });

  it("confirms straight from awaiting", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, { lotNumber: undefined });
    const payment = await pay(t, lotId, 10_000);

    await as(t, ADMIN).mutation(api.admin.lotPayments.confirmLotPayment, {
      paymentId: payment._id,
    });

    expect((await payments(t))[0].status).toBe("confirmed");
    const notes = await notificationsFor(t, BUYER);
    expect(notes[notes.length - 1].message).toContain("your lot");
  });

  it("rejects an unknown payment", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    const payment = await pay(t, lotId, 10_000);
    await t.run((ctx) => ctx.db.delete("lotPayments", payment._id));

    await expect(
      as(t, ADMIN).mutation(api.admin.lotPayments.confirmLotPayment, {
        paymentId: payment._id,
      })
    ).rejects.toThrow("not found");
  });
});

describe("getMyCollectionDetails", () => {
  /**
   * A payment for the VAT seller, with an encrypted address on the seller.
   *
   * @param t - Test context
   * @returns The lot id and payment
   */
  async function seedPayment(t: Ctx) {
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    const address = await encryptPII("Farm 12, R64, Bloemfontein");
    await t.run(async (ctx) => {
      const seller = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", SELLER))
        .unique();
      if (seller) {
        await ctx.db.patch("profiles", seller._id, {
          collectionAddress: address,
        });
      }
    });
    return { lotId, payment: await pay(t, lotId, 10_000) };
  }

  const details = (t: Ctx, subject: string, lotId: Id<"lots">) =>
    as(t, subject).query(api.lotPayments.getMyCollectionDetails, { lotId });

  it("is null before confirmation, even for the buyer", async () => {
    const t = makeContext();
    const { lotId } = await seedPayment(t);

    expect(await details(t, BUYER, lotId)).toBeNull();
    await as(t, BUYER).mutation(api.lotPayments.claimLotPaid, { lotId });
    expect(await details(t, BUYER, lotId)).toBeNull();
  });

  it("is decrypted for the buyer after confirmation and null for anyone else", async () => {
    const t = makeContext();
    const { lotId, payment } = await seedPayment(t);
    await as(t, ADMIN).mutation(api.admin.lotPayments.confirmLotPayment, {
      paymentId: payment._id,
    });

    const result = await details(t, BUYER, lotId);

    expect(result).toMatchObject({
      sellerName: "Karoo Farm Equipment",
      sellerPhone: "+27825550147",
      collectionAddress: "Farm 12, R64, Bloemfontein",
    });
    const confirmedAt = (await payments(t))[0].confirmedAt ?? 0;
    expect(result?.collectBy).toBe(confirmedAt + 7 * DAY);
    expect(await details(t, OTHER, lotId)).toBeNull();
    expect(await details(t, SELLER, lotId)).toBeNull();
    expect(await details(t, ADMIN, lotId)).toBeNull();
  });

  it("returns null phone and address when the seller has none", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, { sellerId: PRIVATE_SELLER });
    const payment = await pay(t, lotId, 10_000);
    await as(t, ADMIN).mutation(api.admin.lotPayments.confirmLotPayment, {
      paymentId: payment._id,
    });

    const result = await details(t, BUYER, lotId);

    expect(result?.sellerPhone).toBeNull();
    expect(result?.collectionAddress).toBeNull();
    expect(result?.sellerName).toBe("Seller");
  });

  it("requires sign-in", async () => {
    const t = makeContext();
    const { lotId } = await seedPayment(t);
    await expect(
      t.query(api.lotPayments.getMyCollectionDetails, { lotId })
    ).rejects.toThrow("Not authenticated");
  });
});

describe("sellerDisplayName", () => {
  const base = {
    userId: "u",
    role: "seller" as const,
    isVerified: true,
    createdAt: 1,
    updatedAt: 1,
  };
  const doc = (extra: Partial<Doc<"profiles">>) =>
    ({ _id: "p", _creationTime: 1, ...base, ...extra }) as Doc<"profiles">;

  it("prefers the company name", async () => {
    expect(await sellerDisplayName(doc({ companyName: " Acme " }))).toBe(
      "Acme"
    );
  });

  it("uses first name and surname initial from the encrypted names", async () => {
    expect(
      await sellerDisplayName(
        doc({
          firstName: await encryptPII("Thandi"),
          lastName: await encryptPII("nkosi"),
        })
      )
    ).toBe("Thandi N.");
  });

  it("falls back to the full name, then the display name", async () => {
    expect(
      await sellerDisplayName(
        doc({ fullName: await encryptPII("Pieter van der Merwe") })
      )
    ).toBe("Pieter M.");
    expect(await sellerDisplayName(doc({ name: "Madonna" }))).toBe("Madonna");
    expect(await sellerDisplayName(doc({}))).toBe("Seller");
    expect(await sellerDisplayName(null)).toBe("Seller");
  });

  it("shows only the first name when there is no surname", async () => {
    expect(
      await sellerDisplayName(doc({ firstName: await encryptPII("Thandi") }))
    ).toBe("Thandi");
  });
});

describe("getMyPaymentSummary", () => {
  it("counts open payments and reports the earliest", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const a = await insertLot(t, auctionId, { lotNumber: 1 });
    const b = await insertLot(t, auctionId, { lotNumber: 2 });
    const c = await insertLot(t, auctionId, { lotNumber: 3 });
    const later = await pay(t, a, 10_000, BUYER, FRIDAY);
    await pay(t, b, 20_000, BUYER, FRIDAY - 3 * DAY);
    const done = await pay(t, c, 30_000, BUYER, FRIDAY - 10 * DAY);
    await t.run((ctx) =>
      ctx.db.patch("lotPayments", done._id, { status: "confirmed" })
    );
    await as(t, BUYER).mutation(api.lotPayments.claimLotPaid, { lotId: a });

    const summary = await as(t, BUYER).query(
      api.lotPayments.getMyPaymentSummary,
      {}
    );

    const earliest = (await payments(t)).find((p) => p.lotId === b);
    expect(summary).toEqual({
      unpaidCount: 2,
      nextPayBy: earliest?.payBy,
      nextAmountDue: earliest?.amountDue,
      nextLotId: b,
    });
    expect(later.status).toBe("awaiting");
  });

  it("is empty when nothing is open", async () => {
    const t = makeContext();
    await seedWorld(t);
    expect(
      await as(t, OTHER).query(api.lotPayments.getMyPaymentSummary, {})
    ).toEqual({
      unpaidCount: 0,
      nextPayBy: null,
      nextAmountDue: null,
      nextLotId: null,
    });
  });
});

describe("collection address", () => {
  it("trims, encrypts at rest, reads back and clears", async () => {
    const t = makeContext();
    await seedWorld(t);

    await as(t, SELLER).mutation(api.lotPayments.updateMyCollectionAddress, {
      address: "  Farm 12, R64  ",
    });

    const stored = await t.run(
      async (ctx) =>
        (
          await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", SELLER))
            .unique()
        )?.collectionAddress
    );
    expect(stored).toBeDefined();
    expect(stored).not.toContain("Farm");
    expect(
      await as(t, SELLER).query(api.lotPayments.getMyCollectionAddress, {})
    ).toBe("Farm 12, R64");
    // Owner only: someone else reads their own (empty) address.
    expect(
      await as(t, BUYER).query(api.lotPayments.getMyCollectionAddress, {})
    ).toBeNull();

    await as(t, SELLER).mutation(api.lotPayments.updateMyCollectionAddress, {
      address: "   ",
    });
    expect(
      await as(t, SELLER).query(api.lotPayments.getMyCollectionAddress, {})
    ).toBeNull();
  });

  it("caps the address at 300 characters", async () => {
    const t = makeContext();
    await seedWorld(t);
    const mutate = (address: string) =>
      as(t, SELLER).mutation(api.lotPayments.updateMyCollectionAddress, {
        address,
      });

    await expect(mutate("a".repeat(301))).rejects.toThrow("300");
    await expect(mutate("a".repeat(300))).resolves.toEqual({ success: true });
  });

  it("needs a profile", async () => {
    const t = makeContext();
    await seedWorld(t);
    await expect(
      as(t, "nobody").mutation(api.lotPayments.updateMyCollectionAddress, {
        address: "x",
      })
    ).rejects.toThrow();
  });
});

describe("getLotPaymentByLot", () => {
  it("finds a lot's record or null", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    const other = await insertLot(t, auctionId, { lotNumber: 2 });
    const payment = await pay(t, lotId, 10_000);

    expect((await t.run((ctx) => getLotPaymentByLot(ctx, lotId)))?._id).toBe(
      payment._id
    );
    expect(await t.run((ctx) => getLotPaymentByLot(ctx, other))).toBeNull();
  });
});

describe("guards around a paid sale", () => {
  /**
   * A sold lot with a payment record and its winning bid.
   *
   * @param t - Test context
   * @returns The lot id
   */
  async function soldLot(t: Ctx): Promise<Id<"lots">> {
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await insertBid(t, lotId, BUYER, 8000);
    await as(t, ADMIN).mutation(api.auctions.closeLotEarly, { lotId });
    return lotId;
  }

  it("refuses to refund a deposit already credited against a lot", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    await insertDeposit(t);
    const lotId = await insertLot(t, auctionId);
    await pay(t, lotId, 100_000);

    await expect(
      as(t, ADMIN).mutation(api.admin.registration.markDepositRefunded, {
        userId: BUYER,
      })
    ).rejects.toThrow("credited against a won lot");
    const deposit = await t.run((ctx) =>
      ctx.db.query("registrationDeposits").first()
    );
    expect(deposit?.status).toBe("received");
  });

  it("still refunds a received deposit that was never credited", async () => {
    const t = makeContext();
    await seedWorld(t);
    await insertDeposit(t);

    await as(t, ADMIN).mutation(api.admin.registration.markDepositRefunded, {
      userId: BUYER,
    });

    const deposit = await t.run((ctx) =>
      ctx.db.query("registrationDeposits").first()
    );
    expect(deposit?.status).toBe("refunded");
  });

  it("blocks moving a paid sold lot back to another status", async () => {
    const t = makeContext();
    const lotId = await soldLot(t);

    await expect(
      as(t, ADMIN).mutation(api.auctions.adminUpdateLot, {
        lotId,
        updates: { status: "assigned" },
      })
    ).rejects.toThrow("payment record");
    const bulk = await as(t, ADMIN).mutation(api.auctions.bulkUpdateLots, {
      lotIds: [lotId],
      updates: { status: "unsold" },
    });

    expect(bulk.skipped).toEqual([lotId]);
    expect(bulk.updated).toEqual([]);
    const lot = await t.run((ctx) => ctx.db.get("lots", lotId));
    expect(lot?.status).toBe("sold");
    // Editing other fields of a sold lot, or re-saving "sold", still works.
    await as(t, ADMIN).mutation(api.auctions.adminUpdateLot, {
      lotId,
      updates: { status: "sold", title: "Renamed" },
    });
  });

  it("lets a legacy sold lot without a payment change status", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, { status: "sold" });

    const bulk = await as(t, ADMIN).mutation(api.auctions.bulkUpdateLots, {
      lotIds: [lotId],
      updates: { status: "unsold" },
    });

    expect(bulk.updated).toEqual([lotId]);
  });

  it("syncLotWinners leaves a paid sold lot's winner alone", async () => {
    const t = makeContext();
    const lotId = await soldLot(t);
    await insertBid(t, lotId, OTHER, 9000);

    await as(t, ADMIN).mutation(api.admin.mutations.syncLotWinners, {});

    const lot = await t.run((ctx) => ctx.db.get("lots", lotId));
    expect(lot?.winnerId).toBe(BUYER);
  });

  it("creates no payment for a showcase demo bidder", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    const demo = DEMO_BIDDER_IDS[0];

    const created = await t.run(async (ctx) => {
      const lot = await ctx.db.get("lots", lotId);
      if (!lot) throw new Error("lot missing");
      return await createLotPayment(ctx, lot, demo, 10_000, FRIDAY);
    });

    expect(created).toBeNull();
    expect(await payments(t)).toHaveLength(0);
    expect(await notificationsFor(t, demo)).toHaveLength(0);
  });
});
