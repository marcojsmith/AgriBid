/// <reference types="vite/client" />

/**
 * M2 "bidding extras" against an in-memory Convex backend: auto-watch on bid,
 * the deposit refund request, the My bids overview, the three push switches and
 * the pay-by reminder.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { SMALL_INCREMENT_AMOUNT } from "./constants";
import { nextMinBid } from "./lib/nextMinBid";
import { createLotPayment } from "./lib/lotPayments";
import {
  PAY_BY_REMINDER_BATCH,
  sendPayByRemindersHandler,
} from "./lib/payByReminders";
import { pushToUser } from "./lib/pushToUser";
import { ensureWatching } from "./lib/watching";
import { sendDueSaleRemindersHandler } from "./push";
import schema from "./schema";
import { sendClosingSoonAlertsHandler } from "./watchAlerts";

const modules = import.meta.glob("./**/*.*s");

const SELLER = "user_seller";
const PRIVATE_SELLER = "user_private_seller";
const ALICE = "user_alice";
const BOB = "user_bob";
const ADMIN = "user_admin";
const HOUR = 60 * 60 * 1000;
const SECOND = 1000;

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;
type DbCtx = Parameters<Parameters<Ctx["run"]>[0]>[0];

const as = (t: Ctx, subject: string) => t.withIdentity({ subject });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * Seeds an admin, two sellers (one VAT registered, one private) and two buyers,
 * the lots counter, an active 5% buyer premium, a live sale, the deposit
 * setting off and one push subscription per buyer.
 *
 * @param t - Test context
 * @returns The sale id
 */
async function seedWorld(t: Ctx): Promise<Id<"auctions">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const profiles: [string, "buyer" | "seller" | "admin", object][] = [
      [ADMIN, "admin", {}],
      [SELLER, "seller", { name: "Seller Co", vatRegistered: true }],
      [PRIVATE_SELLER, "seller", { vatRegistered: false }],
      [ALICE, "buyer", { name: "Alice" }],
      [BOB, "buyer", { name: "Bob" }],
    ];
    for (const [userId, role, extra] of profiles) {
      await ctx.db.insert("profiles", {
        userId,
        role,
        isVerified: true,
        createdAt: now,
        updatedAt: now,
        ...extra,
      });
    }
    for (const userId of [ALICE, BOB]) {
      await ctx.db.insert("pushSubscriptions", {
        userId,
        endpoint: `https://fcm.googleapis.com/${userId}`,
        p256dh: "p256",
        auth: "auth",
        createdAt: now,
      });
    }
    await ctx.db.insert("counters", {
      name: "lots",
      total: 0,
      active: 0,
      soldCount: 0,
      salesVolume: 0,
      updatedAt: now,
    });
    await ctx.db.insert("settings", {
      key: "deposit_enabled",
      value: false,
      updatedAt: now,
    });
    await ctx.db.insert("platformFees", {
      name: "Buyer Premium",
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
      visibleToBuyer: true,
      visibleToSeller: false,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.insert("auctions", {
      title: "November Sale",
      status: "published",
      startTime: now - 10 * 60_000,
      endTime: now + 10 * 60_000,
      createdBy: SELLER,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Inserts a lot.
 *
 * @param t - Test context
 * @param auctionId - The sale
 * @param overrides - Field overrides
 * @returns The lot id
 */
async function insertLot(
  t: Ctx,
  auctionId: Id<"auctions"> | undefined,
  overrides: Partial<Doc<"lots">> = {}
): Promise<Id<"lots">> {
  return await t.run(async (ctx) => {
    const categoryId = await ctx.db.insert("equipmentCategories", {
      name: `Tractors ${String(Math.random())}`,
      isActive: true,
    });
    return await ctx.db.insert("lots", {
      title: "John Deere 8R",
      make: "John Deere",
      model: "8R",
      year: 2020,
      operatingHours: 1000,
      location: "Bloemfontein",
      categoryId,
      reservePrice: 5000,
      startingPrice: 1000,
      currentPrice: 1000,
      minIncrement: 100,
      sellerId: SELLER,
      status: "assigned",
      auctionId,
      lotNumber: 7,
      images: { additional: [] },
      createdAt: Date.now(),
      ...overrides,
    });
  });
}

/**
 * Inserts a (non-proxy) bid row.
 *
 * @param t - Test context
 * @param lotId - The lot
 * @param bidderId - The bidder
 * @param amount - The amount
 * @param extra - Field overrides (e.g. `status: "voided"`, `timestamp`)
 */
async function insertBid(
  t: Ctx,
  lotId: Id<"lots">,
  bidderId: string,
  amount: number,
  extra: Partial<Doc<"bids">> = {}
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("bids", {
      lotId,
      bidderId,
      amount,
      timestamp: Date.now(),
      status: "valid",
      ...extra,
    });
  });
}

/** Moves the fake clock forward past the bid cooldown. */
const pastCooldown = () => {
  vi.setSystemTime(Date.now() + 2 * SECOND);
};

const bid = (
  t: Ctx,
  user: string,
  lotId: Id<"lots">,
  amount: number,
  maxBid?: number
) =>
  as(t, user).mutation(api.auctions.mutations.bidding.placeBid, {
    lotId,
    amount,
    maxBid,
  });

const watchRows = (t: Ctx, userId: string, lotId: Id<"lots">) =>
  t.run((ctx) =>
    ctx.db
      .query("watchlist")
      .withIndex("by_user_lot", (q) =>
        q.eq("userId", userId).eq("lotId", lotId)
      )
      .collect()
  );

const watcherCounter = (t: Ctx, lotId: Id<"lots">) =>
  t.run(async (ctx) => {
    const row = await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("name"), `watchers:${lotId}`))
      .first();
    return row?.total ?? 0;
  });

