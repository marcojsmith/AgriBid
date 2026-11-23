/// <reference types="vite/client" />

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";

import { api } from "../../_generated/api";
import schema from "../../schema";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  HOME_LOTS_MAX_AUCTIONS,
  HOME_LOTS_MAX_LIMIT,
  HOME_LOTS_READ_PER_AUCTION,
} from "../../constants";
import { tally } from "./homeLots";

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

type TestContext = ReturnType<typeof convexTest>;

/**
 * Inserts a live published sale ending `endsIn` ms from NOW.
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
 * Inserts an active equipment category.
 *
 * @param t - convex-test context
 * @param name - Category name
 * @param isActive - Whether the category is active
 * @returns The category id
 */
async function insertCategory(
  t: TestContext,
  name: string,
  isActive = true
): Promise<Id<"equipmentCategories">> {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("equipmentCategories", { name, isActive })
  );
}

describe("getHomeLots and getHomeFacets", () => {
  let t: TestContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    t = convexTest(schema, modules);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing for no sales", async () => {
    expect(await t.query(api.auctions.getHomeLots, { auctionIds: [] })).toEqual(
      { matched: 0, lots: [] }
    );
    expect(
      await t.query(api.auctions.getHomeFacets, { auctionIds: [] })
    ).toEqual({
      total: 0,
      capped: false,
      categories: [],
      makes: [],
      priceRange: null,
    });
  });

  it("skips draft and closed sales", async () => {
    const draft = await insertAuction(t, { status: "draft" });
    const closed = await insertAuction(t, { status: "closed" });
    await insertLot(t, draft);
    await insertLot(t, closed);
    const facets = await t.query(api.auctions.getHomeFacets, {
      auctionIds: [draft, closed],
    });
    expect(facets.total).toBe(0);
  });

  it("drops hidden and non-assigned lots", async () => {
    const sale = await insertAuction(t);
    const visible = await insertLot(t, sale);
    await insertLot(t, sale, { hiddenByFlags: true });
    await insertLot(t, sale, { status: "sold" });
    const result = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
    });
    expect(result.lots.map((lot) => lot._id)).toEqual([visible]);
    const facets = await t.query(api.auctions.getHomeFacets, {
      auctionIds: [sale],
    });
    expect(facets.total).toBe(1);
  });

  it("drops lots that already closed while the sale stays live for an extended lot", async () => {
    const sale = await insertAuction(t, {
      startTime: NOW - 3 * HOUR,
      endTime: NOW - HOUR,
    });
    await insertLot(t, sale, { lotNumber: 1 });
    const extended = await insertLot(t, sale, {
      lotNumber: 2,
      extendedEndTime: NOW + HOUR,
    });
    const result = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
    });
    expect(result.lots.map((lot) => lot._id)).toEqual([extended]);
    expect(result.matched).toBe(1);
    const facets = await t.query(api.auctions.getHomeFacets, {
      auctionIds: [sale],
    });
    expect(facets.total).toBe(1);
  });

  it("keeps every lot of an upcoming sale", async () => {
    const upcoming = await insertAuction(t, {
      startTime: NOW + HOUR,
      endTime: NOW + 5 * HOUR,
    });
    await insertLot(t, upcoming);
    const facets = await t.query(api.auctions.getHomeFacets, {
      auctionIds: [upcoming],
    });
    expect(facets.total).toBe(1);
  });

  it("counts categories and makes, ignoring inactive categories", async () => {
    const sale = await insertAuction(t);
    const tractors = await insertCategory(t, "Tractors");
    const old = await insertCategory(t, "Retired", false);
    await insertLot(t, sale, { categoryId: tractors, make: "Ford" });
    await insertLot(t, sale, { categoryId: tractors, make: "Ford" });
    await insertLot(t, sale, { categoryId: old, make: "Landini" });
    const facets = await t.query(api.auctions.getHomeFacets, {
      auctionIds: [sale],
    });
    expect(facets.categories).toEqual([
      { categoryId: tractors, name: "Tractors", count: 2 },
    ]);
    expect(facets.makes).toEqual([
      { make: "Ford", count: 2 },
      { make: "Landini", count: 1 },
    ]);
  });

  it("filters the grid by category, make and price while the facets keep their counts", async () => {
    const sale = await insertAuction(t);
    const tractors = await insertCategory(t, "Tractors");
    await insertLot(t, sale, {
      categoryId: tractors,
      make: "Ford",
      currentPrice: 100,
    });
    await insertLot(t, sale, { make: "Landini", currentPrice: 900 });
    const byMake = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
      make: "Ford",
    });
    expect(byMake.matched).toBe(1);
    const byCategory = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
      categoryId: tractors,
    });
    expect(byCategory.lots.map((lot) => lot.make)).toEqual(["Ford"]);
    const byPrice = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
      minPrice: 500,
      maxPrice: 1000,
    });
    expect(byPrice.lots.map((lot) => lot.make)).toEqual(["Landini"]);
    const facets = await t.query(api.auctions.getHomeFacets, {
      auctionIds: [sale],
    });
    expect(facets.total).toBe(2);
    expect(facets.makes).toHaveLength(2);
    expect(facets.priceRange).toEqual({ min: 100, max: 900 });
  });

  it("orders by close time then lot number and reads counters", async () => {
    const soon = await insertAuction(t, { endTime: NOW + HOUR });
    const later = await insertAuction(t, { endTime: NOW + 5 * HOUR });
    const laterLot = await insertLot(t, later, { lotNumber: 1 });
    const second = await insertLot(t, soon, { lotNumber: 2 });
    const first = await insertLot(t, soon, { lotNumber: 1 });
    await t.run(async (ctx) => {
      await ctx.db.insert("counters", {
        name: `watchers:${first}`,
        total: 4,
        updatedAt: NOW,
      });
    });
    const result = await t.query(api.auctions.getHomeLots, {
      auctionIds: [later, soon],
    });
    expect(result.lots.map((lot) => lot._id)).toEqual([
      first,
      second,
      laterLot,
    ]);
    expect(result.lots[0].watchers).toBe(4);
    expect(result.lots[2].effectiveEndTime).toBe(NOW + 5 * HOUR);
  });

  it("computes the reserve state on the server without leaking the amount", async () => {
    const sale = await insertAuction(t);
    const none = await insertLot(t, sale, { lotNumber: 1, reservePrice: 0 });
    // Reserve at or below the opening price: still "applies" before a bid.
    const applies = await insertLot(t, sale, {
      lotNumber: 2,
      reservePrice: 400,
      currentPrice: 500,
    });
    const met = await insertLot(t, sale, {
      lotNumber: 3,
      reservePrice: 1000,
      currentPrice: 1200,
    });
    const notMet = await insertLot(t, sale, {
      lotNumber: 4,
      reservePrice: 1000,
      currentPrice: 800,
    });
    await t.run(async (ctx) => {
      for (const lotId of [met, notMet]) {
        await ctx.db.insert("counters", {
          name: `bids:${lotId}`,
          total: 2,
          updatedAt: NOW,
        });
      }
    });
    const result = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
    });
    const state = Object.fromEntries(
      result.lots.map((lot) => [lot._id, lot.reserveState])
    );
    expect(state[none]).toBe("none");
    expect(state[applies]).toBe("applies");
    expect(state[met]).toBe("met");
    expect(state[notMet]).toBe("not_met");
    for (const lot of result.lots) {
      expect(lot).not.toHaveProperty("reservePrice");
    }
  });

  it("uses a lot's extended end time", async () => {
    const sale = await insertAuction(t);
    await insertLot(t, sale, { extendedEndTime: NOW + 3 * HOUR });
    const result = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
    });
    expect(result.lots[0].effectiveEndTime).toBe(NOW + 3 * HOUR);
  });

  it("clamps the limit to 1..HOME_LOTS_MAX_LIMIT", async () => {
    const sale = await insertAuction(t);
    for (let i = 0; i < HOME_LOTS_MAX_LIMIT + 2; i += 1) {
      await insertLot(t, sale, { lotNumber: i + 1 });
    }
    const many = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
      limit: 1000,
    });
    expect(many.lots).toHaveLength(HOME_LOTS_MAX_LIMIT);
    expect(many.matched).toBe(HOME_LOTS_MAX_LIMIT + 2);
    const one = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
      limit: 0,
    });
    expect(one.lots).toHaveLength(1);
    const dflt = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
    });
    expect(dflt.lots).toHaveLength(6);
  });

  it("accepts up to HOME_LOTS_MAX_AUCTIONS sales, ignores repeats and rejects more", async () => {
    const ids: Id<"auctions">[] = [];
    for (let i = 0; i < HOME_LOTS_MAX_AUCTIONS + 1; i += 1) {
      const id = await insertAuction(t);
      await insertLot(t, id);
      ids.push(id);
    }
    const four = ids.slice(0, HOME_LOTS_MAX_AUCTIONS);
    const facets = await t.query(api.auctions.getHomeFacets, {
      auctionIds: four,
    });
    expect(facets.total).toBe(HOME_LOTS_MAX_AUCTIONS);
    const repeated = await t.query(api.auctions.getHomeFacets, {
      auctionIds: [ids[0], ids[0], ids[0]],
    });
    expect(repeated.total).toBe(1);
    await expect(
      t.query(api.auctions.getHomeLots, { auctionIds: ids })
    ).rejects.toThrow(/At most 4 auctions/);
    await expect(
      t.query(api.auctions.getHomeFacets, { auctionIds: ids })
    ).rejects.toThrow(/At most 4 auctions/);
  });

  it("caps the lots read per sale and flags it", async () => {
    const sale = await insertAuction(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < HOME_LOTS_READ_PER_AUCTION + 1; i += 1) {
        await ctx.db.insert("lots", {
          title: "Lot",
          make: "Ford",
          model: "X",
          year: 2020,
          operatingHours: 1,
          location: "Free State",
          reservePrice: 0,
          startingPrice: 1,
          currentPrice: 1,
          minIncrement: 1,
          sellerId: "user_seller",
          status: "assigned",
          auctionId: sale,
          images: { additional: [] },
        });
      }
    });
    const facets = await t.query(api.auctions.getHomeFacets, {
      auctionIds: [sale],
    });
    expect(facets.capped).toBe(true);
    expect(facets.total).toBe(HOME_LOTS_READ_PER_AUCTION);
    const grid = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
      limit: HOME_LOTS_MAX_LIMIT,
    });
    expect(grid.matched).toBe(HOME_LOTS_READ_PER_AUCTION);
  });
});

describe("tally", () => {
  it("counts largest first and skips blank values", () => {
    expect(tally(["Ford", "", "John Deere", "Ford", "  "])).toEqual([
      ["Ford", 2],
      ["John Deere", 1],
    ]);
  });
});
