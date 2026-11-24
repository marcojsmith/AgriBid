/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import { MS_PER_DAY, MS_PER_HOUR } from "./constants";
import { bidCounterName } from "./lib/lotCounters";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

type TestContext = ReturnType<typeof makeContext>;

/**
 * Builds a convex-test backend.
 *
 * @returns The test context
 */
function makeContext() {
  return convexTest(schema, modules);
}

const NOW = 1_800_000_000_000;

/**
 * Inserts an auction.
 *
 * @param t - Test context
 * @param o - Overrides
 * @param o.status - Auction status (default published)
 * @param o.startTime - Start time (default an hour before NOW)
 * @param o.endTime - End time (default a day after NOW)
 * @param o.title - Sale title
 * @returns The auction id
 */
async function makeAuction(
  t: TestContext,
  o: {
    status?: "draft" | "published" | "closed";
    startTime?: number;
    endTime?: number;
    title?: string;
  } = {}
): Promise<Id<"auctions">> {
  return await t.run((ctx) =>
    ctx.db.insert("auctions", {
      title: o.title ?? "Year End Auction",
      startTime: o.startTime ?? NOW - MS_PER_HOUR,
      endTime: o.endTime ?? NOW + MS_PER_DAY,
      status: o.status ?? "published",
      createdBy: "admin",
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}

interface LotSpec {
  status?: "assigned" | "sold" | "unsold" | "draft" | "pending_review";
  lotNumber?: number;
  hidden?: boolean;
  price?: number;
  image?: string;
  extendedEndTime?: number;
  province?: "western_cape";
  location?: string;
}

/**
 * Inserts a lot.
 *
 * @param t - Test context
 * @param auctionId - Parent sale
 * @param s - Lot overrides
 * @returns The lot id
 */
async function makeLot(
  t: TestContext,
  auctionId: Id<"auctions"> | undefined,
  s: LotSpec = {}
): Promise<Id<"lots">> {
  return await t.run((ctx) =>
    ctx.db.insert("lots", {
      title: "T6070",
      make: "New Holland",
      model: "T6070",
      year: 2016,
      operatingHours: 100,
      location: s.location ?? "Malmesbury, ZA",
      province: s.province,
      reservePrice: 999_999,
      startingPrice: 400_000,
      currentPrice: s.price ?? 400_000,
      minIncrement: 1000,
      sellerId: "seller-secret",
      winnerId: "winner-secret",
      status: s.status ?? "assigned",
      auctionId,
      lotNumber: s.lotNumber,
      hiddenByFlags: s.hidden,
      extendedEndTime: s.extendedEndTime,
      images: s.image ? [s.image] : [],
    })
  );
}

const LOT_KEYS = [
  "bidCount",
  "closeTime",
  "auctionStartTime",
  "currentPrice",
  "imageUrl",
  "lotNumber",
  "make",
  "model",
  "place",
  "startingPrice",
  "status",
  "title",
].sort();

describe("getLotShare", () => {
  it("returns only the public share fields", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, {
      lotNumber: 3,
      province: "western_cape",
      image: "https://example.com/a.jpg",
    });
    const share = await t.query(api.share.getLotShare, { lotId });
    expect(share).not.toBeNull();
    expect(Object.keys(share ?? {}).sort()).toEqual(LOT_KEYS);
    expect(JSON.stringify(share)).not.toMatch(
      /seller-secret|winner-secret|999999/
    );
    expect(share?.place).toBe("Malmesbury, Western Cape");
    expect(share?.imageUrl).toBe("https://example.com/a.jpg");
    expect(share?.lotNumber).toBe(3);
  });

  it("uses the extended end time and the bid counter", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const extended = NOW + 2 * MS_PER_DAY;
    const lotId = await makeLot(t, auctionId, { extendedEndTime: extended });
    await t.run((ctx) =>
      ctx.db.insert("counters", {
        name: bidCounterName(lotId),
        total: 4,
        active: 0,
        updatedAt: NOW,
      })
    );
    const share = await t.query(api.share.getLotShare, { lotId });
    expect(share?.closeTime).toBe(extended);
    expect(share?.bidCount).toBe(4);
  });

  it("falls back to the sale end and shows sold lots", async () => {
    const t = makeContext();
    const endTime = NOW + MS_PER_DAY;
    const auctionId = await makeAuction(t, { endTime });
    const lotId = await makeLot(t, auctionId, { status: "sold" });
    const share = await t.query(api.share.getLotShare, { lotId });
    expect(share?.status).toBe("sold");
    expect(share?.closeTime).toBe(endTime);
    expect(share?.bidCount).toBe(0);
  });

  it("is null for draft, pending, hidden, unassigned and draft-sale lots", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const draftSale = await makeAuction(t, { status: "draft" });
    const ids = [
      await makeLot(t, auctionId, { status: "draft" }),
      await makeLot(t, auctionId, { status: "pending_review" }),
      await makeLot(t, auctionId, { hidden: true }),
      await makeLot(t, undefined),
      await makeLot(t, draftSale),
    ];
    for (const lotId of ids) {
      expect(await t.query(api.share.getLotShare, { lotId })).toBeNull();
    }
  });
});

