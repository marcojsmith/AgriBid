/// <reference types="vite/client" />

import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../_generated/api";
import schema from "../../schema";
import type { Id } from "../../_generated/dataModel";

/**
 * Convex functions are loaded through this glob, which must cover the whole
 * `convex/` directory (including `_generated`, which convex-test uses to work
 * out the module root). `*.*s` matches both the `.ts` sources and the `.js` files
 * under `_generated`.
 */
const globbedModules = import.meta.glob("../../**/*.*s");

/** Path of this directory relative to the `convex/` root. */
const THIS_DIR = "auctions/queries/";

/**
 * `import.meta.glob` keys are relative to this file and Vite prefixes
 * same-directory matches with `./`, so `convex/auctions/queries/bids.ts` arrives
 * as `./bids.ts` while the rest arrive as `../../auctions/queries/bids.ts`.
 * convex-test derives a single root prefix from the first `_generated` key
 * (`../../`) and then looks every module up beneath it, so the same-directory
 * keys are rebased onto that prefix before the map is handed over.
 */
const modules: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(globbedModules).map(([path, load]) => [
    path.startsWith("./") ? `../../${THIS_DIR}${path.slice(2)}` : path,
    load,
  ])
);

/** Clerk user id of the bidder under test. */
const BIDDER_ID = "user_bidder";
/** A different bidder whose bids must never leak into the bidder's results. */
const OTHER_BIDDER_ID = "user_other";
/** Seller of every seeded lot. */
const SELLER_ID = "user_seller";

/** Base timestamp for all seeded bid timestamps (fixed: no wall clock). */
const BASE_TIME = 1_700_000_000_000;
/** Start/end of the seeded parent auction. */
const AUCTION_START = BASE_TIME - 7 * 24 * 60 * 60 * 1000;
const AUCTION_END = BASE_TIME + 3 * 24 * 60 * 60 * 1000;
/** Page size requested by most tests. */
const PAGE_SIZE = 20;
/**
 * Upper bound on page fetches per pagination run. A handler whose cursor does
 * not strictly advance would otherwise loop forever inside a microtask chain
 * that never yields, so vitest's per-test timeout could not fire.
 */
const MAX_PAGE_FETCHES = 60;

/**
 * Creates a fresh in-memory Convex backend with the real schema.
 *
 * @returns A convex-test context for a single test
 */
const createTestContext = () => convexTest(schema, modules);

type TestContext = ReturnType<typeof createTestContext>;
type AuthedTestContext = ReturnType<TestContext["withIdentity"]>;

/** A row of the `getMyBids` page. */
type MyBidRow = FunctionReturnType<
  typeof api.auctions.queries.bids.getMyBids
>["page"][number];

/** A seeded lot plus the effective end time the "ending" sort orders by. */
interface LotFixture {
  lotId: Id<"lots">;
  effectiveEndTime: number;
}

/** A seeded bid. */
interface BidFixture {
  lotId: Id<"lots">;
  bidderId: string;
  amount: number;
  timestamp: number;
  status: "valid" | "voided";
}

/** Per-lot aggregate the handler is expected to report for the bidder. */
interface ExpectedLotStats {
  myHighestBid: number;
  lastBidTimestamp: number;
  bidCount: number;
}

/** Everything one pagination run returned. */
interface CollectedPages {
  rows: MyBidRow[];
  pageCount: number;
  pageSizes: number[];
}

/**
 * Creates a published auction with `lotCount` assigned lots and returns them.
 *
 * Lot 0 deliberately has no `extendedEndTime`, so the "ending" sort has to fall
 * back to the parent auction's end time; every other lot ends one minute later
 * than the previous one, giving each lot a distinct end time.
 *
 * @param t - The convex-test context
 * @param lotCount - How many lots to create
 * @returns The seeded lots, in insertion order
 */
