/// <reference types="vite/client" />

/**
 * Backend coverage of "Under consideration" (design D6): a lot that closes with
 * bids but below its reserve waits 48 hours for the seller to accept the top
 * bid. Runs the real mutations against an in-memory Convex backend.
 */

import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "../_generated/api";
import { CONSIDERATION_WINDOW_MS, SETTLEMENT_BATCH_SIZE } from "../constants";
import { cronSettingKey } from "../cronRegistry";
import schema from "../schema";
import type { Doc, Id } from "../_generated/dataModel";

const globbedModules = import.meta.glob("../**/*.*s");
const modules: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(globbedModules).map(([path, load]) => [
    path.startsWith("./") ? `../auctions/${path.slice(2)}` : path,
    load,
  ])
);

const SELLER = "user_seller";
const ADMIN = "user_admin";
const BIDDER_A = "user_bidder_a";
const BIDDER_B = "user_bidder_b";
const STRANGER = "user_stranger";

const MINUTE = 60_000;
const START_PRICE = 10_000;
const MIN_INCREMENT = 100;
/** Above every bid placed, so the reserve is never met. */
const RESERVE = 50_000;
const TOP_BID = START_PRICE + MIN_INCREMENT;

const createTestContext = () => convexTest(schema, modules);
type TestContext = ReturnType<typeof createTestContext>;

// Seeds profiles, counters, fee rows and a live auction.
async function seedWorld(t: TestContext) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const categoryId = await ctx.db.insert("equipmentCategories", {
      name: "Tractors",
      isActive: true,
    });
    const users: [string, "buyer" | "seller" | "admin"][] = [
      [SELLER, "seller"],
      [ADMIN, "admin"],
      [BIDDER_A, "buyer"],
      [BIDDER_B, "buyer"],
      [STRANGER, "buyer"],
    ];
    for (const [userId, role] of users) {
      await ctx.db.insert("profiles", {
        userId,
        name: userId,
        role,
        isVerified: true,
        kycStatus: "verified",
        createdAt: now,
        updatedAt: now,
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
    await ctx.db.insert("platformFees", {
      name: "Seller Commission",
      feeType: "percentage",
      value: 0.1,
      appliesTo: "seller",
      isActive: true,
      visibleToBuyer: false,
      visibleToSeller: true,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    });
    const auctionId = await ctx.db.insert("auctions", {
      title: "Consideration Sale",
      status: "published",
      startTime: now - 10 * MINUTE,
      endTime: now + 10 * MINUTE,
      createdBy: SELLER,
      createdAt: now,
      updatedAt: now,
    });
    return { categoryId, auctionId };
  });
}

// Inserts an `assigned` lot with the unmet reserve.
async function createLot(
  t: TestContext,
  world: { categoryId: Id<"equipmentCategories">; auctionId: Id<"auctions"> },
  lotNumber = 1
) {
  return await t.run(async (ctx) => {
    const counter = await ctx.db.query("counters").first();
    if (counter) {
      await ctx.db.patch("counters", counter._id, { active: 1, total: 1 });
    }
    return await ctx.db.insert("lots", {
      title: "John Deere 8R",
      make: "John Deere",
      model: "8R",
      year: 2020,
      operatingHours: 1000,
      location: "Iowa",
      categoryId: world.categoryId,
      reservePrice: RESERVE,
      startingPrice: START_PRICE,
      currentPrice: START_PRICE,
      minIncrement: MIN_INCREMENT,
      sellerId: SELLER,
      status: "assigned",
      auctionId: world.auctionId,
      lotNumber,
      images: { additional: [] },
      createdAt: Date.now(),
    });
  });
}

// Places a bid as `subject`, releasing the cooldown first.
async function placeBid(
  t: TestContext,
  subject: string,
  lotId: Id<"lots">,
  amount: number
) {
  await t.run(async (ctx) => {
    const cooldown = await ctx.db
      .query("bidCooldowns")
      .withIndex("by_userId", (q) => q.eq("userId", subject))
      .unique();
    if (cooldown) {
      await ctx.db.patch("bidCooldowns", cooldown._id, { lastBidAt: 0 });
    }
  });
  await t
    .withIdentity({ subject })
    .mutation(api.auctions.mutations.bidding.placeBid, { lotId, amount });
}