const notificationsFor = (t: Ctx, userId: string) =>
  t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .collect()
  );

const pushBatches = async (t: Ctx) =>
  (
    await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())
  ).filter((s) => s.name.includes("sendPushBatch"));

const setPrefs = (
  t: Ctx,
  userId: string,
  prefs: Partial<Doc<"userPreferences">>
) =>
  t.run((ctx) =>
    ctx.db.insert("userPreferences", {
      userId,
      updatedAt: Date.now(),
      ...prefs,
    })
  );

describe("auto-watch on bid", () => {
  it("the first bid watches the lot and counts one watcher", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);

    await bid(t, ALICE, lotId, 1000);

    expect(await watchRows(t, ALICE, lotId)).toHaveLength(1);
    expect(await watcherCounter(t, lotId)).toBe(1);
  });

  it("a second bid adds no duplicate and no counter change", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);

    await bid(t, ALICE, lotId, 1000);
    pastCooldown();
    await bid(t, BOB, lotId, 1100);
    pastCooldown();
    await bid(t, ALICE, lotId, 1200);

    expect(await watchRows(t, ALICE, lotId)).toHaveLength(1);
    expect(await watcherCounter(t, lotId)).toBe(2);
  });

  it("changes nothing for a user who already watches the lot", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await as(t, ALICE).mutation(api.watchlist.toggleWatchlist, { lotId });
    expect(await watcherCounter(t, lotId)).toBe(1);

    await bid(t, ALICE, lotId, 1000);

    expect(await watchRows(t, ALICE, lotId)).toHaveLength(1);
    expect(await watcherCounter(t, lotId)).toBe(1);
  });

  it("a failed bid adds no watch", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);

    await expect(bid(t, ALICE, lotId, 500)).rejects.toThrow(
      "First bid must be at least"
    );

    expect(await watchRows(t, ALICE, lotId)).toHaveLength(0);
    expect(await watcherCounter(t, lotId)).toBe(0);
  });

  it("does not watch for the user a proxy counter-bid is placed for", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);

    await bid(t, ALICE, lotId, 1000, 5000);
    // Alice stops watching, then Bob's bid triggers her standing proxy.
    await as(t, ALICE).mutation(api.watchlist.toggleWatchlist, { lotId });
    expect(await watchRows(t, ALICE, lotId)).toHaveLength(0);
    pastCooldown();
    await bid(t, BOB, lotId, 1500);

    const bids = await t.run((ctx) =>
      ctx.db
        .query("bids")
        .withIndex("by_lot", (q) => q.eq("lotId", lotId))
        .collect()
    );
    expect(bids.some((b) => b.bidderId === ALICE && b.amount > 1500)).toBe(
      true
    );
    expect(await watchRows(t, ALICE, lotId)).toHaveLength(0);
    expect(await watchRows(t, BOB, lotId)).toHaveLength(1);
  });

  it("ensureWatching reports whether a watch was added", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    const run = () => t.run((ctx) => ensureWatching(ctx, ALICE, lotId));
    expect(await run()).toBe(true);
    expect(await run()).toBe(false);
    expect(await watcherCounter(t, lotId)).toBe(1);
  });
});

