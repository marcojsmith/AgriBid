/// <reference types="vite/client" />

/**
 * End-to-end (backend) coverage of the money path: bid placement -> proxy bid
 * resolution -> soft-close extension -> settlement -> winner + fee records.
 *
 * Unlike the unit tests next door, nothing here mocks the database: every step
 * runs through the real mutations/internal functions against a real in-memory
 * Convex backend built from the production schema.
 */

import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "../_generated/api";
import { SOFT_CLOSE_THRESHOLD_MS } from "../constants";
import { VERIFIED_REQUIRED_MESSAGE } from "../lib/auth";
import schema from "../schema";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Convex functions are loaded through this glob, which must cover the whole
 * `convex/` directory (including `_generated`, from which convex-test derives
 * the module root prefix). `*.*s` matches both the `.ts` sources and the `.js`
 * files under `_generated`.
 */
const globbedModules = import.meta.glob("../**/*.*s");

/** Path of this directory relative to the `convex/` root. */
const THIS_DIR = "auctions/";

/**
 * `import.meta.glob` keys are relative to this file, and Vite rewrites matches
 * inside this directory to `./`-prefixed paths (`./proxy_bidding.ts`) while
 * keeping matches one level up as `../proxy_bidding.ts`. convex-test derives a
 * single root prefix (`../`) from the first `_generated` key and then looks
 * every module up beneath it, so the `./` keys are rebased onto that prefix
 * before the map is handed over.
 */
const modules: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(globbedModules).map(([path, load]) => [
    path.startsWith("./") ? `../${THIS_DIR}${path.slice(2)}` : path,
    load,
  ])
);

/** Clerk user id of the lot's seller. */
const SELLER = "user_seller";
/** Clerk user id of the platform admin (early closure only). */
const ADMIN = "user_admin";
/** Clerk user id of the first bidder. */
const BIDDER_A = "user_bidder_a";
/** Clerk user id of the second bidder. */
const BIDDER_B = "user_bidder_b";
/** Clerk user id of a signed-in but not-yet-verified bidder. */
const UNVERIFIED_BIDDER = "user_unverified";

/** A minute in milliseconds. */
const MINUTE = 60_000;
/** How long a seeded auction stays open by default (outside the soft-close window). */
const AUCTION_WINDOW_MS = 10 * MINUTE;
/** Tolerance for wall-clock derived timestamps (extension time, settledAt). */
const CLOCK_TOLERANCE_MS = 1_000;

/** Opening/current price of every seeded lot. */
const LOT_PRICE = 10_000;
/** Minimum increment of every seeded lot. */
const LOT_MIN_INCREMENT = 100;
/** Reserve price of every seeded lot that is expected to sell. */
const LOT_RESERVE_PRICE = 9_000;
/** The amount the second manual bid settles at in most scenarios. */
const SECOND_BID = LOT_PRICE + LOT_MIN_INCREMENT;

/** Platform fee fixture: 5% charged to the buyer. */
const BUYER_PREMIUM = { name: "Buyer Premium", rate: 0.05 };
/** Platform fee fixture: 10% charged to the seller. */
const SELLER_COMMISSION = { name: "Seller Commission", rate: 0.1 };
/** Platform fee fixture: a flat R50 charged to both sides. */
const HANDLING_FEE = { name: "Handling Fee", value: 50 };

/** Arguments accepted by the `placeBid` mutation. */
interface PlaceBidArgs {
  lotId: Id<"lots">;
  amount: number;
  maxBid?: number;
}

/**
 * Creates a fresh in-memory Convex backend backed by the real schema.
 *
 * @returns A convex-test context for a single scenario
 */
const createTestContext = () => convexTest(schema, modules);

type TestContext = ReturnType<typeof createTestContext>;

/** Everything a scenario needs to seed its fixtures. */
interface WorldOptions {
  /** Absolute end time of the seeded auction; defaults to well outside the soft-close window. */
  auctionEndTime?: number;
  /** Whether to seed the active platform fee fixtures; defaults to true. */
  withFees?: boolean;
  /** Value for the seeded `lots.active` counter; defaults to 1. */
  activeLots?: number;
}

/** The fixtures {@link seedWorld} created. */
interface World {
  categoryId: Id<"equipmentCategories">;
  auctionId: Id<"auctions">;
  auctionEndTime: number;
}