// Ends the sale and runs the settlement cron.
async function closeAndSettle(t: TestContext, auctionId: Id<"auctions">) {
  await t.run(async (ctx) => {
    await ctx.db.patch("auctions", auctionId, { endTime: Date.now() - 1_000 });
  });
  return await t.mutation(internal.auctions.internal.settleExpiredLots, {});
}

// A lot that closed under consideration with BIDDER_A on top.
async function seedConsideration(t: TestContext) {
  const world = await seedWorld(t);
  const lotId = await createLot(t, world);
  await placeBid(t, BIDDER_B, lotId, START_PRICE);
  await placeBid(t, BIDDER_A, lotId, TOP_BID);
  await closeAndSettle(t, world.auctionId);
  return { world, lotId };
}

async function readLot(t: TestContext, lotId: Id<"lots">) {
  return await t.run(async (ctx) => {
    const lot = await ctx.db.get("lots", lotId);
    if (!lot) throw new Error("lot missing");
    return lot;
  });
}

async function readFees(t: TestContext, lotId: Id<"lots">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("lotFees")
      .withIndex("by_lot", (q) => q.eq("lotId", lotId))
      .collect()
  );
}

async function readCounters(t: TestContext) {
  return await t.run(async (ctx) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "lots"))
      .unique();
    if (!counter) throw new Error("lots counter missing");
    return counter;
  });
}

async function notificationsFor(t: TestContext, userId: string) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .collect()
  );
}

async function auditActions(t: TestContext): Promise<string[]> {
  return await t.run(async (ctx) =>
    (await ctx.db.query("auditLogs").collect()).map((row) => row.action)
  );
}

// Moves the deadline into the past.
async function backdateDeadline(t: TestContext, lotId: Id<"lots">) {
  await t.run(async (ctx) => {
    await ctx.db.patch("lots", lotId, {
      considerationDeadline: Date.now() - 1_000,
    });
  });
}

const accept = (t: TestContext, subject: string, lotId: Id<"lots">) =>
  t
    .withIdentity({ subject })
    .mutation(api.auctions.acceptTopBid, { lotId, expectedAmount: TOP_BID });
const decline = (t: TestContext, subject: string, lotId: Id<"lots">) =>
  t.withIdentity({ subject }).mutation(api.auctions.declineTopBid, { lotId });

describe("settlement routing", () => {
  it("moves a reserve-not-met lot with bids to under_consideration", async () => {
    const t = createTestContext();
    const { world, lotId } = await seedConsideration(t);

    const lot: Doc<"lots"> = await readLot(t, lotId);
    expect(lot.status).toBe("under_consideration");
    expect(lot.winnerId).toBe(BIDDER_A);
    expect(lot.currentPrice).toBe(TOP_BID);
    expect(lot.auctionId).toBe(world.auctionId);
    expect(lot.lotNumber).toBe(1);
    expect(lot.considerationDeadline).toBeGreaterThan(
      Date.now() + CONSIDERATION_WINDOW_MS - 5_000
    );
    expect(lot.considerationDeadline).toBeLessThanOrEqual(
      Date.now() + CONSIDERATION_WINDOW_MS
    );
  });

  it("charges no fees and counts nothing as sold yet", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);

    expect(await readFees(t, lotId)).toHaveLength(0);
    const counters = await readCounters(t);
    expect(counters.active).toBe(0);
    expect(counters.soldCount).toBe(0);
    expect(counters.salesVolume).toBe(0);
  });

  it("notifies the seller and the top bidder", async () => {
    const t = createTestContext();
    await seedConsideration(t);

    const seller = await notificationsFor(t, SELLER);
    const bidder = await notificationsFor(t, BIDDER_A);
    expect(seller.map((n) => n.title)).toContain("Decide on the top bid");
    expect(bidder.map((n) => n.title)).toContain("Your bid is with the seller");
    expect(await notificationsFor(t, BIDDER_B)).toHaveLength(0);
  });

  it("still sends a lot with no bids to unsold", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);
    await closeAndSettle(t, world.auctionId);

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("unsold");
    expect(lot.considerationDeadline).toBeUndefined();
  });

  it("routes an admin early close the same way", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);
    await placeBid(t, BIDDER_A, lotId, START_PRICE);

    const result = await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.auctions.closeLotEarly, { lotId });

    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe("under_consideration");
    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("under_consideration");
    expect(lot.winnerId).toBe(BIDDER_A);
    expect(await readFees(t, lotId)).toHaveLength(0);
  });

  it("routes an admin container close the same way", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);
    await placeBid(t, BIDDER_A, lotId, START_PRICE);

    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.auctions.mutations.adminCrud.closeAuctionContainer, {
        auctionId: world.auctionId,
      });

    expect((await readLot(t, lotId)).status).toBe("under_consideration");
  });
});