describe("deposit refund request", () => {
  const asAlice = (t: Ctx) => as(t, ALICE);

  /**
   * Inserts Alice's deposit.
   *
   * @param t - Test context
   * @param extra - Field overrides
   */
  async function deposit(
    t: Ctx,
    extra: Partial<Doc<"registrationDeposits">> = {}
  ): Promise<void> {
    await t.run(async (ctx) => {
      await ctx.db.insert("registrationDeposits", {
        userId: ALICE,
        reference: "AB-DEP01",
        status: "received",
        amount: 5000,
        receivedAmount: 5000,
        createdAt: 1,
        updatedAt: 1,
        ...extra,
      });
    });
  }

  /**
   * Inserts a payment for Alice.
   *
   * @param t - Test context
   * @param lotId - The lot
   * @param status - The payment status
   */
  async function payment(
    t: Ctx,
    lotId: Id<"lots">,
    status: Doc<"lotPayments">["status"]
  ): Promise<void> {
    await t.run(async (ctx) => {
      await ctx.db.insert("lotPayments", {
        lotId,
        buyerId: ALICE,
        sellerId: SELLER,
        reference: `AB-PAY${status.slice(0, 2).toUpperCase()}`,
        bid: 1000,
        premium: 50,
        vat: 158,
        total: 1208,
        depositCredit: 0,
        amountDue: 1208,
        vatKind: "vat",
        status,
        payBy: Date.now() + HOUR,
        createdAt: 1,
        updatedAt: 1,
      });
    });
  }

  const row = (t: Ctx) =>
    t.run((ctx) => ctx.db.query("registrationDeposits").first());

  it("moves a received deposit to refund_requested and tells the admins", async () => {
    const t = makeContext();
    await seedWorld(t);
    await deposit(t);

    await asAlice(t).mutation(api.registration.requestDepositRefund, {});

    expect(await row(t)).toMatchObject({
      status: "refund_requested",
      refundRequestedAt: Date.now(),
    });
    const adminNotes = await notificationsFor(t, ADMIN);
    expect(adminNotes).toHaveLength(1);
    expect(adminNotes[0]).toMatchObject({
      title: "Deposit refund requested",
      link: "/admin/deposits",
    });
    const registration = await asAlice(t).query(
      api.registration.getMyRegistration,
      {}
    );
    expect(registration?.deposit).toMatchObject({
      status: "refund_requested",
      refundableAmount: 5000,
    });
  });

  it("is harmless to ask twice", async () => {
    const t = makeContext();
    await seedWorld(t);
    await deposit(t);
    await asAlice(t).mutation(api.registration.requestDepositRefund, {});
    await asAlice(t).mutation(api.registration.requestDepositRefund, {});
    expect(await notificationsFor(t, ADMIN)).toHaveLength(1);
  });

  it.each(["awaiting", "paid_claimed", "refunded"] as const)(
    "refuses a %s deposit",
    async (status) => {
      const t = makeContext();
      await seedWorld(t);
      await deposit(t, { status });
      await expect(
        asAlice(t).mutation(api.registration.requestDepositRefund, {})
      ).rejects.toThrow("There's nothing left to refund.");
    }
  );

  it("refuses when there is no deposit", async () => {
    const t = makeContext();
    await seedWorld(t);
    await expect(
      asAlice(t).mutation(api.registration.requestDepositRefund, {})
    ).rejects.toThrow("There's nothing left to refund.");
  });

  it("refuses when a won lot's payment used the whole deposit", async () => {
    const t = makeContext();
    await seedWorld(t);
    await deposit(t, { creditedAmount: 5000, creditedAt: 2 });
    await expect(
      asAlice(t).mutation(api.registration.requestDepositRefund, {})
    ).rejects.toThrow("There's nothing left to refund.");
  });

  it("allows a partly credited deposit and reports what is left", async () => {
    const t = makeContext();
    await seedWorld(t);
    await deposit(t, { creditedAmount: 1208, creditedAt: 2 });
    await asAlice(t).mutation(api.registration.requestDepositRefund, {});
    const registration = await asAlice(t).query(
      api.registration.getMyRegistration,
      {}
    );
    expect(registration?.deposit?.refundableAmount).toBe(5000 - 1208);
  });

  it.each(["awaiting", "paid_claimed"] as const)(
    "refuses while a won lot is %s",
    async (status) => {
      const t = makeContext();
      const auctionId = await seedWorld(t);
      const lotId = await insertLot(t, auctionId, { status: "sold" });
      await deposit(t);
      await payment(t, lotId, status);
      await expect(
        asAlice(t).mutation(api.registration.requestDepositRefund, {})
      ).rejects.toThrow("Pay for your won lots first.");
      expect((await row(t))?.status).toBe("received");
    }
  );

  it("allows it once every won lot is confirmed", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, { status: "sold" });
    await deposit(t);
    await payment(t, lotId, "confirmed");
    await asAlice(t).mutation(api.registration.requestDepositRefund, {});
    expect((await row(t))?.status).toBe("refund_requested");
  });

  it("refuses while leading a lot that is still open", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, {
      winnerId: ALICE,
      currentPrice: 1500,
    });
    await insertBid(t, lotId, ALICE, 1500);
    await deposit(t);
    await expect(
      asAlice(t).mutation(api.registration.requestDepositRefund, {})
    ).rejects.toThrow(
      "You're the highest bidder on a lot. You can ask once it closes."
    );
  });

  it("allows it when outbid, when a voided bid led, or once the lot closed", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const outbid = await insertLot(t, auctionId, { winnerId: BOB });
    await insertBid(t, outbid, ALICE, 1100);
    const voided = await insertLot(t, auctionId, { winnerId: ALICE });
    await insertBid(t, voided, ALICE, 1100, { status: "voided" });
    const closed = await insertLot(t, auctionId, {
      winnerId: ALICE,
      status: "under_consideration",
    });
    await insertBid(t, closed, ALICE, 1100);
    await deposit(t);

    await asAlice(t).mutation(api.registration.requestDepositRefund, {});

    expect((await row(t))?.status).toBe("refund_requested");
  });

  it("checks each lot once however many bids the buyer placed on it", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, { winnerId: BOB });
    await insertBid(t, lotId, ALICE, 1100);
    await insertBid(t, lotId, ALICE, 1200);
    await deposit(t);
    await asAlice(t).mutation(api.registration.requestDepositRefund, {});
    expect((await row(t))?.status).toBe("refund_requested");
  });

  it("cancelling returns the deposit to received", async () => {
    const t = makeContext();
    await seedWorld(t);
    await deposit(t);
    await asAlice(t).mutation(api.registration.requestDepositRefund, {});

    await asAlice(t).mutation(api.registration.cancelDepositRefundRequest, {});

    const after = await row(t);
    expect(after?.status).toBe("received");
    expect(after?.refundRequestedAt).toBeUndefined();
  });

  it("cancelling does nothing outside refund_requested", async () => {
    const t = makeContext();
    await seedWorld(t);
    await deposit(t);
    await asAlice(t).mutation(api.registration.cancelDepositRefundRequest, {});
    expect((await row(t))?.status).toBe("received");
  });

  it("cancelling credits a lot that was won while the refund was requested", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, {
      status: "under_consideration",
      winnerId: ALICE,
    });
    await deposit(t);
    await asAlice(t).mutation(api.registration.requestDepositRefund, {});
    // The seller accepts the top bid while the refund is only requested.
    await t.run(async (ctx) => {
      const lot = await ctx.db.get("lots", lotId);
      if (!lot) throw new Error("missing");
      await createLotPayment(ctx, lot, ALICE, 1100, Date.now());
    });
    const before = await t.run((ctx) => ctx.db.query("lotPayments").first());
    expect(before?.depositCredit).toBe(0);

    await asAlice(t).mutation(api.registration.cancelDepositRefundRequest, {});

    const after = await t.run((ctx) => ctx.db.query("lotPayments").first());
    expect(after?.depositCredit).toBe(after?.total);
    expect(after?.amountDue).toBe(0);
    expect((await row(t))?.creditedLotId).toBe(lotId);
  });

  it("an admin cannot refund a requested deposit once the buyer owes a payment", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, { status: "sold" });
    await deposit(t);
    await asAlice(t).mutation(api.registration.requestDepositRefund, {});
    await payment(t, lotId, "awaiting");

    await expect(
      as(t, ADMIN).mutation(api.admin.registration.markDepositRefunded, {
        userId: ALICE,
      })
    ).rejects.toThrow("won lots that aren't paid yet");
    expect((await row(t))?.status).toBe("refund_requested");
  });

  it("an admin cannot mark a requested deposit received again", async () => {
    const t = makeContext();
    await seedWorld(t);
    await deposit(t, { status: "refund_requested" });
    await expect(
      as(t, ADMIN).mutation(api.admin.registration.markDepositReceived, {
        userId: ALICE,
        receivedAmount: 5000,
      })
    ).rejects.toThrow("the buyer has asked for it back");
  });

  it("an admin can mark a requested refund as refunded", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, { status: "sold" });
    await deposit(t, {
      creditedLotId: lotId,
      creditedAmount: 1000,
      creditedAt: 2,
    });
    await asAlice(t).mutation(api.registration.requestDepositRefund, {});

    await as(t, ADMIN).mutation(api.admin.registration.markDepositRefunded, {
      userId: ALICE,
    });

    expect(await row(t)).toMatchObject({
      status: "refunded",
      refundedAmount: 4000,
    });
  });

  it("a deposit in refund_requested no longer lets the buyer bid", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await t.run(async (ctx) => {
      const setting = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "deposit_enabled"))
        .unique();
      if (setting) await ctx.db.patch("settings", setting._id, { value: true });
    });
    await deposit(t);

    await bid(t, ALICE, lotId, 1000);
    await asAlice(t).mutation(api.registration.cancelDepositRefundRequest, {});
    // Leading now, so the refund is refused; set the status directly instead.
    await t.run(async (ctx) => {
      const d = await ctx.db.query("registrationDeposits").first();
      if (d)
        await ctx.db.patch("registrationDeposits", d._id, {
          status: "refund_requested",
        });
    });
    pastCooldown();
    await expect(bid(t, ALICE, lotId, 1200)).rejects.toThrow(
      "Your deposit hasn't been received yet."
    );
  });

  it("a credited but still received deposit keeps the buyer bidding", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await t.run(async (ctx) => {
      const setting = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "deposit_enabled"))
        .unique();
      if (setting) await ctx.db.patch("settings", setting._id, { value: true });
    });
    await deposit(t, { creditedAmount: 5000, creditedAt: 2 });
    const result = await bid(t, ALICE, lotId, 1000);
    expect(result.success).toBe(true);
  });
});