async function seedAuctionWithLots(
  t: TestContext,
  lotCount: number
): Promise<LotFixture[]> {
  return await t.run(async (ctx) => {
    const categoryId = await ctx.db.insert("equipmentCategories", {
      name: "Tractors",
      isActive: true,
    });
    const auctionId = await ctx.db.insert("auctions", {
      title: "Paging Test Auction",
      status: "published",
      startTime: AUCTION_START,
      endTime: AUCTION_END,
      createdBy: SELLER_ID,
      createdAt: BASE_TIME,
      updatedAt: BASE_TIME,
    });

    const lots: LotFixture[] = [];
    for (let index = 0; index < lotCount; index++) {
      const effectiveEndTime = AUCTION_END + index * 60_000;
      const lotId = await ctx.db.insert("lots", {
        title: `Lot ${String(index).padStart(3, "0")}`,
        make: "John Deere",
        model: "8R",
        year: 2020,
        operatingHours: 1000,
        location: "Iowa",
        categoryId,
        reservePrice: 1000,
        startingPrice: 100,
        currentPrice: 100,
        minIncrement: 10,
        sellerId: SELLER_ID,
        status: "assigned",
        auctionId,
        extendedEndTime: index === 0 ? undefined : effectiveEndTime,
        images: { additional: [] },
        createdAt: BASE_TIME + index,
      });
      lots.push({
        lotId,
        effectiveEndTime: index === 0 ? AUCTION_END : effectiveEndTime,
      });
    }
    return lots;
  });
}

/**
 * Inserts bid fixtures in a single transaction.
 *
 * @param t - The convex-test context
 * @param bids - The bids to insert, in insertion order
 */
async function seedBids(t: TestContext, bids: BidFixture[]): Promise<void> {
  await t.run(async (ctx) => {
    for (const bid of bids) {
      await ctx.db.insert("bids", {
        lotId: bid.lotId,
        bidderId: bid.bidderId,
        amount: bid.amount,
        timestamp: bid.timestamp,
        status: bid.status,
      });
    }
  });
}

/**
 * Builds the bidder's bid sequence over `lots`.
 *
 * Bids step through the lots one at a time, so a lot's bids sit far apart in
 * time, except every seventh step where a run of same-lot bids is emitted.
 * Those runs are what force page boundaries to land in the middle of a lot's
 * bids, which is the case the keyset cursor has to get right.
 *
 * @param lots - The lots to bid on
 * @param bidCount - Total number of bids to place
 * @returns The bid fixtures, oldest first
 */
function buildBidderBids(lots: LotFixture[], bidCount: number): BidFixture[] {
  const bids: BidFixture[] = [];
  let lotIndex = 0;

  while (bids.length < bidCount) {
    const runLength = bids.length % 7 === 6 ? 3 : 1;
    for (let run = 0; run < runLength && bids.length < bidCount; run++) {
      const seq = bids.length;
      bids.push({
        lotId: lots[lotIndex].lotId,
        bidderId: BIDDER_ID,
        amount: 100 + seq,
        timestamp: BASE_TIME + seq * 1000,
        status: "valid",
      });
    }
    lotIndex = (lotIndex + 7) % lots.length;
  }

  return bids;
}

/**
 * Aggregates the bidder's non-voided bids per lot the way the handler should.
 *
 * @param bids - All seeded bid fixtures
 * @param bidderId - The bidder to aggregate for
 * @returns Per-lot highest amount, newest timestamp and non-voided bid count
 */
function expectedStatsFor(
  bids: BidFixture[],
  bidderId: string
): Map<Id<"lots">, ExpectedLotStats> {
  const stats = new Map<Id<"lots">, ExpectedLotStats>();

  for (const bid of bids) {
    if (bid.bidderId !== bidderId || bid.status === "voided") continue;

    const current = stats.get(bid.lotId);
    if (!current) {
      stats.set(bid.lotId, {
        myHighestBid: bid.amount,
        lastBidTimestamp: bid.timestamp,
        bidCount: 1,
      });
      continue;
    }

    current.bidCount += 1;
    if (bid.amount > current.myHighestBid) current.myHighestBid = bid.amount;
    if (bid.timestamp > current.lastBidTimestamp) {
      current.lastBidTimestamp = bid.timestamp;
    }
  }

  return stats;
}

/**
 * Orders lot ids by their newest bid, newest first: the "recent" sort order.
 *
 * @param stats - Per-lot aggregates as returned by {@link expectedStatsFor}
 * @returns Lot ids in the expected page order
 */
function expectedRecentOrder(
  stats: Map<Id<"lots">, ExpectedLotStats>
): Id<"lots">[] {
  return Array.from(stats.entries())
    .sort((a, b) => b[1].lastBidTimestamp - a[1].lastBidTimestamp)
    .map(([lotId]) => lotId);
}