/** Optional overrides for {@link createLot}. */
interface LotOptions {
  title?: string;
  reservePrice?: number;
  startingPrice?: number;
  minIncrement?: number;
  sellerId?: string;
  resolvedBuyerPremiumPct?: number;
  resolvedSellerCommissionPct?: number;
}

/** A persisted `lotFees` ledger row, flattened for assertions. */
interface LotFeeRow {
  feeName: string;
  appliedTo: "buyer" | "seller";
  feeType: "percentage" | "fixed";
  rate: number;
  salePrice: number;
  calculatedAmount: number;
}

/**
 * Seeds the rows every scenario shares: an equipment category, one profile per
 * actor (seller/admin/bidders/unverified bidder), an `active`-seeded `lots`
 * counter and — unless disabled — the active platform fee fixtures.
 *
 * @param t - The convex-test context
 * @param options - See {@link WorldOptions}
 * @returns The created category and auction
 */
async function seedWorld(
  t: TestContext,
  options: WorldOptions = {}
): Promise<World> {
  const {
    auctionEndTime = Date.now() + AUCTION_WINDOW_MS,
    withFees = true,
    activeLots = 1,
  } = options;

  return await t.run(async (ctx) => {
    const categoryId = await ctx.db.insert("equipmentCategories", {
      name: "Tractors",
      isActive: true,
    });

    const users: {
      userId: string;
      role: "buyer" | "seller" | "admin";
      isVerified: boolean;
    }[] = [
      { userId: SELLER, role: "seller", isVerified: true },
      { userId: ADMIN, role: "admin", isVerified: true },
      { userId: BIDDER_A, role: "buyer", isVerified: true },
      { userId: BIDDER_B, role: "buyer", isVerified: true },
      { userId: UNVERIFIED_BIDDER, role: "buyer", isVerified: false },
    ];
    const seededAt = Date.now();
    for (const user of users) {
      await ctx.db.insert("profiles", {
        userId: user.userId,
        name: user.userId,
        role: user.role,
        isVerified: user.isVerified,
        kycStatus: user.isVerified ? "verified" : "pending",
        createdAt: seededAt,
        updatedAt: seededAt,
      });
    }

    await ctx.db.insert("counters", {
      name: "lots",
      total: activeLots,
      active: activeLots,
      soldCount: 0,
      salesVolume: 0,
      updatedAt: seededAt,
    });

    if (withFees) {
      await ctx.db.insert("platformFees", {
        name: BUYER_PREMIUM.name,
        feeType: "percentage",
        value: BUYER_PREMIUM.rate,
        appliesTo: "buyer",
        isActive: true,
        visibleToBuyer: true,
        visibleToSeller: false,
        sortOrder: 1,
        createdAt: seededAt,
        updatedAt: seededAt,
      });
      await ctx.db.insert("platformFees", {
        name: SELLER_COMMISSION.name,
        feeType: "percentage",
        value: SELLER_COMMISSION.rate,
        appliesTo: "seller",
        isActive: true,
        visibleToBuyer: false,
        visibleToSeller: true,
        sortOrder: 2,
        createdAt: seededAt,
        updatedAt: seededAt,
      });
      await ctx.db.insert("platformFees", {
        name: HANDLING_FEE.name,
        feeType: "fixed",
        value: HANDLING_FEE.value,
        appliesTo: "both",
        isActive: true,
        visibleToBuyer: true,
        visibleToSeller: true,
        sortOrder: 3,
        createdAt: seededAt,
        updatedAt: seededAt,
      });
      // Retired fee: settlement must ignore it because it is not active.
      await ctx.db.insert("platformFees", {
        name: "Retired Fee",
        feeType: "percentage",
        value: 0.99,
        appliesTo: "both",
        isActive: false,
        visibleToBuyer: false,
        visibleToSeller: false,
        sortOrder: 4,
        createdAt: seededAt,
        updatedAt: seededAt,
      });
    }

    const auctionId = await ctx.db.insert("auctions", {
      title: "Money Path Auction",
      status: "published",
      startTime: seededAt - AUCTION_WINDOW_MS,
      endTime: auctionEndTime,
      createdBy: SELLER,
      createdAt: seededAt,
      updatedAt: seededAt,
    });

    return { categoryId, auctionId, auctionEndTime };
  });
}

/**
 * Creates an `assigned` lot inside the seeded auction.
 *
 * @param t - The convex-test context
 * @param world - The fixtures returned by {@link seedWorld}
 * @param options - See {@link LotOptions}
 * @returns The id of the created lot
 */