describe("getMyBidsOverview", () => {
  const overview = (t: Ctx, user = ALICE) =>
    as(t, user).query(api.auctions.getMyBidsOverview, {});

  it("is empty for a signed-out caller", async () => {
    const t = makeContext();
    expect(await t.query(api.auctions.getMyBidsOverview, {})).toEqual({
      bidding: [],
      lost: [],
      counts: { bidding: 0, won: 0, lost: 0, watching: 0 },
    });
  });

  it("puts live lots first by effective end time, then lots under consideration", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const later = await insertLot(t, auctionId, { title: "Later" });
    const sooner = await insertLot(t, auctionId, {
      title: "Sooner (extended less)",
      extendedEndTime: Date.now() + 2 * 60_000,
    });
    const considering = await insertLot(t, auctionId, {
      title: "Considering",
      status: "under_consideration",
      winnerId: ALICE,
      considerationDeadline: Date.now() + 40 * HOUR,
    });
    for (const lotId of [later, sooner, considering]) {
      await insertBid(t, lotId, ALICE, 1100);
    }

    const result = await overview(t);

    expect(result.bidding.map((r) => r.title)).toEqual([
      "Sooner (extended less)",
      "Later",
      "Considering",
    ]);
    expect(result.counts.bidding).toBe(3);
    const row = result.bidding[2];
    expect(row.isLeadingConsideration).toBe(true);
    expect(row.isWinning).toBe(false);
  });

  it("flags a leading live lot as winning and an outbid one as not", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const leading = await insertLot(t, auctionId, {
      title: "Leading",
      winnerId: ALICE,
      currentPrice: 1500,
    });
    await insertBid(t, leading, ALICE, 1500);
    const outbid = await insertLot(t, auctionId, {
      title: "Outbid",
      winnerId: BOB,
      currentPrice: 1700,
    });
    await insertBid(t, outbid, ALICE, 1600);
    await insertBid(t, outbid, BOB, 1700);

    const rows = (await overview(t)).bidding;

    const byTitle = new Map(rows.map((r) => [r.title, r]));
    expect(byTitle.get("Leading")).toMatchObject({
      isWinning: true,
      myHighestBid: 1500,
      isLeadingConsideration: false,
    });
    expect(byTitle.get("Outbid")).toMatchObject({
      isWinning: false,
      myHighestBid: 1600,
    });
  });

  it("returns the next minimum bid, premium, fixed fees and VAT kind per row", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const vat = await insertLot(t, auctionId, {
      title: "VAT",
      currentPrice: 1500,
      minIncrement: 250,
    });
    const priv = await insertLot(t, auctionId, {
      title: "Private",
      sellerId: PRIVATE_SELLER,
      currentPrice: 1500,
      minIncrement: 0,
      resolvedBuyerPremiumPct: 0.1,
    });
    await insertBid(t, vat, ALICE, 1500);
    await insertBid(t, priv, ALICE, 1500);
    await t.run((ctx) =>
      ctx.db.insert("platformFees", {
        name: "Handling",
        feeType: "fixed",
        value: 50,
        appliesTo: "buyer",
        isActive: true,
        visibleToBuyer: true,
        visibleToSeller: false,
        sortOrder: 2,
        createdAt: 1,
        updatedAt: 1,
      })
    );

    const byTitle = new Map(
      (await overview(t)).bidding.map((r) => [r.title, r])
    );

    expect(byTitle.get("VAT")).toMatchObject({
      nextMinBid: 1750,
      sellerVatKind: "vat",
      buyerPremiumFraction: 0.05,
      buyerFixedFees: 50,
    });
    expect(byTitle.get("Private")).toMatchObject({
      nextMinBid: 1500 + SMALL_INCREMENT_AMOUNT,
      sellerVatKind: "private",
      buyerPremiumFraction: 0.1,
    });
  });

  it("falls back to the platform default premium when no fee row or snapshot applies", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await insertBid(t, lotId, ALICE, 1000);
    await t.run(async (ctx) => {
      const fee = await ctx.db.query("platformFees").first();
      if (fee) await ctx.db.patch("platformFees", fee._id, { isActive: false });
    });
    const [row] = (await overview(t)).bidding;
    expect(row.buyerPremiumFraction).toBeGreaterThan(0);
    expect(row.buyerFixedFees).toBe(0);
  });

  it("lists lost lots: sold to someone else, unsold and declined, newest first", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const soldElsewhere = await insertLot(t, auctionId, {
      title: "Sold elsewhere",
      status: "sold",
      winnerId: BOB,
    });
    const unsold = await insertLot(t, auctionId, {
      title: "Unsold",
      status: "unsold",
    });
    const declined = await insertLot(t, auctionId, {
      title: "Declined",
      status: "unsold",
      winnerId: ALICE,
    });
    const base = Date.now();
    await insertBid(t, soldElsewhere, ALICE, 1100, { timestamp: base - 3000 });
    await insertBid(t, unsold, ALICE, 1100, { timestamp: base - 2000 });
    await insertBid(t, declined, ALICE, 1100, { timestamp: base - 1000 });

    const result = await overview(t);

    expect(result.lost.map((r) => r.title)).toEqual([
      "Declined",
      "Unsold",
      "Sold elsewhere",
    ]);
    expect(result.counts.lost).toBe(3);
    expect(result.bidding).toEqual([]);
  });

  it("leaves won and cancelled lots out of both lists", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const won = await insertLot(t, auctionId, {
      status: "sold",
      winnerId: ALICE,
    });
    const cancelled = await insertLot(t, auctionId, { status: "rejected" });
    await insertBid(t, won, ALICE, 1100);
    await insertBid(t, cancelled, ALICE, 1100);

    const result = await overview(t);

    expect(result.bidding).toEqual([]);
    expect(result.lost).toEqual([]);
  });

  it("dedupes a lot bid on many times and ignores voided bids", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, { currentPrice: 1300 });
    await insertBid(t, lotId, ALICE, 1100);
    await insertBid(t, lotId, ALICE, 1200);
    await insertBid(t, lotId, ALICE, 5000, { status: "voided" });
    const onlyVoided = await insertLot(t, auctionId);
    await insertBid(t, onlyVoided, ALICE, 1100, { status: "voided" });

    const result = await overview(t);

    expect(result.bidding).toHaveLength(1);
    expect(result.bidding[0].myHighestBid).toBe(1200);
  });

  it("caps the lost list at 50 rows and the lots considered at 200", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    await t.run(async (ctx) => {
      const categoryId = await ctx.db.insert("equipmentCategories", {
        name: "Bulk",
        isActive: true,
      });
      const base = Date.now();
      for (let i = 0; i < 205; i++) {
        const lotId = await ctx.db.insert("lots", {
          title: `Lot ${String(i)}`,
          make: "JD",
          model: "x",
          year: 2020,
          operatingHours: 1,
          location: "Free State",
          categoryId,
          reservePrice: 1,
          startingPrice: 1000,
          currentPrice: 1000,
          minIncrement: 100,
          sellerId: SELLER,
          status: "unsold",
          auctionId,
          images: { additional: [] },
          createdAt: base,
        });
        await ctx.db.insert("bids", {
          lotId,
          bidderId: ALICE,
          amount: 1000,
          timestamp: base + i,
          status: "valid",
        });
      }
    });

    const result = await overview(t);

    expect(result.lost).toHaveLength(50);
    expect(result.counts.lost).toBe(200);
    // Newest bid first.
    expect(result.lost[0].title).toBe("Lot 204");
  });

  it("counts won (payments plus legacy sold lots) and watching", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const paid = await insertLot(t, auctionId, {
      status: "sold",
      winnerId: ALICE,
    });
    const legacy = await insertLot(t, auctionId, {
      status: "sold",
      winnerId: ALICE,
    });
    await insertBid(t, paid, ALICE, 1100);
    await insertBid(t, legacy, ALICE, 1100);
    await t.run(async (ctx) => {
      const lot = await ctx.db.get("lots", paid);
      if (!lot) throw new Error("missing");
      await createLotPayment(ctx, lot, ALICE, 1100, Date.now());
      // A payment for a lot Alice no longer has a bid on (older than the cap).
      await ctx.db.insert("lotPayments", {
        lotId: legacy,
        buyerId: "someone_else",
        sellerId: SELLER,
        reference: "AB-OTHER",
        bid: 1,
        premium: 0,
        vat: 0,
        total: 1,
        depositCredit: 0,
        amountDue: 1,
        vatKind: "vat",
        status: "awaiting",
        payBy: 1,
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const watched = await insertLot(t, auctionId);
    await as(t, ALICE).mutation(api.watchlist.toggleWatchlist, {
      lotId: watched,
    });

    const { counts } = await overview(t);

    // One payment row, plus the sold lot that has none for Alice... but the
    // second lot already has someone's payment row, so it is not "legacy".
    expect(counts.won).toBe(1);
    expect(counts.watching).toBe(1);
  });

  it("counts a sold lot without any payment row as won", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const legacy = await insertLot(t, auctionId, {
      status: "sold",
      winnerId: ALICE,
    });
    await insertBid(t, legacy, ALICE, 1100);
    expect((await overview(t)).counts.won).toBe(1);
  });
});