describe("acceptTopBid", () => {
  it("sells to the top bidder at their bid and settles fees once", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);

    const result = await accept(t, SELLER, lotId);

    expect(result).toEqual({ status: "sold", expired: false });
    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("sold");
    expect(lot.winnerId).toBe(BIDDER_A);
    expect(lot.currentPrice).toBe(TOP_BID);
    expect(lot.considerationDeadline).toBeUndefined();

    const fees = await readFees(t, lotId);
    const buyer = fees.filter((f) => f.appliedTo === "buyer");
    const seller = fees.filter((f) => f.appliedTo === "seller");
    expect(buyer).toHaveLength(1);
    expect(seller).toHaveLength(1);
    expect(buyer[0].salePrice).toBe(TOP_BID);
    expect(buyer[0].calculatedAmount).toBeCloseTo(TOP_BID * 0.05, 2);
    expect(seller[0].calculatedAmount).toBeCloseTo(TOP_BID * 0.1, 2);

    const counters = await readCounters(t);
    expect(counters.soldCount).toBe(1);
    expect(counters.salesVolume).toBe(TOP_BID);
  });

  it("notifies both sides, audits it and logs activity", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    await accept(t, SELLER, lotId);

    expect((await notificationsFor(t, BIDDER_A)).map((n) => n.title)).toContain(
      "You won this lot"
    );
    expect((await notificationsFor(t, SELLER)).map((n) => n.title)).toContain(
      "Lot sold"
    );
    expect(await auditActions(t)).toContain("CONSIDERATION_ACCEPTED");
    const activity = await t.run(async (ctx) =>
      ctx.db.query("userActivity").collect()
    );
    expect(activity.map((a) => a.type)).toEqual(
      expect.arrayContaining(["listing_sold", "bid_won"])
    );
  });

  it("rejects a double accept without charging fees twice", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    await accept(t, SELLER, lotId);
    const feesAfterFirst = await readFees(t, lotId);
    const countersAfterFirst = await readCounters(t);

    await expect(accept(t, SELLER, lotId)).rejects.toThrow(
      /no longer awaiting a decision/
    );
    await expect(decline(t, SELLER, lotId)).rejects.toThrow(
      /no longer awaiting a decision/
    );

    expect(await readFees(t, lotId)).toHaveLength(feesAfterFirst.length);
    const counters = await readCounters(t);
    expect(counters.soldCount).toBe(countersAfterFirst.soldCount);
    expect(counters.salesVolume).toBe(countersAfterFirst.salesVolume);
    expect(counters.buyerTotal).toBe(countersAfterFirst.buyerTotal);
    expect((await readLot(t, lotId)).status).toBe("sold");
  });

  it("lets an admin accept", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);

    await accept(t, ADMIN, lotId);

    expect((await readLot(t, lotId)).status).toBe("sold");
    const audit = await t.run(async (ctx) =>
      ctx.db.query("auditLogs").collect()
    );
    const row = audit.find((a) => a.action === "CONSIDERATION_ACCEPTED");
    expect(row?.adminId).toBe(ADMIN);
    expect(row?.details).toContain('"actor":"admin"');
  });

  it("settles it as expired instead of accepting once the deadline has passed", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    await backdateDeadline(t, lotId);

    expect(await accept(t, SELLER, lotId)).toEqual({
      status: "unsold",
      expired: true,
    });

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("unsold");
    expect(lot.considerationDeadline).toBeUndefined();
    expect(await readFees(t, lotId)).toHaveLength(0);
    expect((await readCounters(t)).soldCount).toBe(0);
    expect(await auditActions(t)).toContain("CONSIDERATION_EXPIRED");
    expect(await auditActions(t)).not.toContain("CONSIDERATION_ACCEPTED");
  });

  it("refuses a no-bid accept instead of reporting a successful unsold", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    await t.run(async (ctx) => {
      for (const bid of await ctx.db
        .query("bids")
        .withIndex("by_lot", (q) => q.eq("lotId", lotId))
        .collect()) {
        await ctx.db.patch("bids", bid._id, { status: "voided" });
      }
    });

    await expect(accept(t, SELLER, lotId)).rejects.toThrow(/no valid bid left/);
    expect((await readLot(t, lotId)).status).toBe("under_consideration");
    expect(await readFees(t, lotId)).toHaveLength(0);
  });

  it("refuses a stale amount when the top bid was voided, then sells at the new top", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    const topBidId = await t.run(async (ctx) => {
      const top = await ctx.db
        .query("bids")
        .withIndex("by_lot_amount", (q) => q.eq("lotId", lotId))
        .order("desc")
        .first();
      if (!top) throw new Error("no bids");
      await ctx.db.patch("bids", top._id, { status: "voided" });
      return top._id;
    });
    expect(topBidId).toBeDefined();

    // The seller still sees the old R amount: nothing is sold at it.
    await expect(accept(t, SELLER, lotId)).rejects.toThrow(
      /top bid has changed/
    );
    expect((await readLot(t, lotId)).status).toBe("under_consideration");
    expect(await readFees(t, lotId)).toHaveLength(0);

    await t
      .withIdentity({ subject: SELLER })
      .mutation(api.auctions.acceptTopBid, {
        lotId,
        expectedAmount: START_PRICE,
      });
    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("sold");
    expect(lot.winnerId).toBe(BIDDER_B);
    expect(lot.currentPrice).toBe(START_PRICE);
  });
});