async function createLot(
  t: TestContext,
  world: World,
  options: LotOptions = {}
): Promise<Id<"lots">> {
  const {
    title = "John Deere 8R",
    reservePrice = LOT_RESERVE_PRICE,
    startingPrice = LOT_PRICE,
    minIncrement = LOT_MIN_INCREMENT,
    sellerId = SELLER,
    resolvedBuyerPremiumPct,
    resolvedSellerCommissionPct,
  } = options;

  return await t.run(async (ctx) => {
    return await ctx.db.insert("lots", {
      title,
      make: "John Deere",
      model: "8R",
      year: 2020,
      operatingHours: 1000,
      location: "Iowa",
      categoryId: world.categoryId,
      reservePrice,
      startingPrice,
      currentPrice: startingPrice,
      minIncrement,
      sellerId,
      status: "assigned",
      auctionId: world.auctionId,
      resolvedBuyerPremiumPct,
      resolvedSellerCommissionPct,
      images: { additional: [] },
      createdAt: Date.now(),
    });
  });
}

/**
 * Backdates a bidder's per-user bid cooldown so the next `placeBid` call is not
 * rejected by the anti-spam rate limiter (issue #283). The cooldown itself is
 * covered by its own scenario; the money path scenarios would otherwise be
 * limited to one bid per bidder per second of wall clock.
 *
 * @param t - The convex-test context
 * @param userId - The bidder whose cooldown should be released
 */
async function releaseBidCooldown(
  t: TestContext,
  userId: string
): Promise<void> {
  await t.run(async (ctx) => {
    const cooldown = await ctx.db
      .query("bidCooldowns")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (cooldown) {
      await ctx.db.patch("bidCooldowns", cooldown._id, { lastBidAt: 0 });
    }
  });
}

/**
 * Places a bid as `subject`, releasing the bid cooldown first.
 *
 * @param t - The convex-test context
 * @param subject - Clerk user id of the bidder
 * @param lotId - Lot being bid on
 * @param amount - Bid amount
 * @param maxBid - Optional proxy maximum
 * @returns The mutation's result payload
 */
async function placeBid(
  t: TestContext,
  subject: string,
  lotId: Id<"lots">,
  amount: number,
  maxBid?: number
) {
  await releaseBidCooldown(t, subject);
  const args: PlaceBidArgs =
    maxBid === undefined ? { lotId, amount } : { lotId, amount, maxBid };
  return await t
    .withIdentity({ subject })
    .mutation(api.auctions.mutations.bidding.placeBid, args);
}

/**
 * Places two bids from two bidders: the second outbids the first by exactly
 * one minimum increment, the shape used by most settlement scenarios.
 *
 * @param t - The convex-test context
 * @param lotId - Lot being bid on
 */
async function placeTwoBids(t: TestContext, lotId: Id<"lots">): Promise<void> {
  await placeBid(t, BIDDER_B, lotId, LOT_PRICE);
  await placeBid(t, BIDDER_A, lotId, SECOND_BID);
}

/**
 * Moves the seeded auction's window into the past so the expiry cron considers
 * its lots settled-eligible.
 *
 * @param t - The convex-test context
 * @param auctionId - The auction whose window has elapsed
 */