describe("nextMinBid", () => {
  const lot = { currentPrice: 2000, startingPrice: 1000, minIncrement: 100 };
  it("is the current price for the first bid", () => {
    expect(nextMinBid(lot, false)).toBe(2000);
  });
  it("adds the increment once there are bids", () => {
    expect(nextMinBid(lot, true)).toBe(2100);
  });
  it("falls back to the default increment when the lot has none", () => {
    expect(nextMinBid({ ...lot, minIncrement: 0 }, true)).toBe(
      2000 + SMALL_INCREMENT_AMOUNT
    );
  });
});

describe("notification preferences", () => {
  it("saves and returns the three switches, unset by default", async () => {
    const t = makeContext();
    await seedWorld(t);
    expect(
      await as(t, ALICE).query(api.userPreferences.getMyPreferences, {})
    ).toBeNull();

    await as(t, ALICE).mutation(api.userPreferences.updateMyPreferences, {
      notificationsWatchedLots: false,
      notificationsLotsWon: true,
    });

    const prefs = await as(t, ALICE).query(
      api.userPreferences.getMyPreferences,
      {}
    );
    expect(prefs).toMatchObject({
      notificationsWatchedLots: false,
      notificationsLotsWon: true,
    });
    expect(prefs?.notificationsSalesOpening).toBeUndefined();
  });
});