describe("declineTopBid", () => {
  it("makes the lot unsold with no fees and releases the sale slot", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);

    expect(await decline(t, SELLER, lotId)).toEqual({
      status: "unsold",
      expired: false,
    });

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("unsold");
    expect(lot.winnerId).toBeUndefined();
    expect(lot.auctionId).toBeUndefined();
    expect(lot.considerationDeadline).toBeUndefined();
    expect(await readFees(t, lotId)).toHaveLength(0);
    expect((await readCounters(t)).soldCount).toBe(0);
    expect(await auditActions(t)).toContain("CONSIDERATION_DECLINED");
    expect((await notificationsFor(t, BIDDER_A)).map((n) => n.title)).toContain(
      "Not sold"
    );
    expect((await notificationsFor(t, SELLER)).map((n) => n.title)).toContain(
      "Lot not sold"
    );
  });

  it("lets an admin decline", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    await decline(t, ADMIN, lotId);
    expect((await readLot(t, lotId)).status).toBe("unsold");
  });

  it("lets an admin clear a lot stuck past its deadline", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    await backdateDeadline(t, lotId);

    expect(await decline(t, ADMIN, lotId)).toEqual({
      status: "unsold",
      expired: true,
    });
    expect((await readLot(t, lotId)).status).toBe("unsold");
    expect(await auditActions(t)).toContain("CONSIDERATION_EXPIRED");
  });
});

