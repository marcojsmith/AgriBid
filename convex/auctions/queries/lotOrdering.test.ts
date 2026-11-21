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

type TestContext = ReturnType<typeof convexTest>;

async function insertAuction(t: TestContext): Promise<Id<"auctions">> {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("auctions", {
        title: "Sale",
        status: "published",
        startTime: NOW - HOUR,
        endTime: NOW + HOUR,
        createdBy: "admin",
        createdAt: NOW,
        updatedAt: NOW,
      })
  );
}

async function insertLot(
  t: TestContext,
  auctionId: Id<"auctions">,
  title: string,
  overrides: Partial<Doc<"lots">> = {}
): Promise<Id<"lots">> {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("lots", {
        title,
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

describe("event lot ordering by lotNumber", () => {
  let t: TestContext;
  let auctionId: Id<"auctions">;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    t = convexTest(schema, modules);
    auctionId = await insertAuction(t);
    // Inserted out of order on purpose: creation order is C, A, B.
    await insertLot(t, auctionId, "C", { lotNumber: 3 });
    await insertLot(t, auctionId, "A", { lotNumber: 1 });
    await insertLot(t, auctionId, "B", { lotNumber: 2 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getActiveLots returns an event's lots in ascending lot number", async () => {
    const result = await t.query(api.auctions.getActiveLots, {
      paginationOpts: { numItems: 10, cursor: null },
      auctionId,
      statusFilter: "all",
    });
    expect(result.page.map((l) => l.title)).toEqual(["A", "B", "C"]);
    expect(result.totalCount).toBe(3);
  });

  it("keeps lot-number order for the live (active) filter", async () => {
    const result = await t.query(api.auctions.getActiveLots, {
      paginationOpts: { numItems: 10, cursor: null },
      auctionId,
      statusFilter: "active",
    });
    expect(result.page.map((l) => l.title)).toEqual(["A", "B", "C"]);
  });

  it("paginates in lot-number order without repeats or gaps", async () => {
    const first = await t.query(api.auctions.getActiveLots, {
      paginationOpts: { numItems: 2, cursor: null },
      auctionId,
      statusFilter: "all",
    });
    expect(first.page.map((l) => l.title)).toEqual(["A", "B"]);
    expect(first.isDone).toBe(false);
    // The whole sale is not counted per page; totalCount is the page size.
    expect(first.totalCount).toBe(2);
    const second = await t.query(api.auctions.getActiveLots, {
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
      auctionId,
      statusFilter: "all",
    });
    expect(second.page.map((l) => l.title)).toEqual(["C"]);
    expect(second.isDone).toBe(true);
  });

  it("applies the make filter while keeping lot-number order", async () => {
    await insertLot(t, auctionId, "D", { lotNumber: 0, make: "Fendt" });
    const result = await t.query(api.auctions.getActiveLots, {
      paginationOpts: { numItems: 10, cursor: null },
      auctionId,
      statusFilter: "all",
      make: "John Deere",
    });
    expect(result.page.map((l) => l.title)).toEqual(["A", "B", "C"]);
  });

  it("applies the hours filter on the paginated (all statuses) path", async () => {
    await insertLot(t, auctionId, "Low hours", {
      lotNumber: 4,
      operatingHours: 50,
    });
    await insertLot(t, auctionId, "High hours", {
      lotNumber: 5,
      operatingHours: 9000,
    });
    const result = await t.query(api.auctions.getActiveLots, {
      paginationOpts: { numItems: 10, cursor: null },
      auctionId,
      statusFilter: "all",
      maxHours: 100,
    });
    // A, B and C carry the default 100 hours, which is within the limit.
    expect(result.page.map((l) => l.title)).toEqual([
      "A",
      "B",
      "C",
      "Low hours",
    ]);
    expect(result.totalCount).toBe(4);
  });

  it("puts lots without a number first, in creation order", async () => {
    await insertLot(t, auctionId, "Legacy 1");
    await insertLot(t, auctionId, "Legacy 2");
    const result = await t.query(api.auctions.getActiveLots, {
      paginationOpts: { numItems: 10, cursor: null },
      auctionId,
      statusFilter: "all",
    });
    expect(result.page.map((l) => l.title)).toEqual([
      "Legacy 1",
      "Legacy 2",
      "A",
      "B",
      "C",
    ]);
  });

  it("getPublishedAuction returns the header only; the lots page through getActiveLots", async () => {
    const auction = await t.query(api.auctions.getPublishedAuction, {
      auctionId,
    });
    expect(auction).not.toHaveProperty("lots");
  });

  it("getPublishedAuction reports the latest soft-close extension as effectiveEndTime", async () => {
    await insertLot(t, auctionId, "Extended", {
      lotNumber: 4,
      extendedEndTime: NOW + 3 * HOUR,
    });
    const auction = await t.query(api.auctions.getPublishedAuction, {
      auctionId,
    });
    expect(auction?.effectiveEndTime).toBe(NOW + 3 * HOUR);
  });

  it("getPublishedAuction falls back to the scheduled end without extensions", async () => {
    const auction = await t.query(api.auctions.getPublishedAuction, {
      auctionId,
    });
    expect(auction?.effectiveEndTime).toBe(NOW + HOUR);
  });

  it("does not expose another sale's lots", async () => {
    const other = await insertAuction(t);
    await insertLot(t, other, "Other", { lotNumber: 1 });
    const result = await t.query(api.auctions.getActiveLots, {
      paginationOpts: { numItems: 10, cursor: null },
      auctionId,
      statusFilter: "all",
    });
    expect(result.page.map((l) => l.title)).not.toContain("Other");
  });
});