async function expireAuction(
  t: TestContext,
  auctionId: Id<"auctions">
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.patch("auctions", auctionId, {
      endTime: Date.now() - 1_000,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Runs the expiry settlement cron.
 *
 * @param t - The convex-test context
 * @returns The cron's `{ settled, hasMore }` summary
 */
async function settleExpiredLots(t: TestContext) {
  return await t.mutation(internal.auctions.internal.settleExpiredLots, {});
}

/**
 * Closes an assigned lot early as the platform admin.
 *
 * @param t - The convex-test context
 * @param lotId - Lot to close
 * @returns The mutation's result payload
 */
async function closeLotEarlyAsAdmin(t: TestContext, lotId: Id<"lots">) {
  return await t
    .withIdentity({ subject: ADMIN })
    .mutation(api.auctions.mutations.publish.closeLotEarly, { lotId });
}

/**
 * Reads a lot back after a mutation has run.
 *
 * @param t - The convex-test context
 * @param lotId - Lot to read
 * @returns The current lot document
 */
async function readLot(
  t: TestContext,
  lotId: Id<"lots">
): Promise<Doc<"lots">> {
  return await t.run(async (ctx) => {
    const lot = await ctx.db.get("lots", lotId);
    if (!lot) throw new Error(`Lot ${lotId} disappeared`);
    return lot;
  });
}

/**
 * Reads every bid recorded on a lot.
 *
 * @param t - The convex-test context
 * @param lotId - Lot whose bids to read
 * @returns The bid documents, oldest first
 */
async function readBids(
  t: TestContext,
  lotId: Id<"lots">
): Promise<Doc<"bids">[]> {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("bids")
      .withIndex("by_lot", (q) => q.eq("lotId", lotId))
      .collect();
  });
}

/**
 * Reads the fee ledger rows of a lot, sorted for stable assertions.
 *
 * @param t - The convex-test context
 * @param lotId - Lot whose fee rows to read
 * @returns The flattened fee rows
 */
async function readLotFees(
  t: TestContext,
  lotId: Id<"lots">
): Promise<LotFeeRow[]> {
  return await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("lotFees")
      .withIndex("by_lot", (q) => q.eq("lotId", lotId))
      .collect();

    return rows
      .map((row) => ({
        feeName: row.feeName,
        appliedTo: row.appliedTo,
        feeType: row.feeType,
        rate: row.rate,
        salePrice: row.salePrice,
        calculatedAmount: row.calculatedAmount,
      }))
      .sort(
        (a, b) =>
          a.feeName.localeCompare(b.feeName) ||
          a.appliedTo.localeCompare(b.appliedTo)
      );
  });
}

/**
 * Reads a named aggregate counter.
 *
 * @param t - The convex-test context
 * @param name - Counter name, e.g. `lots` or `lotFees`
 * @returns The counter document, or null when it was never created
 */
async function readCounter(
  t: TestContext,
  name: string
): Promise<Doc<"counters"> | null> {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
  });
}

/**
 * Reads the activity-feed entries recorded for a user.
 *
 * @param t - The convex-test context
 * @param userId - Owner of the activity entries
 * @returns The recorded activity types, oldest first
 */
async function readActivityTypes(
  t: TestContext,
  userId: string
): Promise<string[]> {
  return await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("userActivity")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((row) => row.type);
  });
}

/**
 * Reads every audit log entry's action.
 *
 * @param t - The convex-test context
 * @returns The recorded audit actions
 */
async function readAuditActions(t: TestContext): Promise<string[]> {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("auditLogs").collect();
    return rows.map((row) => row.action);
  });
}

/**
 * Marks a lot's highest bid as voided, simulating a bid cancelled after the fact.
 *
 * @param t - The convex-test context
 * @param bidId - Bid to void
 */
async function voidBid(t: TestContext, bidId: Id<"bids">): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.patch("bids", bidId, { status: "voided" });
  });
}