describe("guards around a lot under consideration", () => {
  it("refuses bids once the lot is closed early, even inside the sale window", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);
    await placeBid(t, BIDDER_A, lotId, START_PRICE);
    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.auctions.closeLotEarly, { lotId });

    await expect(
      placeBid(t, BIDDER_B, lotId, START_PRICE + 5 * MIN_INCREMENT)
    ).rejects.toThrow(/no longer open for bidding/);
    expect((await readLot(t, lotId)).winnerId).toBe(BIDDER_A);
  });

  it("will not let an admin status edit bypass accept/decline", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    const asAdmin = t.withIdentity({ subject: ADMIN });

    await expect(
      asAdmin.mutation(api.auctions.adminUpdateLot, {
        lotId,
        updates: { status: "sold" },
      })
    ).rejects.toThrow(/under consideration/);

    const bulk = await asAdmin.mutation(api.auctions.bulkUpdateLots, {
      lotIds: [lotId],
      updates: { status: "unsold" },
    });
    expect(bulk.updated).toEqual([]);
    expect(bulk.skipped).toEqual([lotId]);
    expect((await readLot(t, lotId)).status).toBe("under_consideration");
    expect(await readFees(t, lotId)).toHaveLength(0);
  });

  it("re-points the lot at the highest remaining bid when an admin voids the top bid", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    const topBid = await t.run(async (ctx) =>
      ctx.db
        .query("bids")
        .withIndex("by_lot_amount", (q) => q.eq("lotId", lotId))
        .order("desc")
        .first()
    );
    if (!topBid) throw new Error("no bids");

    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.admin.mutations.voidBid, {
        bidId: topBid._id,
        reason: "shill bid",
      });

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("under_consideration");
    expect(lot.winnerId).toBe(BIDDER_B);
    expect(lot.currentPrice).toBe(START_PRICE);
  });

  it("tells the new top bidder when a void hands them the lot", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    const topBid = await t.run(async (ctx) =>
      ctx.db
        .query("bids")
        .withIndex("by_lot_amount", (q) => q.eq("lotId", lotId))
        .order("desc")
        .first()
    );
    if (!topBid) throw new Error("no bids");
    const before = (await notificationsFor(t, BIDDER_B)).length;

    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.admin.mutations.voidBid, {
        bidId: topBid._id,
        reason: "shill bid",
      });

    const after = await notificationsFor(t, BIDDER_B);
    expect(after).toHaveLength(before + 1);
    expect(after[after.length - 1]?.title).toBe("Your bid is with the seller");
  });

  it("records the real bid count when an admin closes below reserve early", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);
    await placeBid(t, BIDDER_A, lotId, START_PRICE);
    await placeBid(t, BIDDER_B, lotId, START_PRICE + MIN_INCREMENT);
    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.auctions.closeLotEarly, { lotId });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("auditLogs").collect()
    );
    const row = rows.find((r) => r.action === "auction_early_closure");
    expect(row?.details).toContain('"bidCount":2');
  });

  it("closes it as not sold when an admin voids the last valid bid", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);
    await placeBid(t, BIDDER_A, lotId, START_PRICE);
    await closeAndSettle(t, world.auctionId);
    const bid = await t.run(async (ctx) =>
      ctx.db
        .query("bids")
        .withIndex("by_lot", (q) => q.eq("lotId", lotId))
        .first()
    );
    if (!bid) throw new Error("no bids");

    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.admin.mutations.voidBid, {
        bidId: bid._id,
        reason: "invalid",
      });

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("unsold");
    expect(lot.winnerId).toBeUndefined();
    expect(await readFees(t, lotId)).toHaveLength(0);
    expect(await auditActions(t)).toContain("CONSIDERATION_DECLINED");
  });
});

describe("authorisation", () => {
  it("rejects signed-out callers", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);

    await expect(
      t.mutation(api.auctions.acceptTopBid, { lotId, expectedAmount: TOP_BID })
    ).rejects.toThrow(/Not authenticated/);
    await expect(
      t.mutation(api.auctions.declineTopBid, { lotId })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("rejects the top bidder and strangers", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);

    for (const user of [BIDDER_A, STRANGER]) {
      await expect(accept(t, user, lotId)).rejects.toThrow(
        /seller or an admin/
      );
      await expect(decline(t, user, lotId)).rejects.toThrow(
        /seller or an admin/
      );
    }
    expect((await readLot(t, lotId)).status).toBe("under_consideration");
    expect(await readFees(t, lotId)).toHaveLength(0);
  });

  it("rejects a lot that is not under consideration", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    await expect(accept(t, SELLER, lotId)).rejects.toThrow(
      /no longer awaiting a decision/
    );
  });

  it("rejects a missing lot", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    await t.run(async (ctx) => {
      await ctx.db.delete("lots", lotId);
    });
    await expect(accept(t, SELLER, lotId)).rejects.toThrow(/Lot not found/);
  });
});

