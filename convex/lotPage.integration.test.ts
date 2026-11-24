/// <reference types="vite/client" />

/**
 * Integration coverage for the lot page queries: the masked bid history, the
 * caller's leading/outbid state and the lot detail's privacy rules.
 */

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import { LOT_BID_HISTORY_LIMIT } from "./auctions/queries/lotPage";
import { bidCounterName } from "./lib/lotCounters";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

const createTestContext = () => convexTest(schema, modules);
type TestContext = ReturnType<typeof createTestContext>;

const SELLER = "seller-1";
const ALICE = "alice-1";
const BOB = "bob-1";

/**
 * Inserts a lot with a reserve of 300.
 *
 * @param t - Test context
 * @param overrides - Fields to override
 * @param overrides.status - Lot status
 * @param overrides.winnerId - The winner
 * @returns The lot id
 */
async function insertLot(
  t: TestContext,
  overrides: { status?: "assigned" | "draft"; winnerId?: string } = {}
): Promise<Id<"lots">> {
  return await t.run((ctx) =>
    ctx.db.insert("lots", {
      title: "Lot",
      make: "John Deere",
      model: "8R",
      year: 2020,
      operatingHours: 100,
      location: "Malmesbury",
      reservePrice: 300,
      startingPrice: 100,
      currentPrice: 200,
      minIncrement: 10,
      sellerId: SELLER,
      status: overrides.status ?? "assigned",
      winnerId: overrides.winnerId,
      images: [],
    })
  );
}

/**
 * Inserts bids in time order and the matching valid-bid counter.
 *
 * @param t - Test context
 * @param lotId - The lot
 * @param bids - Bidder, amount and optional voided flag, oldest first
 */
async function insertBids(
  t: TestContext,
  lotId: Id<"lots">,
  bids: { bidderId: string; amount: number; voided?: boolean }[]
): Promise<void> {
  await t.run(async (ctx) => {
    let timestamp = 1_000;
    for (const bid of bids) {
      await ctx.db.insert("bids", {
        lotId,
        bidderId: bid.bidderId,
        amount: bid.amount,
        timestamp: (timestamp += 1000),
        status: bid.voided ? "voided" : "valid",
      });
    }
    await ctx.db.insert("counters", {
      name: bidCounterName(lotId),
      total: bids.filter((bid) => !bid.voided).length,
      updatedAt: Date.now(),
    });
  });
}

describe("getLotBidHistory", () => {
  it("masks other bidders, shows 'You', skips voided bids and counts valid ones", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    await insertBids(t, lotId, [
      { bidderId: ALICE, amount: 110 },
      { bidderId: BOB, amount: 120, voided: true },
      { bidderId: BOB, amount: 130 },
    ]);

    const asAlice = await t
      .withIdentity({ subject: ALICE })
      .query(api.auctions.getLotBidHistory, { lotId });

    expect(asAlice.total).toBe(2);
    expect(asAlice.bids.map((bid) => bid.amount)).toEqual([130, 110]);
    expect(asAlice.bids.map((bid) => bid.isMine)).toEqual([false, true]);
    expect(asAlice.bids[1]?.label).toBe("You");
    expect(asAlice.bids[0]?.label).toBe("Bidder 2");
    expect(JSON.stringify(asAlice)).not.toContain(BOB);
    expect(JSON.stringify(asAlice)).not.toContain(ALICE);
  });

  it("never shows 'You' to a signed-out visitor", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    await insertBids(t, lotId, [{ bidderId: ALICE, amount: 110 }]);

    const result = await t.query(api.auctions.getLotBidHistory, { lotId });

    expect(result.bids[0]?.isMine).toBe(false);
    expect(result.bids[0]?.label).not.toBe("You");
  });

  it("returns at most the newest 20 bids but the full count", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    await insertBids(
      t,
      lotId,
      Array.from({ length: LOT_BID_HISTORY_LIMIT + 5 }, (_, i) => ({
        bidderId: BOB,
        amount: 100 + i,
      }))
    );

    const result = await t.query(api.auctions.getLotBidHistory, { lotId });

    expect(result.bids).toHaveLength(LOT_BID_HISTORY_LIMIT);
    expect(result.total).toBe(LOT_BID_HISTORY_LIMIT + 5);
    expect(result.bids[0]?.amount).toBe(100 + LOT_BID_HISTORY_LIMIT + 4);
  });

  it("returns nothing for a lot that is not public", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t, { status: "draft" });
    await insertBids(t, lotId, [{ bidderId: ALICE, amount: 110 }]);

    expect(await t.query(api.auctions.getLotBidHistory, { lotId })).toEqual({
      bids: [],
      total: 0,
    });
  });
});

