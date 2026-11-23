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

describe("getHomeLots", () => {
  let t: TestContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    t = convexTest(schema, modules);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty facets for no sales", async () => {
    const result = await t.query(api.auctions.getHomeLots, { auctionIds: [] });
    expect(result).toEqual({
      total: 0,
      matched: 0,
      capped: false,
      categories: [],
      makes: [],
      priceRange: null,
      lots: [],
    });
  });

  it("skips draft and closed sales", async () => {
    const draft = await insertAuction(t, { status: "draft" });
    const closed = await insertAuction(t, { status: "closed" });
    await insertLot(t, draft);
    await insertLot(t, closed);
    const result = await t.query(api.auctions.getHomeLots, {
      auctionIds: [draft, closed],
    });
    expect(result.total).toBe(0);
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
    expect(result.total).toBe(1);
  });

  it("counts categories and makes, ignoring inactive categories", async () => {
    const sale = await insertAuction(t);
    const tractors = await insertCategory(t, "Tractors");
    const old = await insertCategory(t, "Retired", false);
    await insertLot(t, sale, { categoryId: tractors, make: "Ford" });
    await insertLot(t, sale, { categoryId: tractors, make: "Ford" });
    await insertLot(t, sale, { categoryId: old, make: "Landini" });
    const result = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
    });
    expect(result.categories).toEqual([
      { categoryId: tractors, name: "Tractors", count: 2 },
    ]);
    expect(result.makes).toEqual([
      { make: "Ford", count: 2 },
      { make: "Landini", count: 1 },
    ]);
  });

  it("keeps facet counts while filters narrow the grid", async () => {
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
    expect(byMake.total).toBe(2);
    expect(byMake.makes).toHaveLength(2);
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
    expect(byPrice.priceRange).toEqual({ min: 100, max: 900 });
  });

  it("orders by close time then lot number and reads counters and reserve", async () => {
    const soon = await insertAuction(t, { endTime: NOW + HOUR });
    const later = await insertAuction(t, { endTime: NOW + 5 * HOUR });
    const laterLot = await insertLot(t, later, { lotNumber: 1 });
    const second = await insertLot(t, soon, {
      lotNumber: 2,
      reservePrice: 0,
    });
    const first = await insertLot(t, soon, {
      lotNumber: 1,
      currentPrice: 2000,
      reservePrice: 1500,
    });
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
    expect(result.lots[0].hasReserve).toBe(true);
    expect(result.lots[0].reserveMet).toBe(true);
    expect(result.lots[1].hasReserve).toBe(false);
    expect(result.lots[2].effectiveEndTime).toBe(NOW + 5 * HOUR);
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

  it("reads at most HOME_LOTS_MAX_AUCTIONS sales and ignores duplicates", async () => {
    const ids: Id<"auctions">[] = [];
    for (let i = 0; i < HOME_LOTS_MAX_AUCTIONS + 1; i += 1) {
      const id = await insertAuction(t);
      await insertLot(t, id);
      ids.push(id);
    }
    const result = await t.query(api.auctions.getHomeLots, {
      auctionIds: [...ids, ids[0]],
    });
    expect(result.total).toBe(HOME_LOTS_MAX_AUCTIONS);
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
    const result = await t.query(api.auctions.getHomeLots, {
      auctionIds: [sale],
    });
    expect(result.capped).toBe(true);
    expect(result.total).toBe(HOME_LOTS_READ_PER_AUCTION);
  });
});
