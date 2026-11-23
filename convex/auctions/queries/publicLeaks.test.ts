/// <reference types="vite/client" />

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";

import { api } from "../../_generated/api";
import schema from "../../schema";
import type { Doc, Id } from "../../_generated/dataModel";

/** See bids.paging.test.ts: the glob must cover all of `convex/`. */
const globbedModules = import.meta.glob("../../**/*.*s");
const THIS_DIR = "auctions/queries/";
const modules: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(globbedModules).map(([path, load]) => [
    path.startsWith("./") ? `../../${THIS_DIR}${path.slice(2)}` : path,
    load,
  ])
);

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;
const SELLER = "user_seller_secret";
const WINNER = "user_winner_secret";
const BIDDER = "user_bidder_secret";
const OTHER = "user_other";
const PAGE = { numItems: 20, cursor: null };

/** Field names that must never appear in a public query result. */
const FORBIDDEN_KEYS = ["reservePrice", "sellerId", "winnerId", "bidderId"];
/** Raw ids that must never appear in a public query result. */
const FORBIDDEN_VALUES = [SELLER, WINNER, BIDDER];

type TestContext = ReturnType<typeof convexTest>;
/** Anything that can run a query: the base context or one with an identity. */
interface Caller {
  query: TestContext["query"];
}

/**
 * Asserts a query result carries no reserve amount and no account ids.
 *
 * @param result - The query result to serialise and inspect
 */
function expectNoLeaks(result: unknown): void {
  const json = JSON.stringify(result);
  for (const key of FORBIDDEN_KEYS) {
    expect(json).not.toContain(`"${key}"`);
  }
  for (const value of FORBIDDEN_VALUES) {
    expect(json).not.toContain(value);
  }
}

/**
 * Seeds one live sale with a reserve lot that has a bid and a watcher, plus a
 * sold lot won by `WINNER`, and a second lot of the same make.
 *
 * @param t - convex-test context
 * @returns The ids needed by the tests
 */
async function seed(t: TestContext): Promise<{
  auctionId: Id<"auctions">;
  lotId: Id<"lots">;
  relatedId: Id<"lots">;
  soldId: Id<"lots">;
}> {
  return await t.run(async (ctx) => {
    const auctionId = await ctx.db.insert("auctions", {
      title: "Sale",
      status: "published",
      startTime: NOW - 3 * HOUR,
      endTime: NOW + 2 * HOUR,
      createdBy: "admin",
      createdAt: NOW,
      updatedAt: NOW,
    });
    const base = {
      make: "John Deere",
      model: "8R",
      year: 2020,
      operatingHours: 100,
      location: "Free State",
      reservePrice: 1000,
      startingPrice: 500,
      currentPrice: 800,
      minIncrement: 10,
      sellerId: SELLER,
      images: { additional: [] },
      auctionId,
    } satisfies Partial<Doc<"lots">>;
    const lotId = await ctx.db.insert("lots", {
      ...base,
      title: "Reserve lot",
      status: "assigned",
      lotNumber: 1,
    });
    const relatedId = await ctx.db.insert("lots", {
      ...base,
      title: "Related lot",
      status: "assigned",
      lotNumber: 2,
    });
    const soldId = await ctx.db.insert("lots", {
      ...base,
      title: "Sold lot",
      status: "sold",
      winnerId: WINNER,
      lotNumber: 3,
    });
    await ctx.db.insert("bids", {
      lotId,
      bidderId: BIDDER,
      amount: 800,
      timestamp: NOW - HOUR,
      status: "valid",
    });
    await ctx.db.insert("watchlist", { userId: OTHER, lotId });
    await ctx.db.insert("watchlist", { userId: OTHER, lotId: soldId });
    return { auctionId, lotId, relatedId, soldId };
  });
}