describe("bid placement (convex-test)", () => {
  it("records a valid bidding sequence and keeps the highest bid on the lot", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    const opening = await placeBid(t, BIDDER_B, lotId, LOT_PRICE);
    expect(opening).toEqual({
      success: true,
      nextBidAmount: null,
      isProxyBid: false,
      proxyBidActive: false,
      confirmedMaxBid: undefined,
    });

    const outbid = await placeBid(t, BIDDER_A, lotId, SECOND_BID);
    expect(outbid.success).toBe(true);
    expect(outbid.isProxyBid).toBe(false);

    const lot = await readLot(t, lotId);
    expect(lot.currentPrice).toBe(SECOND_BID);
    expect(lot.winnerId).toBe(BIDDER_A);
    expect(lot.status).toBe("assigned");

    const bids = await readBids(t, lotId);
    expect(bids.map((bid) => [bid.bidderId, bid.amount, bid.status])).toEqual([
      [BIDDER_B, LOT_PRICE, "valid"],
      [BIDDER_A, SECOND_BID, "valid"],
    ]);

    // Both bidders get a bid_placed entry; nobody has won anything yet.
    expect(await readActivityTypes(t, BIDDER_A)).toEqual(["bid_placed"]);
    expect(await readActivityTypes(t, BIDDER_B)).toEqual(["bid_placed"]);
  });

  it("rejects a bid below the minimum increment and leaves the lot untouched", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    await placeBid(t, BIDDER_B, lotId, LOT_PRICE);

    await expect(
      placeBid(t, BIDDER_A, lotId, LOT_PRICE + LOT_MIN_INCREMENT - 50)
    ).rejects.toThrow(
      `Bid amount must be at least R${String(LOT_PRICE + LOT_MIN_INCREMENT)}`
    );

    const lot = await readLot(t, lotId);
    expect(lot.currentPrice).toBe(LOT_PRICE);
    expect(lot.winnerId).toBe(BIDDER_B);
    expect(await readBids(t, lotId)).toHaveLength(1);
  });

  it("rejects the seller's own bid, anonymous callers and unverified bidders", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    await expect(placeBid(t, SELLER, lotId, LOT_PRICE)).rejects.toThrow(
      "Sellers cannot bid on their own auction"
    );

    await expect(
      t.mutation(api.auctions.mutations.bidding.placeBid, {
        lotId,
        amount: LOT_PRICE,
      })
    ).rejects.toThrow("Authenticated profile not found");

    await expect(
      placeBid(t, UNVERIFIED_BIDDER, lotId, LOT_PRICE)
    ).rejects.toThrow(VERIFIED_REQUIRED_MESSAGE);

    expect(await readBids(t, lotId)).toHaveLength(0);
    const lot = await readLot(t, lotId);
    expect(lot.currentPrice).toBe(LOT_PRICE);
    expect(lot.winnerId).toBeUndefined();
  });

  it("rate limits a bidder's rapid repeat bids", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    await placeBid(t, BIDDER_A, lotId, LOT_PRICE);

    // Second call without releasing the cooldown the first call recorded.
    await expect(
      t
        .withIdentity({ subject: BIDDER_A })
        .mutation(api.auctions.mutations.bidding.placeBid, {
          lotId,
          amount: SECOND_BID,
        })
    ).rejects.toThrow(/You're bidding too fast/);

    expect(await readBids(t, lotId)).toHaveLength(1);
  });

  it("refuses bids once the lot's effective end time has passed", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    await placeBid(t, BIDDER_A, lotId, LOT_PRICE);
    await expireAuction(t, world.auctionId);

    await expect(placeBid(t, BIDDER_B, lotId, SECOND_BID)).rejects.toThrow(
      "Auction ended"
    );
    expect(await readBids(t, lotId)).toHaveLength(1);
  });
});

describe("proxy bidding (convex-test)", () => {
  it("auto-bids up to the maximum, then concedes to a higher manual bid", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    const maxBid = 20_000;
    const opening = await placeBid(t, BIDDER_A, lotId, LOT_PRICE, maxBid);
    expect(opening).toEqual({
      success: true,
      nextBidAmount: LOT_PRICE + LOT_MIN_INCREMENT,
      isProxyBid: false,
      proxyBidActive: true,
      confirmedMaxBid: maxBid,
    });

    // A manual bid below the proxy maximum is answered automatically.
    const challenged = await placeBid(t, BIDDER_B, lotId, 12_000);
    expect(challenged).toEqual({
      success: true,
      nextBidAmount: null,
      isProxyBid: true,
      proxyBidActive: false,
      confirmedMaxBid: undefined,
    });

    let lot = await readLot(t, lotId);
    expect(lot.currentPrice).toBe(12_000 + LOT_MIN_INCREMENT);
    expect(lot.winnerId).toBe(BIDDER_A);

    const afterChallenge = await readBids(t, lotId);
    expect(afterChallenge.map((bid) => [bid.bidderId, bid.amount])).toEqual([
      [BIDDER_A, LOT_PRICE],
      [BIDDER_B, 12_000],
      [BIDDER_A, 12_000 + LOT_MIN_INCREMENT],
    ]);

    // A manual bid above the proxy maximum wins; the proxy does not follow.
    const winning = await placeBid(t, BIDDER_B, lotId, maxBid + 500);
    expect(winning.isProxyBid).toBe(false);
    expect(winning.proxyBidActive).toBe(false);

    lot = await readLot(t, lotId);
    expect(lot.currentPrice).toBe(maxBid + 500);
    expect(lot.winnerId).toBe(BIDDER_B);

    const afterWin = await readBids(t, lotId);
    expect(afterWin).toHaveLength(4);
    expect(afterWin.filter((bid) => bid.bidderId === BIDDER_A)).toHaveLength(2);
  });

  it("gives a tied proxy maximum to the bidder who registered it first", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    const tiedMax = 15_000;
    await placeBid(t, BIDDER_A, lotId, LOT_PRICE, tiedMax);
    const second = await placeBid(t, BIDDER_B, lotId, 11_000, tiedMax);

    // The tie is broken in favour of the earlier proxy, which auto-bids its
    // whole maximum because the challenger shares it.
    expect(second.isProxyBid).toBe(true);
    expect(second.proxyBidActive).toBe(false);

    const lot = await readLot(t, lotId);
    expect(lot.currentPrice).toBe(tiedMax);
    expect(lot.winnerId).toBe(BIDDER_A);

    const bids = await readBids(t, lotId);
    const lastBid = bids[bids.length - 1];
    expect(lastBid.bidderId).toBe(BIDDER_A);
    expect(lastBid.amount).toBe(tiedMax);
  });
});

