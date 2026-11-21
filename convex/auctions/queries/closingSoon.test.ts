/// <reference types="vite/client" />

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";

import { api } from "../../_generated/api";
import schema from "../../schema";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  CLOSING_SOON_LOT_LIMIT,
  CLOSING_SOON_LOTS_PER_AUCTION,
  CLOSING_SOON_UPCOMING_AUCTION_CAP,
} from "../../constants";

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
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

type TestContext = ReturnType<typeof convexTest>;

/**
 * Inserts an auction ending `endsIn` ms from NOW (default: 2 h, live).
 *
 * @param t - convex-test context
 * @param overrides - Fields overriding the defaults
 * @returns The new auction id
 */
async function insertAuction(
  t: TestContext,
  overrides: Partial<Doc<"auctions">> = {}
): Promise<Id<"auctions">> {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("auctions", {
        title: "Sale",
        status: "published",
        startTime: NOW - 3 * HOUR,
        endTime: NOW + 2 * HOUR,
        createdBy: "admin",
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides,
      })
  );
}

/**
 * Inserts an assigned lot.
 *
 * @param t - convex-test context
 * @param auctionId - Parent auction
 * @param overrides - Fields overriding the defaults
 * @returns The new lot id
 */
async function insertLot(
  t: TestContext,
  auctionId: Id<"auctions">,
  overrides: Partial<Doc<"lots">> = {}
): Promise<Id<"lots">> {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("lots", {
        title: "Lot",
        make: "John Deere",
        model: "8R",
        year: 2020,
        operatingHours: 100,
        location: "Free State",
        reservePrice: 1000,
        startingPrice: 500,
        currentPrice: 500,
        minIncrement: 10,
        sellerId: "user_seller",
        status: "assigned",
        auctionId,
        images: { additional: [] },
        ...overrides,
      })
  );
}

/**
 * Runs the query with the given limit.
 *
 * @param t - convex-test context
 * @param limit - Requested limit (default 12)
 * @returns The strip lots
 */
async function strip(t: TestContext, limit = 12) {
  return await t.query(api.auctions.getClosingSoonLots, { limit });
}