/**
 * Walks `getMyBids` through `continueCursor` until `isDone`.
 *
 * Throws (rather than looping) when the handler reports more pages without a
 * cursor that strictly advances, or after {@link MAX_PAGE_FETCHES} fetches, so
 * a stalled cursor surfaces as a failed test instead of a hung run.
 *
 * @param t - A convex-test context bound to the bidder's identity
 * @param options - Sort, page size and the cursor to resume from
 * @param options.sort - Sort to ask the handler for
 * @param options.numItems - Page size to request
 * @param options.startCursor - Cursor to resume from, null to start at page one
 * @returns Every row returned, plus the number of pages and their sizes
 */
async function collectAllPages(
  t: AuthedTestContext,
  options: {
    sort: "recent" | "ending";
    numItems: number;
    startCursor?: string | null;
  }
): Promise<CollectedPages> {
  const rows: MyBidRow[] = [];
  const pageSizes: number[] = [];
  const seenCursors = new Set<string>();
  let cursor = options.startCursor ?? null;
  let pageCount = 0;

  for (;;) {
    const result = await t.query(api.auctions.queries.bids.getMyBids, {
      paginationOpts: { numItems: options.numItems, cursor },
      sort: options.sort,
    });
    rows.push(...result.page);
    pageSizes.push(result.page.length);
    pageCount += 1;

    if (result.isDone) return { rows, pageCount, pageSizes };

    if (result.continueCursor === "") {
      throw new Error(
        `getMyBids reported isDone=false with an empty continueCursor (page ${String(pageCount)})`
      );
    }
    if (seenCursors.has(result.continueCursor)) {
      throw new Error(
        `getMyBids repeated the cursor "${result.continueCursor}" (page ${String(pageCount)})`
      );
    }
    if (pageCount >= MAX_PAGE_FETCHES) {
      throw new Error(
        `getMyBids still reported more pages after ${String(MAX_PAGE_FETCHES)} fetches`
      );
    }

    seenCursors.add(result.continueCursor);
    cursor = result.continueCursor;
  }
}