describe("expiry job", () => {
  const expire = (t: TestContext) =>
    t.mutation(internal.auctions.internal.expireConsiderationLots, {});

  it("turns overdue lots into unsold and leaves the rest", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world, 1);
    const second = await createLot(t, world, 2);
    await placeBid(t, BIDDER_A, lotId, START_PRICE);
    await placeBid(t, BIDDER_A, second, START_PRICE);
    await closeAndSettle(t, world.auctionId);
    await backdateDeadline(t, lotId);

    const result = await expire(t);

    expect(result.expired).toBe(1);
    expect((await readLot(t, lotId)).status).toBe("unsold");
    expect((await readLot(t, lotId)).winnerId).toBeUndefined();
    expect(await readFees(t, lotId)).toHaveLength(0);
    expect(await auditActions(t)).toContain("CONSIDERATION_EXPIRED");
    expect((await notificationsFor(t, BIDDER_A)).map((n) => n.title)).toContain(
      "Not sold"
    );
    const stillWaiting = await readLot(t, second);
    expect(stillWaiting.status).toBe("under_consideration");
  });

  it("is idempotent", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    await backdateDeadline(t, lotId);

    expect((await expire(t)).expired).toBe(1);
    const notifications = (await notificationsFor(t, SELLER)).length;
    expect(await expire(t)).toEqual({ expired: 0, hasMore: false });
    expect((await notificationsFor(t, SELLER)).length).toBe(notifications);
  });

  it("does nothing before the deadline", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    expect(await expire(t)).toEqual({ expired: 0, hasMore: false });
    expect((await readLot(t, lotId)).status).toBe("under_consideration");
  });

  it("is bounded per run and reports more work", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < SETTLEMENT_BATCH_SIZE + 3; i++) {
        await ctx.db.insert("lots", {
          title: `Lot ${String(i)}`,
          make: "Make",
          model: "Model",
          year: 2020,
          operatingHours: 1,
          location: "Iowa",
          categoryId: world.categoryId,
          reservePrice: RESERVE,
          startingPrice: START_PRICE,
          currentPrice: START_PRICE,
          minIncrement: MIN_INCREMENT,
          sellerId: SELLER,
          status: "under_consideration",
          winnerId: BIDDER_A,
          considerationDeadline: Date.now() - 1_000 - i,
          images: { additional: [] },
          createdAt: Date.now(),
        });
      }
    });

    const first = await t.mutation(
      internal.auctions.internal.expireConsiderationLots,
      {}
    );
    expect(first).toEqual({ expired: SETTLEMENT_BATCH_SIZE, hasMore: true });
  });

  it("loses a race to an earlier accept without double-charging", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    await accept(t, SELLER, lotId);
    const fees = (await readFees(t, lotId)).length;
    // The deadline would have passed, but the lot is already sold.
    await backdateDeadline(t, lotId);

    expect((await expire(t)).expired).toBe(0);

    expect((await readLot(t, lotId)).status).toBe("sold");
    expect(await readFees(t, lotId)).toHaveLength(fees);
  });

  describe("when the cron is switched off", () => {
    const disableCron = async (t: TestContext) => {
      await t.run(async (ctx) => {
        await ctx.db.insert("settings", {
          key: cronSettingKey("expire_consideration_lots"),
          value: false,
          description: "test",
          updatedAt: Date.now(),
        });
      });
    };

    it("leaves overdue lots alone but the seller can still clear them", async () => {
      const t = createTestContext();
      const { lotId } = await seedConsideration(t);
      await backdateDeadline(t, lotId);
      await disableCron(t);

      const result = await t.mutation(
        internal.cronJobs.expireConsiderationLots,
        {}
      );
      expect(result).toEqual({ expired: 0, hasMore: false });
      expect((await readLot(t, lotId)).status).toBe("under_consideration");

      // Not stuck: the first decision attempt settles it as expired.
      expect(await accept(t, SELLER, lotId)).toEqual({
        status: "unsold",
        expired: true,
      });
      expect((await readLot(t, lotId)).status).toBe("unsold");
    });

    it("keeps a backlog chain on the gated wrapper so the toggle stops it", async () => {
      const t = createTestContext();
      const world = await seedWorld(t);
      await t.run(async (ctx) => {
        for (let i = 0; i < SETTLEMENT_BATCH_SIZE + 2; i++) {
          await ctx.db.insert("lots", {
            title: `Lot ${String(i)}`,
            make: "Make",
            model: "Model",
            year: 2020,
            operatingHours: 1,
            location: "Iowa",
            categoryId: world.categoryId,
            reservePrice: RESERVE,
            startingPrice: START_PRICE,
            currentPrice: START_PRICE,
            minIncrement: MIN_INCREMENT,
            sellerId: SELLER,
            status: "under_consideration",
            winnerId: BIDDER_A,
            considerationDeadline: Date.now() - 1_000 - i,
            images: { additional: [] },
            createdAt: Date.now(),
          });
        }
      });

      const first = await t.mutation(
        internal.cronJobs.expireConsiderationLots,
        {}
      );
      expect(first.hasMore).toBe(true);

      const scheduled = await t.run(async (ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      );
      expect(scheduled.map((job) => job.name)).toContain(
        "cronJobs:expireConsiderationLots"
      );
    });
  });

  it("wins against a late accept", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);
    await backdateDeadline(t, lotId);
    await expire(t);

    await expect(accept(t, SELLER, lotId)).rejects.toThrow(
      /no longer awaiting a decision/
    );
    expect(await readFees(t, lotId)).toHaveLength(0);
    expect((await readCounters(t)).soldCount).toBe(0);
  });
});

