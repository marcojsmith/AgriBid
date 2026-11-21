/// <reference types="vite/client" />

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";

import { api } from "../../_generated/api";
import schema from "../../schema";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  AUCTION_SUMMARY_IMAGE_COUNT,
  AUCTION_SUMMARY_LOT_CAP,
  PUBLISHED_AUCTIONS_MAX_PAGE_SIZE,
} from "../../constants";
import { pickLeadImageRef } from "./events";

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
const SELLER_ID = "user_seller";
const PAGE = { numItems: 20, cursor: null };

type TestContext = ReturnType<typeof convexTest>;
type LotOverrides = Partial<Doc<"lots">>;

/**
 * Inserts an auction container.
 *
 * @param t - convex-test context
 * @param overrides - Fields overriding the live published defaults
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
        startTime: NOW - HOUR,
        endTime: NOW + HOUR,
        createdBy: "admin",
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides,
      })
  );
}

/**
 * Inserts a lot assigned to an auction.
 *
 * @param t - convex-test context
 * @param auctionId - Parent auction
 * @param overrides - Fields overriding the defaults
 * @returns The new lot id
 */
async function insertLot(
  t: TestContext,
  auctionId: Id<"auctions">,
  overrides: LotOverrides = {}
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
        sellerId: SELLER_ID,
        status: "assigned",
        auctionId,
        images: { additional: [] },
        ...overrides,
      })
  );
}

/**
 * Reads the first (only) event the public query returns.
 *
 * @param t - convex-test context
 * @returns The first page item
 */
async function firstEvent(t: TestContext) {
  const result = await t.query(api.auctions.getPublishedAuctions, {
    paginationOpts: PAGE,
  });
  return result.page[0];
}