describe("Watched lots switch", () => {
  /**
   * Alice leads a watched lot, then Bob outbids her.
   *
   * @param prefs - Alice's preferences, if any
   * @returns The test context
   */
  async function outbidAlice(
    prefs?: Partial<Doc<"userPreferences">>
  ): Promise<Ctx> {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    await t.run((ctx) =>
      ctx.db.insert("settings", {
        key: "watch_alerts_enabled",
        value: true,
        updatedAt: Date.now(),
      })
    );
    if (prefs) await setPrefs(t, ALICE, prefs);
    const lotId = await insertLot(t, auctionId);
    await bid(t, ALICE, lotId, 1000);
    pastCooldown();
    await bid(t, BOB, lotId, 1100);
    return t;
  }

  const outbidNotes = async (t: Ctx) =>
    (await notificationsFor(t, ALICE)).filter(
      (n) => n.title === "You've been outbid"
    );

  it("alerts when the switch is unset", async () => {
    const t = await outbidAlice();
    expect(await outbidNotes(t)).toHaveLength(1);
    expect(await pushBatches(t)).toHaveLength(1);
  });

  it("alerts when the switch is on", async () => {
    const t = await outbidAlice({ notificationsWatchedLots: true });
    expect(await outbidNotes(t)).toHaveLength(1);
    expect(await pushBatches(t)).toHaveLength(1);
  });

  it("sends nothing when switched off", async () => {
    const t = await outbidAlice({ notificationsWatchedLots: false });
    expect(await outbidNotes(t)).toHaveLength(0);
    expect(await pushBatches(t)).toHaveLength(0);
  });

  it("still honours the legacy outbid opt-out when the new switch is on", async () => {
    const t = await outbidAlice({
      notificationsWatchedLots: true,
      notificationsBidOutbid: false,
    });
    expect(await outbidNotes(t)).toHaveLength(0);
  });

  describe("closing in 1 hour", () => {
    /**
     * A watched lot closing in 30 minutes; returns Alice's closing notices.
     *
     * @param prefs - Alice's preferences, if any
     * @returns The notifications about the closing lot
     */
    async function closingNotes(prefs?: Partial<Doc<"userPreferences">>) {
      const t = makeContext();
      const auctionId = await seedWorld(t);
      await t.run(async (ctx) => {
        await ctx.db.insert("settings", {
          key: "watch_alerts_enabled",
          value: true,
          updatedAt: Date.now(),
        });
        await ctx.db.patch("auctions", auctionId, {
          endTime: Date.now() + 30 * 60_000,
        });
      });
      const lotId = await insertLot(t, auctionId);
      await t.run((ctx) =>
        ctx.db.insert("watchlist", { userId: ALICE, lotId })
      );
      if (prefs) await setPrefs(t, ALICE, prefs);
      await t.run((ctx) => sendClosingSoonAlertsHandler(ctx, Date.now()));
      return (await notificationsFor(t, ALICE)).filter(
        (n) => n.title === "Closing in 1 hour"
      );
    }

    it("alerts when unset", async () => {
      expect(await closingNotes()).toHaveLength(1);
    });
    it("alerts when on", async () => {
      expect(
        await closingNotes({ notificationsWatchedLots: true })
      ).toHaveLength(1);
    });
    it("is silent when off", async () => {
      expect(
        await closingNotes({ notificationsWatchedLots: false })
      ).toHaveLength(0);
    });
    it("keeps the legacy watchlist-ending opt-out", async () => {
      expect(
        await closingNotes({
          notificationsWatchedLots: true,
          notificationsWatchlistEnding: "disabled",
        })
      ).toHaveLength(0);
    });
  });
});

