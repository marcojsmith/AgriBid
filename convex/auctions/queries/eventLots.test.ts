/// <reference types="vite/client" />

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";

import { api } from "../../_generated/api";
import schema from "../../schema";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  EVENT_LOTS_MAX_LIMIT,
  EVENT_LOTS_MAX_SEARCH_LENGTH,
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

describe("event page queries", () => {
  let t: TestContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    t = convexTest(schema, modules);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getPublishedAuction", () => {
    it("returns the public header with the latest soft-close end", async () => {
      const sale = await insertAuction(t, { description: "Hello" });
      await insertLot(t, sale, { extendedEndTime: NOW + 3 * HOUR });
      await insertLot(t, sale, { extendedEndTime: NOW + 2.5 * HOUR });
      const header = await t.query(api.auctions.getPublishedAuction, {
        auctionId: sale,
      });
      expect(header).toMatchObject({
        _id: sale,
        title: "Sale",
        description: "Hello",
        status: "published",
        effectiveEndTime: NOW + 3 * HOUR,
      });
      expect(header).not.toHaveProperty("createdBy");
      expect(header).not.toHaveProperty("lots");
    });

    it("returns the sale's own buyer's premium (a fraction) when it has one", async () => {
      const own = await insertAuction(t, { defaultBuyerPremiumPct: 0.1 });
      const plain = await insertAuction(t);
      expect(
        (await t.query(api.auctions.getPublishedAuction, { auctionId: own }))
          ?.defaultBuyerPremiumPct
      ).toBe(0.1);
      expect(
        (await t.query(api.auctions.getPublishedAuction, { auctionId: plain }))
          ?.defaultBuyerPremiumPct
      ).toBeUndefined();
    });

    it("ignores soft-close extensions of hidden lots", async () => {
      const sale = await insertAuction(t);
      await insertLot(t, sale, {
        hiddenByFlags: true,
        extendedEndTime: NOW + 9 * HOUR,
      });
      const header = await t.query(api.auctions.getPublishedAuction, {
        auctionId: sale,
      });
      expect(header?.effectiveEndTime).toBe(NOW + 2 * HOUR);
    });

    it("returns null for a draft sale", async () => {
      const draft = await insertAuction(t, { status: "draft" });
      expect(
        await t.query(api.auctions.getPublishedAuction, { auctionId: draft })
      ).toBeNull();
    });

    it("returns a closed sale", async () => {
      const closed = await insertAuction(t, {
        status: "closed",
        endTime: NOW - HOUR,
      });
      const header = await t.query(api.auctions.getPublishedAuction, {
        auctionId: closed,
      });
      expect(header?.status).toBe("closed");
      expect(header?.effectiveEndTime).toBe(NOW - HOUR);
    });
  });

  describe("getEventLots", () => {
    it("returns nothing for a draft sale", async () => {
      const draft = await insertAuction(t, { status: "draft" });
      await insertLot(t, draft);
      expect(
        await t.query(api.auctions.getEventLots, { auctionId: draft })
      ).toEqual({ matched: 0, lots: [] });
    });

    it("orders by lot number, unnumbered last, and hides flagged lots", async () => {
      const sale = await insertAuction(t);
      await insertLot(t, sale, { title: "c", lotNumber: 3 });
      await insertLot(t, sale, { title: "a", lotNumber: 1 });
      await insertLot(t, sale, { title: "none" });
      await insertLot(t, sale, { title: "hidden", hiddenByFlags: true });
      await insertLot(t, sale, { title: "draft", status: "draft" });
      const { lots, matched } = await t.query(api.auctions.getEventLots, {
        auctionId: sale,
      });
      expect(matched).toBe(3);
      expect(lots.map((l) => l.title)).toEqual(["a", "c", "none"]);
    });

    it("never sends the reserve amount and hides the reserve state until a bid", async () => {
      const sale = await insertAuction(t);
      await insertLot(t, sale, { lotNumber: 1, reservePrice: 0 });
      await insertLot(t, sale, { lotNumber: 2, reservePrice: 900 });
      const { lots } = await t.query(api.auctions.getEventLots, {
        auctionId: sale,
      });
      expect(lots.map((l) => l.reserveState)).toEqual(["none", "applies"]);
      expect(JSON.stringify(lots)).not.toContain("reservePrice");
      expect(JSON.stringify(lots)).not.toContain("sellerId");
    });

    it("filters by category, make, price and search", async () => {
      const sale = await insertAuction(t);
      const category = await t.run(
        async (ctx) =>
          await ctx.db.insert("equipmentCategories", {
            name: "Tractors",
            isActive: true,
          })
      );
      await insertLot(t, sale, {
        lotNumber: 1,
        make: "Case",
        model: "JX45T",
        categoryId: category,
        currentPrice: 900,
      });
      await insertLot(t, sale, {
        lotNumber: 2,
        make: "Ford",
        model: "5000",
        currentPrice: 100,
      });
      const titles = async (args: Record<string, unknown>) =>
        (
          await t.query(api.auctions.getEventLots, {
            auctionId: sale,
            ...args,
          })
        ).lots.map((l) => l.make);
      expect(await titles({ categoryId: category })).toEqual(["Case"]);
      expect(await titles({ make: "Ford" })).toEqual(["Ford"]);
      expect(await titles({ minPrice: 500 })).toEqual(["Case"]);
      expect(await titles({ maxPrice: 500 })).toEqual(["Ford"]);
      expect(await titles({ search: "jx4" })).toEqual(["Case"]);
      expect(await titles({ search: "  FORD " })).toEqual(["Ford"]);
      expect(await titles({ search: "zzz" })).toEqual([]);
    });

    it("measures the search before lowercasing it", async () => {
      const sale = await insertAuction(t);
      await insertLot(t, sale);
      // "İ" lowercases to two UTF-16 units; 31 of them must not trip the limit.
      await expect(
        t.query(api.auctions.getEventLots, {
          auctionId: sale,
          search: "İ".repeat(31),
        })
      ).resolves.toMatchObject({ matched: 0 });
    });

    it("rejects a search longer than the limit", async () => {
      const sale = await insertAuction(t);
      await expect(
        t.query(api.auctions.getEventLots, {
          auctionId: sale,
          search: "x".repeat(EVENT_LOTS_MAX_SEARCH_LENGTH + 1),
        })
      ).rejects.toThrow(/Search/);
    });

    it("sorts by price and by watchers", async () => {
      const sale = await insertAuction(t);
      const a = await insertLot(t, sale, {
        title: "a",
        lotNumber: 1,
        currentPrice: 300,
      });
      await insertLot(t, sale, { title: "b", lotNumber: 2, currentPrice: 100 });
      await insertLot(t, sale, { title: "c", lotNumber: 3, currentPrice: 200 });
      await t.run(async (ctx) => {
        await ctx.db.insert("counters", {
          name: `watchers:${a}`,
          total: 7,
          updatedAt: NOW,
        });
      });
      const order = async (sort: "price_asc" | "most_watched") =>
        (
          await t.query(api.auctions.getEventLots, {
            auctionId: sale,
            sort,
          })
        ).lots.map((l) => l.title);
      expect(await order("price_asc")).toEqual(["b", "c", "a"]);
      expect((await order("most_watched"))[0]).toBe("a");
    });

    it("paginates with a clamped limit and reports the matched count", async () => {
      const sale = await insertAuction(t);
      for (let i = 1; i <= 5; i++) await insertLot(t, sale, { lotNumber: i });
      const page = await t.query(api.auctions.getEventLots, {
        auctionId: sale,
        limit: 2,
      });
      expect(page.lots).toHaveLength(2);
      expect(page.matched).toBe(5);
      const lowest = await t.query(api.auctions.getEventLots, {
        auctionId: sale,
        limit: -4,
      });
      expect(lowest.lots).toHaveLength(1);
      const highest = await t.query(api.auctions.getEventLots, {
        auctionId: sale,
        limit: EVENT_LOTS_MAX_LIMIT + 500,
      });
      expect(highest.lots).toHaveLength(5);
    });

    it("shows sold and unsold lots of a closed sale with their outcome", async () => {
      const sale = await insertAuction(t, {
        status: "closed",
        endTime: NOW - HOUR,
      });
      await insertLot(t, sale, {
        lotNumber: 1,
        status: "sold",
        currentPrice: 52000,
      });
      await insertLot(t, sale, {
        lotNumber: 2,
        status: "unsold",
        currentPrice: 24000,
      });
      const all = await t.query(api.auctions.getEventLots, { auctionId: sale });
      expect(all.lots.map((l) => [l.status, l.currentPrice])).toEqual([
        ["sold", 52000],
        ["unsold", 24000],
      ]);
      expect(all.lots.every((l) => l.reserveState === "none")).toBe(true);
      const sold = await t.query(api.auctions.getEventLots, {
        auctionId: sale,
        outcome: "sold",
      });
      expect(sold.lots).toHaveLength(1);
      const notSold = await t.query(api.auctions.getEventLots, {
        auctionId: sale,
        outcome: "not_sold",
      });
      expect(notSold.lots.map((l) => l.status)).toEqual(["unsold"]);
    });
  });

  describe("getEventFacets", () => {
    it("counts categories, makes, price range and outcomes", async () => {
      const sale = await insertAuction(t, {
        status: "closed",
        endTime: NOW - HOUR,
      });
      const inactive = await t.run(
        async (ctx) =>
          await ctx.db.insert("equipmentCategories", {
            name: "Old",
            isActive: false,
          })
      );
      const tractors = await t.run(
        async (ctx) =>
          await ctx.db.insert("equipmentCategories", {
            name: "Tractors",
            isActive: true,
          })
      );
      await insertLot(t, sale, {
        status: "sold",
        categoryId: tractors,
        currentPrice: 1000,
      });
      await insertLot(t, sale, {
        status: "sold",
        make: "Case",
        categoryId: inactive,
        currentPrice: 3000,
      });
      await insertLot(t, sale, { status: "unsold", currentPrice: 200 });
      const facets = await t.query(api.auctions.getEventFacets, {
        auctionId: sale,
      });
      expect(facets).toEqual({
        total: 3,
        capped: false,
        categories: [{ categoryId: tractors, name: "Tractors", count: 1 }],
        makes: [
          { make: "John Deere", count: 2 },
          { make: "Case", count: 1 },
        ],
        priceRange: { min: 200, max: 3000 },
        outcomes: {
          sold: 2,
          notSold: 1,
          underConsideration: 0,
          soldTotal: 4000,
        },
      });
    });

    it("is empty for a draft or missing-lot sale", async () => {
      const draft = await insertAuction(t, { status: "draft" });
      await insertLot(t, draft);
      const facets = await t.query(api.auctions.getEventFacets, {
        auctionId: draft,
      });
      expect(facets.total).toBe(0);
      expect(facets.priceRange).toBeNull();
    });
  });
});