describe("public lot queries never leak reserve or account ids", () => {
  let t: TestContext;
  let ids: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    t = convexTest(schema, modules);
    ids = await seed(t);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const viewers: [string, (ctx: TestContext) => Caller][] = [
    ["a guest", (ctx) => ctx],
    ["another user", (ctx) => ctx.withIdentity({ subject: OTHER })],
    ["the seller", (ctx) => ctx.withIdentity({ subject: SELLER })],
  ];

  describe.each(viewers)("as %s", (_name, as) => {
    it("getActiveLots", async () => {
      const result = await as(t).query(api.auctions.getActiveLots, {
        paginationOpts: PAGE,
        statusFilter: "all",
      });
      expect(result.page.length).toBe(3);
      expectNoLeaks(result);
      for (const lot of result.page) {
        // No bid counter rows are seeded, so every reserve lot still "applies".
        expect(lot.reserveState).toBe("applies");
      }
    });

    it("getRelatedLots", async () => {
      const result = await as(t).query(api.auctions.getRelatedLots, {
        make: "John Deere",
        excludeId: ids.lotId,
      });
      expect(result.map((lot) => lot._id)).toEqual([ids.relatedId]);
      expectNoLeaks(result);
    });

    it("getSellerListings", async () => {
      const result = await as(t).query(api.auctions.getSellerListings, {
        userId: SELLER,
        paginationOpts: PAGE,
      });
      expect(result.page.length).toBe(3);
      expectNoLeaks(result);
    });

    it("getLotBids", async () => {
      const result = await as(t).query(api.auctions.getLotBids, {
        lotId: ids.lotId,
        paginationOpts: PAGE,
      });
      expect(result.page.length).toBe(1);
      // The seller may see who bid; guests and other users may not.
      const json = JSON.stringify(result);
      if (_name === "the seller") {
        expect(json).toContain(BIDDER);
      } else {
        expectNoLeaks(result);
      }
    });

    it("getLotById", async () => {
      const lot = await as(t).query(api.auctions.getLotById, {
        lotId: ids.lotId,
      });
      expect(lot?.isSeller).toBe(_name === "the seller");
      const json = JSON.stringify(lot);
      expect(json).not.toContain('"sellerId"');
      expect(json).not.toContain('"winnerId"');
      expect(json).not.toContain(SELLER);
      expect(lot?.reserveState).toBe("applies");
      // Raw reserve only for the seller.
      expect(
        "reservePrice" in (lot ?? {}) && lot?.reservePrice !== undefined
      ).toBe(_name === "the seller");
    });
  });

  it("getWatchedLots returns server-computed flags, not ids", async () => {
    const result = await t
      .withIdentity({ subject: OTHER })
      .query(api.watchlist.getWatchedLots, { paginationOpts: PAGE });
    expect(result.page.length).toBe(2);
    expectNoLeaks(result);
    expect(result.page.every((lot) => !lot.isSeller && !lot.isWinner)).toBe(
      true
    );
  });

  it("getMyBids flags the caller's own win without exposing the winner id", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("bids", {
        lotId: ids.soldId,
        bidderId: WINNER,
        amount: 800,
        timestamp: NOW - 2 * HOUR,
        status: "valid",
      });
    });
    const result = await t
      .withIdentity({ subject: WINNER })
      .query(api.auctions.getMyBids, { paginationOpts: PAGE });
    expect(result.page.length).toBe(1);
    expect(result.page[0].isWon).toBe(true);
    expect(result.page[0].isWinner).toBe(true);
    const json = JSON.stringify(result);
    for (const key of ["reservePrice", "sellerId", "winnerId"]) {
      expect(json).not.toContain(`"${key}"`);
    }
    expect(json).not.toContain(SELLER);
  });

  it("getMostEngagedLots returns summaries without leaks", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("engagementScores", {
        auctionId: ids.auctionId,
        lotId: ids.lotId,
        lotNumber: 1,
        watchers: 1,
        bids: 1,
        views: 1,
        score: 10,
        updatedAt: NOW,
      });
    });
    const result = await t.query(api.engagement.getMostEngagedLots, {
      auctionId: ids.auctionId,
    });
    expect(result.length).toBe(1);
    expectNoLeaks(result);
  });

  it("getHomeLots and getEventLots stay clean", async () => {
    expectNoLeaks(
      await t.query(api.auctions.getHomeLots, { auctionIds: [ids.auctionId] })
    );
    expectNoLeaks(
      await t.query(api.auctions.getEventLots, { auctionId: ids.auctionId })
    );
  });

  describe("owner and admin paths keep the raw values", () => {
    it("getMyListings gives the seller their reserve and refuses to leak to others", async () => {
      const own = await t
        .withIdentity({ subject: SELLER })
        .query(api.auctions.getMyListings, { paginationOpts: PAGE });
      expect(own.page.length).toBe(3);
      expect(own.page.every((lot) => lot.reservePrice === 1000)).toBe(true);
      expect(own.page.every((lot) => lot.sellerId === SELLER)).toBe(true);

      const other = await t
        .withIdentity({ subject: OTHER })
        .query(api.auctions.getMyListings, { paginationOpts: PAGE });
      expect(other.page).toEqual([]);
      const guest = await t.query(api.auctions.getMyListings, {
        paginationOpts: PAGE,
      });
      expect(guest.page).toEqual([]);
    });

    it("admin queues reject guests and non-admins", async () => {
      await expect(
        t.query(api.auctions.getAllLots, { paginationOpts: PAGE })
      ).rejects.toThrow();
      await expect(
        t
          .withIdentity({ subject: OTHER })
          .query(api.auctions.getAllLots, { paginationOpts: PAGE })
      ).rejects.toThrow();
      await expect(t.query(api.auctions.getPendingLots, {})).rejects.toThrow();
      await expect(
        t.query(api.auctions.getAssignmentCandidates, {
          auctionId: ids.auctionId,
        })
      ).rejects.toThrow();
    });
  });
});