describe("soft close (convex-test)", () => {
  it("extends the lot end time when a bid lands inside the closing window", async () => {
    const t = createTestContext();
    const auctionEndTime = Date.now() + MINUTE;
    const world = await seedWorld(t, { auctionEndTime });
    const lotId = await createLot(t, world);

    const bidAt = Date.now();
    await placeBid(t, BIDDER_A, lotId, LOT_PRICE);

    const lot = await readLot(t, lotId);
    expect(lot.isExtended).toBe(true);
    expect(lot.extendedEndTime).toBeGreaterThan(auctionEndTime);
    expect(lot.extendedEndTime).toBeGreaterThanOrEqual(
      bidAt + SOFT_CLOSE_THRESHOLD_MS - CLOCK_TOLERANCE_MS
    );
    expect(lot.extendedEndTime).toBeLessThanOrEqual(
      Date.now() + SOFT_CLOSE_THRESHOLD_MS + CLOCK_TOLERANCE_MS
    );
  });

  it("leaves the end time alone for a bid outside the closing window", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    await placeBid(t, BIDDER_A, lotId, LOT_PRICE);

    const lot = await readLot(t, lotId);
    expect(lot.extendedEndTime).toBeUndefined();
    expect(lot.isExtended).toBeUndefined();
  });

  it("settles nothing while an anti-snipe extension is still running", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    await placeBid(t, BIDDER_A, lotId, LOT_PRICE);
    await t.run(async (ctx) => {
      await ctx.db.patch("lots", lotId, {
        extendedEndTime: Date.now() + SOFT_CLOSE_THRESHOLD_MS,
        isExtended: true,
      });
    });
    await expireAuction(t, world.auctionId);

    expect(await settleExpiredLots(t)).toEqual({ settled: 0, hasMore: false });

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("assigned");
    expect(lot.settledAt).toBeUndefined();
    expect(await readLotFees(t, lotId)).toEqual([]);
  });
});