describe("getSaleShare", () => {
  it("is null for a draft sale", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t, { status: "draft" });
    expect(await t.query(api.share.getSaleShare, { auctionId })).toBeNull();
  });

  it("ranks engaged lots first and tops up in lot order", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const one = await makeLot(t, auctionId, {
      lotNumber: 1,
      image: "https://example.com/1.jpg",
    });
    await makeLot(t, auctionId, {
      lotNumber: 2,
      image: "https://example.com/2.jpg",
    });
    const three = await makeLot(t, auctionId, {
      lotNumber: 3,
      image: "https://example.com/3.jpg",
    });
    await makeLot(t, auctionId, { lotNumber: 4 });
    await makeLot(t, auctionId, { lotNumber: 5, hidden: true });
    await t.run(async (ctx) => {
      await ctx.db.insert("engagementScores", {
        lotId: three,
        auctionId,
        lotNumber: 3,
        bids: 2,
        watchers: 0,
        views: 0,
        score: 6,
        updatedAt: NOW,
      });
      await ctx.db.insert("engagementScores", {
        lotId: one,
        auctionId,
        lotNumber: 1,
        bids: 0,
        watchers: 1,
        views: 0,
        score: 2,
        updatedAt: NOW,
      });
    });
    const share = await t.query(api.share.getSaleShare, { auctionId });
    expect(share?.status).toBe("published");
    expect(share?.imageUrls).toEqual([
      "https://example.com/3.jpg",
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
    ]);
    expect(share?.lotCount).toBe(4);
    expect(share?.soldCount).toBeUndefined();
  });

  it("uses the lot counter when present", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    await t.run((ctx) =>
      ctx.db.insert("counters", {
        name: `lots:${auctionId}`,
        total: 85,
        active: 0,
        updatedAt: NOW,
      })
    );
    const share = await t.query(api.share.getSaleShare, { auctionId });
    expect(share?.lotCount).toBe(85);
    expect(share?.imageUrls).toEqual([]);
  });

  it("counts sold lots and shows the dearest ones for a closed sale", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t, {
      status: "closed",
      startTime: NOW - 3 * MS_PER_DAY,
      endTime: NOW - MS_PER_DAY,
    });
    await makeLot(t, auctionId, {
      status: "sold",
      price: 100,
      image: "https://example.com/cheap.jpg",
    });
    await makeLot(t, auctionId, {
      status: "sold",
      price: 900,
      image: "https://example.com/dear.jpg",
    });
    await makeLot(t, auctionId, { status: "sold", price: 500 });
    await makeLot(t, auctionId, { status: "unsold" });
    await makeLot(t, auctionId, {
      status: "sold",
      hidden: true,
      price: 9999,
      image: "https://example.com/hidden.jpg",
    });
    const share = await t.query(api.share.getSaleShare, { auctionId });
    expect(share?.status).toBe("closed");
    expect(share?.soldCount).toBe(3);
    expect(share?.lotCount).toBe(4);
    expect(share?.imageUrls).toEqual([
      "https://example.com/dear.jpg",
      "https://example.com/cheap.jpg",
    ]);
  });
});

describe("getHomeShare", () => {
  it("is null with no published sale", async () => {
    const t = makeContext();
    await makeAuction(t, { status: "draft" });
    expect(await t.query(api.share.getHomeShare, { now: NOW })).toBeNull();
  });

  it("returns the live sale with its most engaged photo", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, {
      lotNumber: 1,
      image: "https://example.com/hero.jpg",
    });
    await t.run((ctx) =>
      ctx.db.insert("engagementScores", {
        lotId,
        auctionId,
        lotNumber: 1,
        bids: 1,
        watchers: 0,
        views: 0,
        score: 3,
        updatedAt: NOW,
      })
    );
    const share = await t.query(api.share.getHomeShare, { now: NOW });
    expect(share).toMatchObject({
      title: "Year End Auction",
      phase: "live",
      lotCount: 1,
      imageUrl: "https://example.com/hero.jpg",
    });
  });

  it("returns the earliest upcoming sale when none is live", async () => {
    const t = makeContext();
    await makeAuction(t, {
      title: "Later",
      startTime: NOW + 5 * MS_PER_DAY,
      endTime: NOW + 6 * MS_PER_DAY,
    });
    await makeAuction(t, {
      title: "Sooner",
      startTime: NOW + MS_PER_DAY,
      endTime: NOW + 2 * MS_PER_DAY,
    });
    const share = await t.query(api.share.getHomeShare, { now: NOW });
    expect(share?.title).toBe("Sooner");
    expect(share?.phase).toBe("upcoming");
    expect(share?.imageUrl).toBeUndefined();
  });
});