describe("Sales opening switch", () => {
  /**
   * A sale that just opened with Alice's reminder pending.
   *
   * @param prefs - Alice's preferences, if any
   * @returns The state after the run
   */
  async function run(prefs?: Partial<Doc<"userPreferences">>) {
    const t = makeContext();
    await seedWorld(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("settings", {
        key: "push_reminders_enabled",
        value: true,
        updatedAt: Date.now(),
      });
      const saleId = await ctx.db.insert("auctions", {
        title: "Year End Sale",
        status: "published",
        startTime: Date.now() - 1000,
        endTime: Date.now() + 48 * HOUR,
        createdBy: ADMIN,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("saleReminders", {
        userId: ALICE,
        auctionId: saleId,
        status: "pending",
        startTime: Date.now() - 1000,
        createdAt: 1,
      });
    });
    if (prefs) await setPrefs(t, ALICE, prefs);
    await t.run((ctx) => sendDueSaleRemindersHandler(ctx, Date.now()));
    return {
      reminder: await t.run((ctx) => ctx.db.query("saleReminders").first()),
      notes: (await notificationsFor(t, ALICE)).filter((n) =>
        n.title.endsWith("is open")
      ),
      batches: await pushBatches(t),
    };
  }

  it("pushes when unset", async () => {
    const result = await run();
    expect(result.reminder?.status).toBe("sent");
    expect(result.notes).toHaveLength(1);
    expect(result.batches).toHaveLength(1);
  });

  it("pushes when on", async () => {
    expect(
      (await run({ notificationsSalesOpening: true })).batches
    ).toHaveLength(1);
  });

  it("marks sent and notifies in-app, but queues no push, when off", async () => {
    const result = await run({ notificationsSalesOpening: false });
    expect(result.reminder?.status).toBe("sent");
    expect(result.notes).toHaveLength(1);
    expect(result.batches).toHaveLength(0);
  });
});

describe("Lots you win switch", () => {
  /**
   * Creates Alice's payment for a sold lot, then an admin confirms it.
   *
   * @param prefs - Alice's preferences, if any
   * @returns Pushes queued after the win and after the confirmation
   */
  async function winAndConfirm(prefs?: Partial<Doc<"userPreferences">>) {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, {
      status: "sold",
      winnerId: ALICE,
    });
    if (prefs) await setPrefs(t, ALICE, prefs);
    await t.run(async (ctx) => {
      const lot = await ctx.db.get("lots", lotId);
      if (!lot) throw new Error("missing");
      await createLotPayment(ctx, lot, ALICE, 1100, Date.now());
    });
    const afterWin = (await pushBatches(t)).length;
    const payment = await t.run((ctx) => ctx.db.query("lotPayments").first());
    if (!payment) throw new Error("no payment");
    await as(t, ADMIN).mutation(api.admin.lotPayments.confirmLotPayment, {
      paymentId: payment._id,
    });
    const afterConfirm = (await pushBatches(t)).length;
    return {
      afterWin,
      afterConfirm,
      notes: (await notificationsFor(t, ALICE)).map((n) => n.title),
    };
  }

  it("pushes the win and the confirmation when unset", async () => {
    const result = await winAndConfirm();
    expect(result.afterWin).toBe(1);
    expect(result.afterConfirm).toBe(2);
    expect(result.notes).toEqual(["You won this lot", "Payment received"]);
  });

  it("pushes when on", async () => {
    const result = await winAndConfirm({ notificationsLotsWon: true });
    expect(result.afterConfirm).toBe(2);
  });

  it("still writes the in-app notices but no push when off", async () => {
    const result = await winAndConfirm({ notificationsLotsWon: false });
    expect(result.afterConfirm).toBe(0);
    expect(result.notes).toEqual(["You won this lot", "Payment received"]);
  });

  it("queues nothing for a buyer without a push subscription", async () => {
    const t = makeContext();
    await seedWorld(t);
    const queued = await t.run((ctx) =>
      pushToUser(ctx, "nobody", { title: "x", body: "y", url: "/", tag: "t" })
    );
    expect(queued).toBe(0);
    expect(await pushBatches(t)).toHaveLength(0);
  });
});