describe("getPublishedAuctions event summary", () => {
  let t: TestContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    t = convexTest(schema, modules);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives live, upcoming and closed buckets", async () => {
    await insertAuction(t, { title: "live" });
    await insertAuction(t, {
      title: "upcoming",
      startTime: NOW + HOUR,
      endTime: NOW + 2 * HOUR,
    });
    await insertAuction(t, {
      title: "ended-but-published",
      startTime: NOW - 3 * HOUR,
      endTime: NOW - HOUR,
    });
    await insertAuction(t, { title: "closed", status: "closed" });
    await insertAuction(t, { title: "draft", status: "draft" });

    const { page } = await t.query(api.auctions.getPublishedAuctions, {
      paginationOpts: PAGE,
    });
    const byTitle = Object.fromEntries(page.map((e) => [e.title, e.bucket]));
    expect(byTitle).toEqual({
      live: "live",
      upcoming: "upcoming",
      "ended-but-published": "closed",
      closed: "closed",
    });
  });

  it("keeps a published auction live while a soft-close extension runs", async () => {
    const auctionId = await insertAuction(t, {
      startTime: NOW - 2 * HOUR,
      endTime: NOW - 1000,
    });
    await insertLot(t, auctionId, { extendedEndTime: NOW + 60_000 });
    expect((await firstEvent(t)).bucket).toBe("live");
  });

  it("returns an empty summary for an auction with no lots", async () => {
    await insertAuction(t);
    expect(await firstEvent(t)).toMatchObject({
      lotCount: 0,
      lotCountCapped: false,
      fromPrice: null,
      leadImageUrls: [],
      location: null,
    });
  });

  it("counts only buyer-visible lots", async () => {
    const auctionId = await insertAuction(t);
    await insertLot(t, auctionId);
    await insertLot(t, auctionId, { status: "sold" });
    await insertLot(t, auctionId, { status: "unsold" });
    await insertLot(t, auctionId, { hiddenByFlags: true });
    await insertLot(t, auctionId, { hiddenByFlags: false });
    for (const status of [
      "draft",
      "pending_review",
      "approved",
      "rejected",
    ] as const) {
      await insertLot(t, auctionId, { status });
    }
    const event = await firstEvent(t);
    expect(event.lotCount).toBe(4);
    expect(event.lotCountCapped).toBe(false);
  });

  it("uses the lowest current price, with and without bids", async () => {
    const auctionId = await insertAuction(t);
    await insertLot(t, auctionId, { startingPrice: 800, currentPrice: 800 });
    const cheapId = await insertLot(t, auctionId, {
      startingPrice: 300,
      currentPrice: 300,
    });
    expect((await firstEvent(t)).fromPrice).toBe(300);

    // A bid raises the cheapest lot; the next-lowest now sets the floor.
    await t.run(async (ctx) => {
      await ctx.db.patch("lots", cheapId, { currentPrice: 900 });
    });
    expect((await firstEvent(t)).fromPrice).toBe(800);
  });

  it("ignores hidden lots for the price and the location", async () => {
    const auctionId = await insertAuction(t);
    await insertLot(t, auctionId, {
      hiddenByFlags: true,
      currentPrice: 1,
      location: "Hidden",
    });
    await insertLot(t, auctionId, { currentPrice: 700, location: "Limpopo" });
    expect(await firstEvent(t)).toMatchObject({
      fromPrice: 700,
      location: "Limpopo",
    });
  });

  it("prices only still-open lots on a live sale", async () => {
    const auctionId = await insertAuction(t);
    await insertLot(t, auctionId, { status: "sold", currentPrice: 50 });
    await insertLot(t, auctionId, { currentPrice: 400 });
    expect((await firstEvent(t)).fromPrice).toBe(400);
  });

  it("prices settled lots on a closed sale", async () => {
    const auctionId = await insertAuction(t, { status: "closed" });
    await insertLot(t, auctionId, { status: "sold", currentPrice: 50 });
    await insertLot(t, auctionId, { status: "unsold", currentPrice: 90 });
    expect((await firstEvent(t)).fromPrice).toBe(50);
  });

  it("skips a lot whose photo cannot be resolved in favour of the next", async () => {
    const auctionId = await insertAuction(t);
    const deleted = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["x"]));
      await ctx.storage.delete(id);
      return id;
    });
    await insertLot(t, auctionId, { images: { front: deleted } });
    await insertLot(t, auctionId, { images: { front: "https://cdn/ok.jpg" } });
    expect((await firstEvent(t)).leadImageUrls).toEqual(["https://cdn/ok.jpg"]);
  });

  it("resolves storage ids to URLs", async () => {
    const auctionId = await insertAuction(t);
    const stored = await t.run(
      async (ctx) => await ctx.storage.store(new Blob(["img"]))
    );
    await insertLot(t, auctionId, { images: { front: stored } });
    const [url] = (await firstEvent(t)).leadImageUrls;
    expect(url).toBeDefined();
    expect(url).toMatch(/^https?:\/\//);
  });

  it("clamps oversized pages", async () => {
    for (let i = 0; i < 26; i++) {
      await insertAuction(t, { title: `s${String(i)}` });
    }
    const result = await t.query(api.auctions.getPublishedAuctions, {
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(result.page).toHaveLength(PUBLISHED_AUCTIONS_MAX_PAGE_SIZE);
    expect(result.isDone).toBe(false);
    expect(result.continueCursor).toBe(
      String(PUBLISHED_AUCTIONS_MAX_PAGE_SIZE)
    );
  });

  it("takes the location of the first lot in the sale", async () => {
    const auctionId = await insertAuction(t);
    await insertLot(t, auctionId, { location: "Western Cape" });
    await insertLot(t, auctionId, { location: "Gauteng" });
    expect((await firstEvent(t)).location).toBe("Western Cape");
  });

  it("returns one lead photo per lot, capped at three, in sale order", async () => {
    const auctionId = await insertAuction(t);
    for (const n of [1, 2, 3, 4]) {
      await insertLot(t, auctionId, {
        images: { front: `https://cdn/${String(n)}.jpg`, additional: [] },
      });
    }
    const event = await firstEvent(t);
    expect(event.leadImageUrls).toHaveLength(AUCTION_SUMMARY_IMAGE_COUNT);
    expect(event.leadImageUrls).toEqual([
      "https://cdn/1.jpg",
      "https://cdn/2.jpg",
      "https://cdn/3.jpg",
    ]);
  });

  it("skips lots without an image and handles legacy array images", async () => {
    const auctionId = await insertAuction(t);
    await insertLot(t, auctionId, { images: { additional: [] } });
    await insertLot(t, auctionId, { images: ["https://cdn/legacy.jpg"] });
    await insertLot(t, auctionId, { images: [] });
    await insertLot(t, auctionId, {
      images: { cabin: "https://cdn/cabin.jpg", additional: [] },
    });
    expect((await firstEvent(t)).leadImageUrls).toEqual([
      "https://cdn/legacy.jpg",
      "https://cdn/cabin.jpg",
    ]);
  });

  it("flags and bounds the lot count when a status hits the cap", async () => {
    const auctionId = await insertAuction(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < AUCTION_SUMMARY_LOT_CAP + 5; i++) {
        await ctx.db.insert("lots", {
          title: `Lot ${String(i)}`,
          make: "Fendt",
          model: "700",
          year: 2021,
          operatingHours: 10,
          location: "KZN",
          reservePrice: 1,
          startingPrice: 1,
          currentPrice: 1,
          minIncrement: 1,
          sellerId: SELLER_ID,
          status: "assigned",
          auctionId,
          images: { additional: [] },
        });
      }
    });
    const event = await firstEvent(t);
    expect(event.lotCount).toBe(AUCTION_SUMMARY_LOT_CAP);
    expect(event.lotCountCapped).toBe(true);
  });

  it("still paginates with the manual cursor", async () => {
    for (const title of ["a", "b", "c"]) {
      await insertAuction(t, { title });
    }
    const first = await t.query(api.auctions.getPublishedAuctions, {
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(first.page).toHaveLength(2);
    expect(first.isDone).toBe(false);
    const second = await t.query(api.auctions.getPublishedAuctions, {
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect(second.page).toHaveLength(1);
    expect(second.isDone).toBe(true);
  });
});

describe("pickLeadImageRef", () => {
  it("prefers front, cabin, engine, rear, then additional[0]", () => {
    expect(pickLeadImageRef({ front: "f", cabin: "c" })).toBe("f");
    expect(pickLeadImageRef({ cabin: "c", engine: "e" })).toBe("c");
    expect(pickLeadImageRef({ engine: "e", rear: "r" })).toBe("e");
    expect(pickLeadImageRef({ rear: "r", additional: ["a"] })).toBe("r");
    expect(pickLeadImageRef({ additional: ["a", "b"] })).toBe("a");
  });

  it("ignores blank entries and returns undefined with no image", () => {
    expect(pickLeadImageRef({ front: "  ", engine: "e" })).toBe("e");
    expect(pickLeadImageRef({})).toBeUndefined();
    expect(pickLeadImageRef([])).toBeUndefined();
    expect(pickLeadImageRef(["", "x"])).toBe("x");
  });
});