describe("getMyLotBidState", () => {
  it("is none for a signed-out visitor and for a user who has not bid", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    await insertBids(t, lotId, [{ bidderId: BOB, amount: 110 }]);

    const expected = { state: "none", myHighest: null };
    expect(await t.query(api.auctions.getMyLotBidState, { lotId })).toEqual(
      expected
    );
    expect(
      await t
        .withIdentity({ subject: ALICE })
        .query(api.auctions.getMyLotBidState, { lotId })
    ).toEqual(expected);
  });

  it("is leading on the top bid and outbid once someone bids higher", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    await insertBids(t, lotId, [
      { bidderId: BOB, amount: 110 },
      { bidderId: ALICE, amount: 120 },
    ]);
    const alice = t.withIdentity({ subject: ALICE });

    expect(await alice.query(api.auctions.getMyLotBidState, { lotId })).toEqual(
      { state: "leading", myHighest: 120 }
    );

    await insertBids(t, lotId, [{ bidderId: BOB, amount: 130 }]);
    expect(await alice.query(api.auctions.getMyLotBidState, { lotId })).toEqual(
      { state: "outbid", myHighest: 120 }
    );
  });

  it("ignores voided bids when finding the leader", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    await insertBids(t, lotId, [
      { bidderId: ALICE, amount: 120 },
      { bidderId: BOB, amount: 500, voided: true },
    ]);

    const result = await t
      .withIdentity({ subject: ALICE })
      .query(api.auctions.getMyLotBidState, { lotId });

    expect(result).toEqual({ state: "leading", myHighest: 120 });
  });

  it("is none when the user's only bids were voided", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    await insertBids(t, lotId, [
      { bidderId: ALICE, amount: 120, voided: true },
    ]);

    const result = await t
      .withIdentity({ subject: ALICE })
      .query(api.auctions.getMyLotBidState, { lotId });

    expect(result.state).toBe("none");
  });
});

describe("getLotById privacy", () => {
  it("hides the reserve, seller id and winner id from a buyer", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t, { winnerId: BOB });
    await insertBids(t, lotId, [{ bidderId: BOB, amount: 200 }]);

    const detail = await t
      .withIdentity({ subject: ALICE })
      .query(api.auctions.getLotById, { lotId });

    expect(detail).not.toBeNull();
    expect(detail).not.toHaveProperty("reservePrice");
    expect(detail).not.toHaveProperty("sellerId");
    expect(detail).not.toHaveProperty("winnerId");
    expect(detail).toMatchObject({
      reserveState: "not_met",
      bidCount: 1,
      isSeller: false,
      isWinner: false,
    });
  });

  it("gives the seller their reserve and the winner their flag", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t, { winnerId: BOB });

    const asSeller = await t
      .withIdentity({ subject: SELLER })
      .query(api.auctions.getLotById, { lotId });
    const asWinner = await t
      .withIdentity({ subject: BOB })
      .query(api.auctions.getLotById, { lotId });

    expect(asSeller).toMatchObject({ reservePrice: 300, isSeller: true });
    expect(asWinner).toMatchObject({ isWinner: true });
    expect(asWinner).not.toHaveProperty("reservePrice");
  });

  it("resolves the buyer premium as a fraction", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    await t.run((ctx) =>
      ctx.db.patch("lots", lotId, {
        resolvedBuyerPremiumPct: 0.1,
        premiumSource: "auction",
      })
    );

    const detail = await t.query(api.auctions.getLotById, { lotId });

    expect(detail?.buyerPremiumFraction).toBe(0.1);
  });
});