describe("settlement (convex-test)", () => {
  it("sells a reserved lot, records the winner, the fees and the counters", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    await placeTwoBids(t, lotId);
    await expireAuction(t, world.auctionId);

    expect(await settleExpiredLots(t)).toEqual({ settled: 1, hasMore: false });

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("sold");
    expect(lot.winnerId).toBe(BIDDER_A);
    expect(lot.currentPrice).toBe(SECOND_BID);
    expect(lot.auctionId).toBe(world.auctionId);
    expect(lot.settledAt).toBeGreaterThan(0);

    // 5% of 10 100 + R50 handling for the buyer, 10% + R50 for the seller.
    expect(await readLotFees(t, lotId)).toEqual([
      {
        feeName: "Buyer Premium",
        appliedTo: "buyer",
        feeType: "percentage",
        rate: 0.05,
        salePrice: SECOND_BID,
        calculatedAmount: 505,
      },
      {
        feeName: "Handling Fee",
        appliedTo: "buyer",
        feeType: "fixed",
        rate: 50,
        salePrice: SECOND_BID,
        calculatedAmount: 50,
      },
      {
        feeName: "Handling Fee",
        appliedTo: "seller",
        feeType: "fixed",
        rate: 50,
        salePrice: SECOND_BID,
        calculatedAmount: 50,
      },
      {
        feeName: "Seller Commission",
        appliedTo: "seller",
        feeType: "percentage",
        rate: 0.1,
        salePrice: SECOND_BID,
        calculatedAmount: 1010,
      },
    ]);

    const lotsCounter = await readCounter(t, "lots");
    expect(lotsCounter?.soldCount).toBe(1);
    expect(lotsCounter?.salesVolume).toBe(SECOND_BID);
    expect(lotsCounter?.active).toBe(0);

    const feeCounter = await readCounter(t, "lotFees");
    expect(feeCounter?.buyerTotal).toBe(555);
    expect(feeCounter?.sellerTotal).toBe(1060);

    expect(await readActivityTypes(t, SELLER)).toContain("listing_sold");
    expect(await readActivityTypes(t, BIDDER_A)).toContain("bid_won");
    expect(await readActivityTypes(t, BIDDER_B)).not.toContain("bid_won");

    expect(await readAuditActions(t)).toContain("CALCULATE_FEES");

    // The container closes once no assigned lot is left.
    const auction = await t.run(async (ctx) => {
      const row = await ctx.db.get("auctions", world.auctionId);
      if (!row) throw new Error("auction disappeared");
      return row;
    });
    expect(auction.status).toBe("closed");
  });

  it("returns an unsold lot to the pool when the reserve is not met", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world, {
      reservePrice: LOT_PRICE + 1_000,
    });

    await placeTwoBids(t, lotId);
    await expireAuction(t, world.auctionId);

    expect(await settleExpiredLots(t)).toEqual({ settled: 1, hasMore: false });

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("unsold");
    expect(lot.winnerId).toBeUndefined();
    expect(lot.auctionId).toBeUndefined();
    expect(lot.currentPrice).toBe(SECOND_BID);

    expect(await readLotFees(t, lotId)).toEqual([]);
    expect(await readCounter(t, "lotFees")).toBeNull();

    const lotsCounter = await readCounter(t, "lots");
    expect(lotsCounter?.soldCount).toBe(0);
    expect(lotsCounter?.salesVolume).toBe(0);

    expect(await readActivityTypes(t, SELLER)).not.toContain("listing_sold");
    expect(await readActivityTypes(t, BIDDER_A)).not.toContain("bid_won");
  });

  it("ignores voided bids when picking the winner", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    await placeBid(t, BIDDER_B, lotId, LOT_PRICE);
    const retractable = await placeBid(t, BIDDER_A, lotId, SECOND_BID);
    expect(retractable.success).toBe(true);

    // A higher bid arrives and is voided afterwards (fraud review, chargeback).
    const voidedBidId = await t.run(async (ctx) => {
      return await ctx.db.insert("bids", {
        lotId,
        bidderId: BIDDER_B,
        amount: 50_000,
        timestamp: Date.now() + 10,
        status: "valid",
      });
    });
    await voidBid(t, voidedBidId);

    await expireAuction(t, world.auctionId);
    expect(await settleExpiredLots(t)).toEqual({ settled: 1, hasMore: false });

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("sold");
    expect(lot.winnerId).toBe(BIDDER_A);

    // The fee ledger is priced off the winning bid, not the voided one.
    const fees = await readLotFees(t, lotId);
    expect(fees.map((fee) => fee.salePrice)).toEqual([
      SECOND_BID,
      SECOND_BID,
      SECOND_BID,
      SECOND_BID,
    ]);
    const feeCounter = await readCounter(t, "lotFees");
    expect(feeCounter?.buyerTotal).toBe(555);
    expect(feeCounter?.sellerTotal).toBe(1060);
  });

  it("charges the lot's snapshotted auction defaults without writing ledger rows", async () => {
    const t = createTestContext();
    const world = await seedWorld(t, { withFees: false });
    const lotId = await createLot(t, world, {
      resolvedBuyerPremiumPct: 0.02,
      resolvedSellerCommissionPct: 0.03,
    });

    await placeBid(t, BIDDER_A, lotId, LOT_PRICE);
    await expireAuction(t, world.auctionId);
    expect(await settleExpiredLots(t)).toEqual({ settled: 1, hasMore: false });

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("sold");
    expect(lot.winnerId).toBe(BIDDER_A);

    // Defaults are derived, never persisted: lotFees stays empty while the
    // aggregate counters still carry the amounts.
    expect(await readLotFees(t, lotId)).toEqual([]);
    const feeCounter = await readCounter(t, "lotFees");
    expect(feeCounter?.buyerTotal).toBe(200);
    expect(feeCounter?.sellerTotal).toBe(300);
  });

  it("does not double-settle or double-charge when the cron runs twice", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);

    await placeTwoBids(t, lotId);
    await expireAuction(t, world.auctionId);

    expect(await settleExpiredLots(t)).toEqual({ settled: 1, hasMore: false });
    const settledAt = (await readLot(t, lotId)).settledAt;
    const firstFees = await readLotFees(t, lotId);
    const firstCounter = await readCounter(t, "lotFees");

    expect(await settleExpiredLots(t)).toEqual({ settled: 0, hasMore: false });

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("sold");
    expect(lot.winnerId).toBe(BIDDER_A);
    expect(lot.settledAt).toBe(settledAt);
    expect(await readLotFees(t, lotId)).toEqual(firstFees);
    expect(await readCounter(t, "lotFees")).toEqual(firstCounter);

    const lotsCounter = await readCounter(t, "lots");
    expect(lotsCounter?.soldCount).toBe(1);
    expect(lotsCounter?.salesVolume).toBe(SECOND_BID);
    expect(lotsCounter?.active).toBe(0);

    // Manual closure cannot settle the same lot twice either.
    const secondClose = await closeLotEarlyAsAdmin(t, lotId);
    expect(secondClose).toEqual({
      success: false,
      finalStatus: "",
      error: "Lot has already been settled",
    });
  });
});