describe("public queries", () => {
  it("counts the lot as under consideration, not sold, in the sale facets", async () => {
    const t = createTestContext();
    const { world } = await seedConsideration(t);
    // Keep the sale visible: it has no assigned lots left, so it can close.
    const facets = await t.query(api.auctions.getEventFacets, {
      auctionId: world.auctionId,
    });

    expect(facets.total).toBe(1);
    expect(facets.outcomes).toEqual({
      sold: 0,
      notSold: 0,
      underConsideration: 1,
      soldTotal: 0,
    });
  });

  it("lists it with its status and filters by outcome", async () => {
    const t = createTestContext();
    const { world } = await seedConsideration(t);

    const all = await t.query(api.auctions.getEventLots, {
      auctionId: world.auctionId,
    });
    expect(all.lots.map((l) => l.status)).toEqual(["under_consideration"]);
    expect(all.lots[0].currentPrice).toBe(TOP_BID);
    expect(all.lots[0].reserveState).toBe("none");

    const filtered = await t.query(api.auctions.getEventLots, {
      auctionId: world.auctionId,
      outcome: "under_consideration",
    });
    expect(filtered.matched).toBe(1);
    const sold = await t.query(api.auctions.getEventLots, {
      auctionId: world.auctionId,
      outcome: "sold",
    });
    expect(sold.matched).toBe(0);
  });

  it("exposes the deadline and winner flag on the lot page", async () => {
    const t = createTestContext();
    const { lotId } = await seedConsideration(t);

    const asBidder = await t
      .withIdentity({ subject: BIDDER_A })
      .query(api.auctions.getLotById, { lotId });
    expect(asBidder?.status).toBe("under_consideration");
    expect(asBidder?.isWinner).toBe(true);
    expect(asBidder?.considerationDeadline).toBeGreaterThan(Date.now());

    const asOther = await t
      .withIdentity({ subject: STRANGER })
      .query(api.auctions.getLotById, { lotId });
    expect(asOther?.isWinner).toBe(false);

    const asSeller = await t
      .withIdentity({ subject: SELLER })
      .query(api.auctions.getLotById, { lotId });
    expect(asSeller?.isSeller).toBe(true);
  });

  it("counts it in the seller's listing stats", async () => {
    const t = createTestContext();
    await seedConsideration(t);

    const stats = await t
      .withIdentity({ subject: SELLER })
      .query(api.auctions.getMyListingsStats, {});
    expect(stats.under_consideration).toBe(1);
    expect(stats.sold).toBe(0);
    expect(stats.unsold).toBe(0);
    expect(stats.all).toBe(1);
  });

  it("never leaks the reserve, seller or bidder ids in public payloads", async () => {
    const t = createTestContext();
    const { world, lotId } = await seedConsideration(t);

    const payloads = [
      await t.query(api.auctions.getEventLots, { auctionId: world.auctionId }),
      await t.query(api.auctions.getEventFacets, {
        auctionId: world.auctionId,
      }),
      await t.query(api.auctions.getLotById, { lotId }),
      await t.query(api.auctions.getActiveLots, {
        paginationOpts: { numItems: 10, cursor: null },
        statusFilter: "closed",
      }),
      await t
        .withIdentity({ subject: STRANGER })
        .query(api.auctions.getLotById, { lotId }),
    ];
    for (const payload of payloads) {
      const json = JSON.stringify(payload);
      expect(json).not.toContain(SELLER);
      expect(json).not.toContain(BIDDER_A);
      expect(json).not.toContain(BIDDER_B);
      expect(json).not.toContain(String(RESERVE));
      expect(json).not.toContain("reservePrice");
    }
  });

  it("shows closed browse results including it", async () => {
    const t = createTestContext();
    await seedConsideration(t);

    const page = await t.query(api.auctions.getActiveLots, {
      paginationOpts: { numItems: 10, cursor: null },
      statusFilter: "closed",
    });
    expect(page.page.map((l) => l.status)).toEqual(["under_consideration"]);
  });
});
