/// <reference types="vite/client" />

/**
 * A standing proxy bid only counts while its owner may still bid: documents
 * approved and, when the deposit setting is on, the deposit received.
 */

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";

const globbedModules = import.meta.glob("../**/*.*s");
const modules: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(globbedModules).map(([path, load]) => [
    path.startsWith("./") ? `../auctions/${path.slice(2)}` : path,
    load,
  ])
);

const SELLER = "user_seller";
const ALICE = "user_alice";
const BOB = "user_bob";

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

/**
 * Seeds a sale with one open lot, Alice (verified, deposit received) and Bob
 * with a standing proxy.
 *
 * @param t - Test context
 * @param bob - Bob's profile overrides and whether he has a received deposit
 * @param bob.profile - Profile overrides
 * @param bob.deposit - Whether Bob has a received deposit
 * @returns The lot id
 */
async function seed(
  t: Ctx,
  bob: { profile?: Partial<Doc<"profiles">>; deposit: boolean }
): Promise<Id<"lots">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    for (const userId of [ALICE, BOB]) {
      await ctx.db.insert("profiles", {
        userId,
        role: "buyer",
        isVerified: true,
        kycStatus: "verified",
        createdAt: now,
        updatedAt: now,
        ...(userId === BOB ? bob.profile : {}),
      });
    }
    for (const userId of bob.deposit ? [ALICE, BOB] : [ALICE]) {
      await ctx.db.insert("registrationDeposits", {
        userId,
        reference: `AB-${userId.slice(-5).toUpperCase()}`,
        status: "received",
        amount: 5000,
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    const auctionId = await ctx.db.insert("auctions", {
      title: "Sale",
      status: "published",
      startTime: now - 60_000,
      endTime: now + 3_600_000,
      createdBy: SELLER,
      createdAt: now,
      updatedAt: now,
    });
    const lotId = await ctx.db.insert("lots", {
      title: "Lot",
      make: "John Deere",
      model: "8R",
      year: 2020,
      operatingHours: 100,
      location: "Malmesbury",
      reservePrice: 50,
      startingPrice: 100,
      currentPrice: 100,
      minIncrement: 10,
      sellerId: SELLER,
      status: "assigned",
      auctionId,
      images: [],
    });
    await ctx.db.insert("proxy_bids", {
      lotId,
      bidderId: BOB,
      maxBid: 1000,
      updatedAt: now,
    });
    return lotId;
  });
}

/**
 * Alice bids the opening price.
 *
 * @param t - Test context
 * @param lotId - The lot
 */
async function aliceBids(t: Ctx, lotId: Id<"lots">): Promise<void> {
  await t
    .withIdentity({ subject: ALICE })
    .mutation(api.auctions.mutations.bidding.placeBid, {
      lotId,
      amount: 100,
    });
}

/**
 * Reads the lot and Bob's proxy rows.
 *
 * @param t - Test context
 * @param lotId - The lot
 * @returns The lot and Bob's proxies
 */
async function read(t: Ctx, lotId: Id<"lots">) {
  return await t.run(async (ctx) => ({
    lot: await ctx.db.get("lots", lotId),
    proxies: await ctx.db
      .query("proxy_bids")
      .withIndex("by_lot", (q) => q.eq("lotId", lotId))
      .collect(),
  }));
}

describe("proxy bids and eligibility", () => {
  it("still counters for an eligible proxy owner", async () => {
    const t = makeContext();
    const lotId = await seed(t, { deposit: true });
    await aliceBids(t, lotId);
    const { lot, proxies } = await read(t, lotId);
    expect(lot?.winnerId).toBe(BOB);
    expect(proxies).toHaveLength(1);
  });

  it("stops a verified owner's proxy when the deposit is on and unpaid", async () => {
    const t = makeContext();
    const lotId = await seed(t, { deposit: false });
    await aliceBids(t, lotId);
    const { lot, proxies } = await read(t, lotId);
    expect(lot?.winnerId).toBe(ALICE);
    expect(lot?.currentPrice).toBe(100);
    expect(proxies).toHaveLength(0);
  });

  it("keeps the same proxy when the deposit setting is off", async () => {
    const t = makeContext();
    const lotId = await seed(t, { deposit: false });
    await t.run((ctx) =>
      ctx.db.insert("settings", {
        key: "deposit_enabled",
        value: false,
        updatedAt: Date.now(),
      })
    );
    await aliceBids(t, lotId);
    expect((await read(t, lotId)).lot?.winnerId).toBe(BOB);
  });

  it("stops a proxy after one of its owner's documents is rejected", async () => {
    const t = makeContext();
    const lotId = await seed(t, {
      deposit: true,
      profile: { isVerified: false, kycStatus: "rejected" },
    });
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["x"]));
      await ctx.db.insert("registrationDocuments", {
        userId: BOB,
        kind: "id_front",
        storageId,
        fileName: "a.jpg",
        fileSize: 1,
        status: "rejected",
        uploadedAt: Date.now(),
      });
    });
    await aliceBids(t, lotId);
    const { lot, proxies } = await read(t, lotId);
    expect(lot?.winnerId).toBe(ALICE);
    expect(proxies).toHaveLength(0);
  });

  it("lets the next eligible proxy win when a higher one is ineligible", async () => {
    const t = makeContext();
    const lotId = await seed(t, { deposit: false });
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("profiles", {
        userId: "user_dave",
        role: "buyer",
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("registrationDeposits", {
        userId: "user_dave",
        reference: "AB-DAVE2",
        status: "received",
        amount: 5000,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("proxy_bids", {
        lotId,
        bidderId: "user_dave",
        maxBid: 500,
        updatedAt: now,
      });
    });
    await aliceBids(t, lotId);
    const { lot, proxies } = await read(t, lotId);
    expect(lot?.winnerId).toBe("user_dave");
    expect(proxies.map((p) => p.bidderId)).toEqual(["user_dave"]);
  });
});