describe("getClosingSoonLots", () => {
  let t: TestContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    t = convexTest(schema, modules);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an empty list when nothing closes soon", async () => {
    expect(await strip(t)).toEqual([]);
    const far = await insertAuction(t, { endTime: NOW + 6 * 24 * HOUR });
    await insertLot(t, far);
    expect(await strip(t)).toEqual([]);
  });

  it("includes lots ending inside the 24 h window and excludes later ones", async () => {
    const inside = await insertAuction(t, { endTime: NOW + 24 * HOUR });
    const outside = await insertAuction(t, { endTime: NOW + 24 * HOUR + 1 });
    const insideLot = await insertLot(t, inside);
    await insertLot(t, outside);
    const result = await strip(t);
    expect(result.map((lot) => lot._id)).toEqual([insideLot]);
  });

  it("drops a sale whose end time has passed when no lot was extended", async () => {
    const ended = await insertAuction(t, { endTime: NOW - MIN });
    await insertLot(t, ended);
    expect(await strip(t)).toEqual([]);
  });

  it("keeps a lot soft-closed past its sale's end and orders it by its own end", async () => {
    const ended = await insertAuction(t, { endTime: NOW - 5 * MIN });
    const extended = await insertLot(t, ended, {
      extendedEndTime: NOW + 90_000,
    });
    await insertLot(t, ended); // not extended: ended already
    const live = await insertAuction(t, { endTime: NOW + HOUR });
    const liveLot = await insertLot(t, live);
    const result = await strip(t);
    expect(result.map((lot) => lot._id)).toEqual([extended, liveLot]);
    expect(result[0].effectiveEndTime).toBe(NOW + 90_000);
  });

  it("ignores an extension that is already over", async () => {
    const ended = await insertAuction(t, { endTime: NOW - 5 * MIN });
    await insertLot(t, ended, { extendedEndTime: NOW - 1000 });
    expect(await strip(t)).toEqual([]);
  });

  it("does not look back further than the extension look-back", async () => {
    const old = await insertAuction(t, {
      startTime: NOW - 3 * 24 * HOUR,
      endTime: NOW - 24 * HOUR - 1,
    });
    await insertLot(t, old, { extendedEndTime: NOW + MIN });
    expect(await strip(t)).toEqual([]);
  });

  it("excludes a lot extended beyond the window", async () => {
    const auction = await insertAuction(t);
    await insertLot(t, auction, { extendedEndTime: NOW + 25 * HOUR });
    expect(await strip(t)).toEqual([]);
  });

  it("excludes hidden, unassigned, draft and settled lots", async () => {
    const auction = await insertAuction(t);
    const visible = await insertLot(t, auction);
    await insertLot(t, auction, { hiddenByFlags: true });
    await insertLot(t, auction, { status: "draft" });
    await insertLot(t, auction, { status: "approved", auctionId: undefined });
    await insertLot(t, auction, { status: "sold" });
    await insertLot(t, auction, { status: "pending_review" });
    expect((await strip(t)).map((lot) => lot._id)).toEqual([visible]);
  });

  it("excludes lots of draft, closed and not-yet-started sales", async () => {
    const draft = await insertAuction(t, { status: "draft" });
    const closed = await insertAuction(t, { status: "closed" });
    const upcoming = await insertAuction(t, {
      startTime: NOW + HOUR,
      endTime: NOW + 5 * HOUR,
    });
    await insertLot(t, draft);
    await insertLot(t, closed);
    await insertLot(t, upcoming);
    expect(await strip(t)).toEqual([]);
  });

  it("orders soonest first across sales", async () => {
    const later = await insertAuction(t, { endTime: NOW + 5 * HOUR });
    const sooner = await insertAuction(t, { endTime: NOW + HOUR });
    const laterLot = await insertLot(t, later);
    const soonerLot = await insertLot(t, sooner);
    const midLot = await insertLot(t, later, {
      extendedEndTime: NOW + 2 * HOUR,
    });
    expect((await strip(t)).map((lot) => lot._id)).toEqual([
      soonerLot,
      midLot,
      laterLot,
    ]);
  });

  it("breaks end-time ties by lot number", async () => {
    const auction = await insertAuction(t);
    const second = await insertLot(t, auction, { lotNumber: 2 });
    const first = await insertLot(t, auction, { lotNumber: 1 });
    expect((await strip(t)).map((lot) => lot._id)).toEqual([first, second]);
  });

  it("caps the result at 12 and honours a smaller or invalid limit", async () => {
    const auction = await insertAuction(t);
    for (let i = 0; i < CLOSING_SOON_LOTS_PER_AUCTION + 2; i++) {
      await insertLot(t, auction, { lotNumber: i + 1 });
    }
    expect(await strip(t, 100)).toHaveLength(CLOSING_SOON_LOT_LIMIT);
    expect(await strip(t, 3)).toHaveLength(3);
    expect(await strip(t, 0)).toHaveLength(1);
    expect(await strip(t, Number.NaN)).toHaveLength(1);
  });

  it("reads at most the per-sale lot cap and the upcoming sale cap", async () => {
    const capped = await insertAuction(t);
    for (let i = 0; i < CLOSING_SOON_LOTS_PER_AUCTION + 3; i++) {
      await insertLot(t, capped);
    }
    // Both limits together never return more than the strip limit.
    expect(await strip(t)).toHaveLength(CLOSING_SOON_LOT_LIMIT);

    for (let i = 0; i < CLOSING_SOON_UPCOMING_AUCTION_CAP + 3; i++) {
      const auction = await insertAuction(t, { endTime: NOW + (i + 3) * MIN });
      await insertLot(t, auction);
    }
    const result = await strip(t);
    expect(result).toHaveLength(CLOSING_SOON_LOT_LIMIT);
    expect(result.map((lot) => lot.effectiveEndTime)).toEqual(
      [...result.map((lot) => lot.effectiveEndTime)].sort((a, b) => a - b)
    );
  });

  it("returns the lean card shape with sale title, lot number and location", async () => {
    const auction = await insertAuction(t, { title: "Material Handling" });
    const lotId = await insertLot(t, auction, {
      lotNumber: 4,
      province: "free_state",
      currentPrice: 700,
      reservePrice: 99_999,
    });
    const [lot] = await strip(t);
    expect(lot).toEqual({
      _id: lotId,
      title: "Lot",
      make: "John Deere",
      model: "8R",
      year: 2020,
      lotNumber: 4,
      auctionId: auction,
      auctionTitle: "Material Handling",
      currentPrice: 700,
      startingPrice: 500,
      hasBids: false,
      effectiveEndTime: NOW + 2 * HOUR,
      location: "Free State",
      province: "free_state",
    });
    expect(lot).not.toHaveProperty("reservePrice");
    expect(lot).not.toHaveProperty("sellerId");
  });

  it("reports hasBids once a bid exists, even at the starting price", async () => {
    const auction = await insertAuction(t);
    const lotId = await insertLot(t, auction);
    await t.run(async (ctx) => {
      await ctx.db.insert("bids", {
        lotId,
        bidderId: "user_bidder",
        amount: 500,
        timestamp: NOW - MIN,
      });
    });
    expect((await strip(t))[0].hasBids).toBe(true);
  });

  it("does not count a voided bid as a bid", async () => {
    const auction = await insertAuction(t);
    const lotId = await insertLot(t, auction);
    await t.run(async (ctx) => {
      await ctx.db.insert("bids", {
        lotId,
        bidderId: "user_bidder",
        amount: 500,
        timestamp: NOW - MIN,
        status: "voided",
      });
    });
    expect((await strip(t))[0].hasBids).toBe(false);
  });

  it("uses the same lead-image priority as the event cards", async () => {
    const auction = await insertAuction(t);
    await insertLot(t, auction, {
      lotNumber: 1,
      images: {
        rear: "https://cdn/rear.jpg",
        cabin: "https://cdn/cabin.jpg",
        front: "https://cdn/front.jpg",
      },
    });
    await insertLot(t, auction, {
      lotNumber: 2,
      images: { engine: "https://cdn/engine.jpg" },
    });
    await insertLot(t, auction, {
      lotNumber: 3,
      images: ["https://cdn/legacy.jpg", "https://cdn/legacy2.jpg"],
    });
    await insertLot(t, auction, { lotNumber: 4 });
    const result = await strip(t);
    expect(result.map((lot) => lot.leadImageUrl)).toEqual([
      "https://cdn/front.jpg",
      "https://cdn/engine.jpg",
      "https://cdn/legacy.jpg",
      undefined,
    ]);
  });
});