describe("getMyBids pagination (convex-test)", () => {
  it("pages through every distinct lot exactly once, newest bid first", async () => {
    const t = createTestContext();
    const lots = await seedAuctionWithLots(t, 65);
    const bids = buildBidderBids(lots, 260);

    // One voided bid, the newest on its lot: neither the lot's order nor its
    // stats may take it into account.
    const voidedLotIndex = 3;
    const voidedTarget = bids.findIndex(
      (bid) => bid.lotId === lots[voidedLotIndex].lotId
    );
    expect(voidedTarget).toBeGreaterThanOrEqual(0);
    const voidedBid = bids[voidedTarget];
    bids.splice(voidedTarget, 0, {
      ...voidedBid,
      amount: voidedBid.amount + 1,
      timestamp: voidedBid.timestamp + 500,
      status: "voided",
    });

    await seedBids(t, bids);

    const asBidder = t.withIdentity({ subject: BIDDER_ID });
    const { rows, pageCount, pageSizes } = await collectAllPages(asBidder, {
      sort: "recent",
      numItems: PAGE_SIZE,
    });

    const expectedStats = expectedStatsFor(bids, BIDDER_ID);

    // Every distinct lot exactly once, in descending last-bid-time order.
    expect(rows.map((row) => row._id)).toEqual(
      expectedRecentOrder(expectedStats)
    );
    expect(new Set(rows.map((row) => row._id)).size).toBe(lots.length);
    expect(pageCount).toBe(Math.ceil(lots.length / PAGE_SIZE));
    expect(pageSizes.slice(0, -1).every((size) => size === PAGE_SIZE)).toBe(
      true
    );

    for (const row of rows) {
      const expected = expectedStats.get(row._id);
      expect(expected).toBeDefined();
      expect(row.myHighestBid).toBe(expected?.myHighestBid);
      expect(row.lastBidTimestamp).toBe(expected?.lastBidTimestamp);
      expect(row.bidTimestamp).toBe(expected?.lastBidTimestamp);
      expect(row.bidCount).toBe(expected?.bidCount);
      expect(row.bidAmount).toBe(expected?.myHighestBid);
    }

    for (let index = 1; index < rows.length; index++) {
      const previous = rows[index - 1].lastBidTimestamp;
      const current = rows[index].lastBidTimestamp;
      expect(previous).toBeGreaterThanOrEqual(current);
    }
  });

  it("returns one row per lot even when a lot owns many of the bidder's bids", async () => {
    const t = createTestContext();
    const lots = await seedAuctionWithLots(t, 12);
    const bids: BidFixture[] = [];

    // Lot 0 is the newest-bidded lot and owns 40 bids, spread over 40 seconds.
    for (let index = 0; index < 40; index++) {
      bids.push({
        lotId: lots[0].lotId,
        bidderId: BIDDER_ID,
        amount: 500 + index,
        timestamp: BASE_TIME + 1_000_000 + index * 1000,
        status: "valid",
      });
    }
    // Every other lot owns exactly one bid, all of them older.
    for (let index = 1; index < lots.length; index++) {
      bids.push({
        lotId: lots[index].lotId,
        bidderId: BIDDER_ID,
        amount: 100 + index,
        timestamp: BASE_TIME + index * 1000,
        status: "valid",
      });
    }

    await seedBids(t, bids);

    const asBidder = t.withIdentity({ subject: BIDDER_ID });
    const { rows } = await collectAllPages(asBidder, {
      sort: "recent",
      numItems: 5,
    });

    const expectedStats = expectedStatsFor(bids, BIDDER_ID);
    expect(rows.map((row) => row._id)).toEqual(
      expectedRecentOrder(expectedStats)
    );

    const firstRow = rows[0];
    expect(firstRow._id).toBe(lots[0].lotId);
    expect(firstRow.bidCount).toBe(40);
    expect(firstRow.myHighestBid).toBe(539);
  });

  it("keeps paging without duplicates or misses when the bidder bids again", async () => {
    const t = createTestContext();
    const lots = await seedAuctionWithLots(t, 65);
    const bids = buildBidderBids(lots, 260);
    await seedBids(t, bids);

    const asBidder = t.withIdentity({ subject: BIDDER_ID });
    const firstPage = await asBidder.query(
      api.auctions.queries.bids.getMyBids,
      { paginationOpts: { numItems: PAGE_SIZE, cursor: null }, sort: "recent" }
    );

    expect(firstPage.page).toHaveLength(PAGE_SIZE);
    expect(firstPage.isDone).toBe(false);
    expect(firstPage.continueCursor).not.toBe("");

    // The bidder bids again, with the newest timestamp, on a lot that page 1
    // already listed. The scan only ever moves backwards in time, so this bid
    // must neither duplicate that lot nor push another lot out of the run.
    const relistedLotId = firstPage.page[0]._id;
    const bidCountBefore = firstPage.page[0].bidCount;
    await seedBids(t, [
      {
        lotId: relistedLotId,
        bidderId: BIDDER_ID,
        amount: 999_999,
        timestamp: BASE_TIME + 10_000_000,
        status: "valid",
      },
    ]);

    const remaining = await collectAllPages(asBidder, {
      sort: "recent",
      numItems: PAGE_SIZE,
      startCursor: firstPage.continueCursor,
    });
    const remainingIds = remaining.rows.map((row) => row._id);

    expect(new Set(remainingIds).size).toBe(remainingIds.length);
    expect(remainingIds).not.toContain(relistedLotId);

    const allIds = [...firstPage.page, ...remaining.rows].map((row) => row._id);
    expect(new Set(allIds).size).toBe(lots.length);
    expect(new Set(allIds)).toEqual(new Set(lots.map((lot) => lot.lotId)));

    // The row page 1 already returned keeps the stats it had when it was
    // returned; only a fresh first page sees the newer bid.
    expect(firstPage.page[0].bidCount).toBe(bidCountBefore);
    const refreshed = await asBidder.query(
      api.auctions.queries.bids.getMyBids,
      { paginationOpts: { numItems: PAGE_SIZE, cursor: null }, sort: "recent" }
    );
    const refreshedRow = refreshed.page.find(
      (row) => row._id === relistedLotId
    );
    expect(refreshedRow?.bidCount).toBe(bidCountBefore + 1);
    expect(refreshedRow?.myHighestBid).toBe(999_999);
  });

  it("respects the requested page size", async () => {
    const t = createTestContext();
    const lots = await seedAuctionWithLots(t, 45);
    await seedBids(t, buildBidderBids(lots, 180));

    const asBidder = t.withIdentity({ subject: BIDDER_ID });

    for (const numItems of [1, 7, 20, 44, 100]) {
      const page = await asBidder.query(api.auctions.queries.bids.getMyBids, {
        paginationOpts: { numItems, cursor: null },
        sort: "recent",
      });
      expect(page.page.length).toBe(Math.min(numItems, lots.length));
    }

    const { pageSizes } = await collectAllPages(asBidder, {
      sort: "recent",
      numItems: 7,
    });
    expect(pageSizes.slice(0, -1).every((size) => size === 7)).toBe(true);
    expect(pageSizes.reduce((total, size) => total + size, 0)).toBe(
      lots.length
    );
  });

  it("caps the bid window instead of reading a heavy bidder's whole history", async () => {
    const t = createTestContext();
    const lots = await seedAuctionWithLots(t, 6);

    // Lot 0 owns more bids than the handler is allowed to read for one page, so
    // every early window is full of bids of a lot that page 1 already returned.
    const heavyLotBidCount = 1_100;
    const bids: BidFixture[] = [];
    for (let index = 0; index < heavyLotBidCount; index++) {
      bids.push({
        lotId: lots[0].lotId,
        bidderId: BIDDER_ID,
        amount: 1_000 + index,
        // Newest bids of all, so lot 0 heads the "recent" order.
        timestamp: BASE_TIME + (heavyLotBidCount - index) * 1_000,
        status: "valid",
      });
    }
    for (let index = 1; index < lots.length; index++) {
      bids.push({
        lotId: lots[index].lotId,
        bidderId: BIDDER_ID,
        amount: 100 + index,
        timestamp: BASE_TIME + index * 1_000,
        status: "valid",
      });
    }
    await seedBids(t, bids);

    const asBidder = t.withIdentity({ subject: BIDDER_ID });
    const firstPage = await asBidder.query(
      api.auctions.queries.bids.getMyBids,
      { paginationOpts: { numItems: 2, cursor: null }, sort: "recent" }
    );

    // The cap is hit before the page can hold two lots, so this page is short -
    // but it still names the newest lot and hands back a cursor that moves on.
    expect(firstPage.page.map((row) => row._id)).toEqual([lots[0].lotId]);
    expect(firstPage.isDone).toBe(false);
    expect(firstPage.continueCursor).not.toBe("");

    const { rows } = await collectAllPages(asBidder, {
      sort: "recent",
      numItems: 2,
      startCursor: firstPage.continueCursor,
    });
    const expectedStats = expectedStatsFor(bids, BIDDER_ID);

    // Lot 0 was already returned on page 1; the rest follow in newest-first order.
    expect(rows.map((row) => row._id)).toEqual(
      expectedRecentOrder(expectedStats).slice(1)
    );
    for (const row of rows) {
      const expected = expectedStats.get(row._id);
      expect(row.bidCount).toBe(expected?.bidCount);
      expect(row.myHighestBid).toBe(expected?.myHighestBid);
    }
  });

  it("clamps a non-positive page size instead of stalling", async () => {
    const t = createTestContext();
    const lots = await seedAuctionWithLots(t, 3);
    await seedBids(t, buildBidderBids(lots, 3));

    const asBidder = t.withIdentity({ subject: BIDDER_ID });
    const page = await asBidder.query(api.auctions.queries.bids.getMyBids, {
      paginationOpts: { numItems: 0, cursor: null },
      sort: "recent",
    });

    expect(page.page).toHaveLength(1);
    expect(page.isDone).toBe(false);

    const { rows } = await collectAllPages(asBidder, {
      sort: "recent",
      numItems: 0,
    });
    expect(rows).toHaveLength(lots.length);
  });

  it("orders the 'ending' sort by end time inside the 200-lot window", async () => {
    const t = createTestContext();
    // 205 lots: five more than the "ending" sort is allowed to consider.
    const lots = await seedAuctionWithLots(t, 205);
    const bids: BidFixture[] = lots.map((lot, index) => ({
      lotId: lot.lotId,
      bidderId: BIDDER_ID,
      amount: 100 + index,
      timestamp: BASE_TIME + index * 1000,
      status: "valid",
    }));
    await seedBids(t, bids);

    const asBidder = t.withIdentity({ subject: BIDDER_ID });
    const { rows, pageCount, pageSizes } = await collectAllPages(asBidder, {
      sort: "ending",
      numItems: 50,
    });

    // The window is the 200 most recently bid-on lots, i.e. lots 5..204, and
    // inside it the lots are ordered by their effective end time ascending.
    const expected = lots
      .slice(5)
      .sort((a, b) => a.effectiveEndTime - b.effectiveEndTime)
      .map((lot) => lot.lotId);

    expect(rows).toHaveLength(200);
    expect(rows.map((row) => row._id)).toEqual(expected);
    expect(pageCount).toBe(4);
    expect(pageSizes.every((size) => size <= 50)).toBe(true);

    const lastPage = await asBidder.query(api.auctions.queries.bids.getMyBids, {
      paginationOpts: { numItems: 50, cursor: "150" },
      sort: "ending",
    });
    expect(lastPage.page.map((row) => row._id)).toEqual(expected.slice(150));
    expect(lastPage.isDone).toBe(true);
    expect(lastPage.totalCount).toBe(200);
  });

  it("never returns another user's bids", async () => {
    const t = createTestContext();
    const lots = await seedAuctionWithLots(t, 65);
    const bidderBids = buildBidderBids(lots, 260);

    // The other bidder outbids the user on lots the user also bid on, and owns a
    // lot of their own entirely.
    const otherBids: BidFixture[] = lots.slice(0, 5).map((lot, index) => ({
      lotId: lot.lotId,
      bidderId: OTHER_BIDDER_ID,
      amount: 5_000_000 + index,
      timestamp: BASE_TIME + 20_000_000 + index * 1000,
      status: "valid",
    }));
    const otherOnlyLotId = await t.run(
      async (ctx) =>
        await ctx.db.insert("lots", {
          title: "Other bidder only",
          make: "Case IH",
          model: "Magnum",
          year: 2021,
          operatingHours: 500,
          location: "Iowa",
          reservePrice: 1000,
          startingPrice: 100,
          currentPrice: 7_777_777,
          minIncrement: 10,
          sellerId: SELLER_ID,
          status: "assigned",
          images: { additional: [] },
          createdAt: BASE_TIME,
        })
    );
    otherBids.push({
      lotId: otherOnlyLotId,
      bidderId: OTHER_BIDDER_ID,
      amount: 7_777_777,
      timestamp: BASE_TIME + 30_000_000,
      status: "valid",
    });

    await seedBids(t, [...bidderBids, ...otherBids]);

    const asBidder = t.withIdentity({ subject: BIDDER_ID });
    const { rows } = await collectAllPages(asBidder, {
      sort: "recent",
      numItems: PAGE_SIZE,
    });

    const expectedStats = expectedStatsFor(bidderBids, BIDDER_ID);
    expect(rows.map((row) => row._id)).toEqual(
      expectedRecentOrder(expectedStats)
    );
    expect(rows.map((row) => row._id)).not.toContain(otherOnlyLotId);

    // A higher bid by the other bidder must not raise the user's highest bid.
    for (const row of rows) {
      expect(row.myHighestBid).toBe(expectedStats.get(row._id)?.myHighestBid);
      expect(row.bidCount).toBe(expectedStats.get(row._id)?.bidCount);
      expect(row.lastBidTimestamp).toBeLessThanOrEqual(BASE_TIME + 300_000);
    }

    const asOther = t.withIdentity({ subject: OTHER_BIDDER_ID });
    const otherPage = await asOther.query(api.auctions.queries.bids.getMyBids, {
      paginationOpts: { numItems: PAGE_SIZE, cursor: null },
      sort: "recent",
    });
    expect(otherPage.page.map((row) => row._id)).toEqual([
      otherOnlyLotId,
      // The five shared lots, newest bid first.
      ...lots
        .slice(0, 5)
        .reverse()
        .map((lot) => lot.lotId),
    ]);
  });

  it("returns the empty paginated result when unauthenticated", async () => {
    const t = createTestContext();
    const lots = await seedAuctionWithLots(t, 3);
    await seedBids(t, buildBidderBids(lots, 3));

    const result = await t.query(api.auctions.queries.bids.getMyBids, {
      paginationOpts: { numItems: PAGE_SIZE, cursor: null },
      sort: "recent",
    });

    expect(result).toEqual({
      page: [],
      isDone: true,
      continueCursor: "",
      totalCount: 0,
      pageStatus: null,
      splitCursor: null,
    });
  });
});