describe("early closure by an admin (convex-test)", () => {
  it("agrees with expiry settlement on identical data", async () => {
    const t = createTestContext();
    const world = await seedWorld(t, { activeLots: 2 });
    const earlyLotId = await createLot(t, world, { title: "Closed early" });
    const cronLotId = await createLot(t, world, { title: "Settled by cron" });

    await placeTwoBids(t, earlyLotId);
    await placeTwoBids(t, cronLotId);

    const early = await closeLotEarlyAsAdmin(t, earlyLotId);
    expect(early).toEqual({
      success: true,
      finalStatus: "sold",
      winnerId: BIDDER_A,
      winningAmount: SECOND_BID,
    });

    await expireAuction(t, world.auctionId);
    expect(await settleExpiredLots(t)).toEqual({ settled: 1, hasMore: false });

    const earlyLot = await readLot(t, earlyLotId);
    const cronLot = await readLot(t, cronLotId);
    expect(earlyLot.status).toBe(cronLot.status);
    expect(earlyLot.winnerId).toBe(cronLot.winnerId);
    expect(earlyLot.currentPrice).toBe(cronLot.currentPrice);
    expect(earlyLot.settledAt).toBeGreaterThan(0);

    // Same sale price -> same ledger rows on both paths.
    expect(await readLotFees(t, earlyLotId)).toEqual(
      await readLotFees(t, cronLotId)
    );

    const lotsCounter = await readCounter(t, "lots");
    expect(lotsCounter?.soldCount).toBe(2);
    expect(lotsCounter?.salesVolume).toBe(2 * SECOND_BID);
    expect(lotsCounter?.active).toBe(0);

    const feeCounter = await readCounter(t, "lotFees");
    expect(feeCounter?.buyerTotal).toBe(1110);
    expect(feeCounter?.sellerTotal).toBe(2120);
  });

  it("closes a lot as unsold when the reserve is not met", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world, {
      reservePrice: LOT_PRICE + 1_000,
    });

    await placeTwoBids(t, lotId);

    const result = await closeLotEarlyAsAdmin(t, lotId);
    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe("unsold");
    expect(result.winnerId).toBeUndefined();

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("unsold");
    expect(await readLotFees(t, lotId)).toEqual([]);
    expect(await readCounter(t, "lotFees")).toBeNull();
    expect((await readCounter(t, "lots"))?.soldCount).toBe(0);
  });

  it("refuses callers that are not admins", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await createLot(t, world);
    await placeTwoBids(t, lotId);

    const asBidder = await t
      .withIdentity({ subject: BIDDER_A })
      .mutation(api.auctions.mutations.publish.closeLotEarly, { lotId });
    expect(asBidder).toEqual({
      success: false,
      finalStatus: "",
      error: "Not authorized: Admin privileges required",
    });

    const asAnonymous = await t.mutation(
      api.auctions.mutations.publish.closeLotEarly,
      { lotId }
    );
    expect(asAnonymous).toEqual({
      success: false,
      finalStatus: "",
      error: "Not authenticated",
    });

    const lot = await readLot(t, lotId);
    expect(lot.status).toBe("assigned");
    expect(await readLotFees(t, lotId)).toEqual([]);
  });
});