describe("getLotNeighbours", () => {
  /**
   * Inserts numbered lots into one sale.
   *
   * @param t - Test context
   * @param specs - Lot number, status and hidden flag per lot
   * @returns The lot ids in the same order
   */
  async function insertSale(
    t: TestContext,
    specs: { n: number; status?: "assigned" | "draft"; hidden?: boolean }[]
  ): Promise<Id<"lots">[]> {
    return await t.run(async (ctx) => {
      const auctionId = await ctx.db.insert("auctions", {
        title: "Sale",
        startTime: 1,
        endTime: 2,
        status: "published",
        createdBy: "admin",
        createdAt: 1,
        updatedAt: 1,
      });
      const ids: Id<"lots">[] = [];
      for (const spec of specs) {
        ids.push(
          await ctx.db.insert("lots", {
            title: "Lot",
            make: "m",
            model: "m",
            year: 2020,
            operatingHours: 1,
            location: "x",
            reservePrice: 1,
            startingPrice: 1,
            currentPrice: 1,
            minIncrement: 1,
            sellerId: SELLER,
            status: spec.status ?? "assigned",
            auctionId,
            lotNumber: spec.n,
            hiddenByFlags: spec.hidden,
            images: [],
          })
        );
      }
      return ids;
    });
  }

  it("returns the previous and next lot, skipping hidden and non-public ones", async () => {
    const t = createTestContext();
    const [a, , , d, e] = await insertSale(t, [
      { n: 1 },
      { n: 2, hidden: true },
      { n: 3, status: "draft" },
      { n: 4 },
      { n: 5 },
    ]);

    const middle = await t.query(api.auctions.getLotNeighbours, {
      lotId: d,
    });
    expect(middle.prev?._id).toBe(a);
    expect(middle.prev?.lotNumber).toBe(1);
    expect(middle.next?._id).toBe(e);
  });

  it("is null at the ends of the sale and for lots without a number", async () => {
    const t = createTestContext();
    const [first, last] = await insertSale(t, [{ n: 1 }, { n: 2 }]);
    expect(
      await t.query(api.auctions.getLotNeighbours, {
        lotId: first,
      })
    ).toMatchObject({ prev: null, next: { lotNumber: 2 } });
    expect(
      await t.query(api.auctions.getLotNeighbours, {
        lotId: last,
      })
    ).toMatchObject({ prev: { lotNumber: 1 }, next: null });

    const loose = await insertLot(t);
    expect(
      await t.query(api.auctions.getLotNeighbours, { lotId: loose })
    ).toEqual({ prev: null, next: null });
  });
});

describe("getLotHeadline", () => {
  /**
   * Inserts a sale in the given status.
   *
   * @param t - Test context
   * @param status - Sale status
   * @returns The sale id
   */
  async function insertSale(
    t: TestContext,
    status: "draft" | "published"
  ): Promise<Id<"auctions">> {
    return await t.run((ctx) =>
      ctx.db.insert("auctions", {
        title: "Sale",
        status,
        startTime: 1,
        endTime: 9_999_999_999_999,
        createdBy: SELLER,
        createdAt: 1,
        updatedAt: 1,
      })
    );
  }

  it("returns the number, title and close time of a public lot", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    const auctionId = await insertSale(t, "published");
    await t.run((ctx) =>
      ctx.db.patch("lots", lotId, { auctionId, lotNumber: 3 })
    );
    expect(await t.query(api.auctions.getLotHeadline, { lotId })).toEqual({
      lotNumber: 3,
      title: "Lot",
      closesAt: 9_999_999_999_999,
    });
  });

  it("prefers an anti-snipe extended end time", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    const auctionId = await insertSale(t, "published");
    await t.run((ctx) =>
      ctx.db.patch("lots", lotId, { auctionId, extendedEndTime: 5_000 })
    );
    const result = await t.query(api.auctions.getLotHeadline, { lotId });
    expect(result?.closesAt).toBe(5_000);
  });

  it("hides a lot in a draft sale", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    const auctionId = await insertSale(t, "draft");
    await t.run((ctx) => ctx.db.patch("lots", lotId, { auctionId }));
    expect(await t.query(api.auctions.getLotHeadline, { lotId })).toBeNull();
  });

  it("hides a lot hidden by flags", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    const auctionId = await insertSale(t, "published");
    await t.run((ctx) =>
      ctx.db.patch("lots", lotId, { auctionId, hiddenByFlags: true })
    );
    expect(await t.query(api.auctions.getLotHeadline, { lotId })).toBeNull();
  });

  it("hides draft lots and lots outside a sale", async () => {
    const t = createTestContext();
    const draft = await insertLot(t, { status: "draft" });
    const auctionId = await insertSale(t, "published");
    await t.run((ctx) => ctx.db.patch("lots", draft, { auctionId }));
    expect(
      await t.query(api.auctions.getLotHeadline, { lotId: draft })
    ).toBeNull();

    const loose = await insertLot(t);
    expect(
      await t.query(api.auctions.getLotHeadline, { lotId: loose })
    ).toBeNull();
  });

  it("returns null for a string that is not a lot id", async () => {
    const t = createTestContext();
    expect(
      await t.query(api.auctions.getLotHeadline, { lotId: "not-an-id" })
    ).toBeNull();
    // A real id from another table is not a lot either.
    const saleId = await insertSale(t, "published");
    expect(
      await t.query(api.auctions.getLotHeadline, { lotId: saleId })
    ).toBeNull();
  });
});