describe("pay-by reminder", () => {
  /**
   * Inserts an awaiting payment for Alice.
   *
   * @param ctx - Database context
   * @param lotId - The lot
   * @param extra - Field overrides
   */
  async function addPayment(
    ctx: DbCtx,
    lotId: Id<"lots">,
    extra: Partial<Doc<"lotPayments">> = {}
  ): Promise<void> {
    await ctx.db.insert("lotPayments", {
      lotId,
      buyerId: ALICE,
      sellerId: SELLER,
      reference: `AB-${String(Math.random()).slice(2, 7)}`,
      bid: 1000,
      premium: 50,
      vat: 158,
      total: 1208,
      depositCredit: 0,
      amountDue: 1208,
      vatKind: "vat",
      status: "awaiting",
      payBy: Date.now() + 12 * HOUR,
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    });
  }

  const run = (t: Ctx) =>
    t.run((ctx) => sendPayByRemindersHandler(ctx, Date.now()));

  it("reminds once, in-app and by push, and stamps reminderSentAt", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await t.run((ctx) => addPayment(ctx, lotId));

    expect(await run(t)).toEqual({ sent: 1, hasMore: false });

    const [note] = await notificationsFor(t, ALICE);
    expect(note.title).toBe("Payment due tomorrow");
    expect(note.message).toMatch(
      /^Pay R 1 208 for Lot 7 by \w{3} \d+ \w{3}, \d\d:\d\d\.$/
    );
    const payment = await t.run((ctx) => ctx.db.query("lotPayments").first());
    expect(payment?.reminderSentAt).toBe(Date.now());
    expect(await pushBatches(t)).toHaveLength(1);

    // A second run finds nothing to do.
    expect(await run(t)).toEqual({ sent: 0, hasMore: false });
    expect(await notificationsFor(t, ALICE)).toHaveLength(1);
    expect(await pushBatches(t)).toHaveLength(1);
  });

  it("skips payments due later, overdue, claimed, confirmed or already reminded", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await t.run(async (ctx) => {
      await addPayment(ctx, lotId, { payBy: Date.now() + 30 * HOUR });
      await addPayment(ctx, lotId, { payBy: Date.now() - HOUR });
      await addPayment(ctx, lotId, { status: "paid_claimed" });
      await addPayment(ctx, lotId, { status: "confirmed" });
      await addPayment(ctx, lotId, { reminderSentAt: 5 });
    });
    expect(await run(t)).toEqual({ sent: 0, hasMore: false });
    expect(await notificationsFor(t, ALICE)).toHaveLength(0);
  });

  it("stamps but does not remind a payment the deposit already covers", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await t.run((ctx) =>
      addPayment(ctx, lotId, { depositCredit: 1208, amountDue: 0 })
    );
    expect(await run(t)).toEqual({ sent: 1, hasMore: false });
    expect(await notificationsFor(t, ALICE)).toHaveLength(0);
    expect(await pushBatches(t)).toHaveLength(0);
    const payment = await t.run((ctx) => ctx.db.query("lotPayments").first());
    expect(payment?.reminderSentAt).toBe(Date.now());
  });

  it("reminds an undated lot as 'your lot'", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId, { lotNumber: undefined });
    await t.run((ctx) => addPayment(ctx, lotId));
    await run(t);
    expect((await notificationsFor(t, ALICE))[0].message).toContain("your lot");
  });

  it("still writes the in-app reminder but no push when Lots you win is off", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await setPrefs(t, ALICE, { notificationsLotsWon: false });
    await t.run((ctx) => addPayment(ctx, lotId));
    await run(t);
    expect(await notificationsFor(t, ALICE)).toHaveLength(1);
    expect(await pushBatches(t)).toHaveLength(0);
  });

  it("does a bounded batch and reschedules itself through the gated wrapper", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await t.run(async (ctx) => {
      for (let i = 0; i < PAY_BY_REMINDER_BATCH + 1; i++) {
        await addPayment(ctx, lotId);
      }
    });

    const first = await t.mutation(internal.cronJobs.sendPaymentReminders, {});

    expect(first).toEqual({ sent: PAY_BY_REMINDER_BATCH, hasMore: true });
    const rescheduled = (
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      )
    ).filter((s) => s.name.includes("sendPaymentReminders"));
    expect(rescheduled).toHaveLength(1);
    expect(
      await t.mutation(internal.cronJobs.sendPaymentReminders, {})
    ).toEqual({ sent: 1, hasMore: false });
  });

  it("does nothing while the job is switched off", async () => {
    const t = makeContext();
    const auctionId = await seedWorld(t);
    const lotId = await insertLot(t, auctionId);
    await t.run(async (ctx) => {
      await addPayment(ctx, lotId);
      await ctx.db.insert("settings", {
        key: "cron_enabled_send_payment_reminders",
        value: false,
        updatedAt: Date.now(),
      });
    });
    expect(
      await t.mutation(internal.cronJobs.sendPaymentReminders, {})
    ).toEqual({ sent: 0, hasMore: false });
    expect(await notificationsFor(t, ALICE)).toHaveLength(0);
  });
});
