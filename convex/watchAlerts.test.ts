/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  CLOSING_SOON_MAX_NOTIFICATIONS,
  CLOSING_SOON_WINDOW_MS,
} from "./constants";
import schema from "./schema";
import {
  formatRandPush,
  formatSastTime,
  sendClosingSoonAlertsHandler,
} from "./watchAlerts";

const modules = import.meta.glob("./**/*.*s");

const SELLER = "user_seller";
const ALICE = "user_alice";
const BOB = "user_bob";
const MINUTE = 60_000;
const NBSP = "\u00A0";

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

/**
 * Switches the watched-lot alerts platform setting.
 *
 * @param t - Test context
 * @param enabled - New value
 */
async function setAlerts(t: Ctx, enabled: boolean) {
  await t.run(async (ctx) => {
    await ctx.db.insert("settings", {
      key: "watch_alerts_enabled",
      value: enabled,
      description: "test",
      updatedAt: Date.now(),
    });
  });
}

/**
 * Seeds verified profiles, one push subscription per bidder and a published
 * sale that has one open lot.
 *
 * @param t - Test context
 * @param endsInMs - How long until the sale closes
 * @returns The sale and lot ids
 */
async function seed(t: Ctx, endsInMs = 30 * MINUTE) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    for (const userId of [SELLER, ALICE, BOB]) {
      await ctx.db.insert("profiles", {
        userId,
        name: userId,
        role: userId === SELLER ? "seller" : "buyer",
        isVerified: true,
        kycStatus: "verified",
        createdAt: now,
        updatedAt: now,
      });
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
    for (const userId of [ALICE, BOB]) {
      await ctx.db.insert("pushSubscriptions", {
        userId,
        endpoint: `https://fcm.googleapis.com/${userId}`,
        p256dh: "p256",
        auth: "auth",
        createdAt: now,
      });
    }
    const auctionId = await ctx.db.insert("auctions", {
      title: "Sale",
      startTime: now - 60 * MINUTE,
      endTime: now + endsInMs,
      status: "published",
      createdBy: "admin",
      createdAt: now,
      updatedAt: now,
    });
    const lotId = await insertLot(ctx, auctionId, "Case IH 7250");
    return { auctionId, lotId };
  });
}

type DbCtx = Parameters<Parameters<Ctx["run"]>[0]>[0];

/**
 * Inserts an open lot.
 *
 * @param ctx - Database context
 * @param auctionId - The sale
 * @param title - Lot title
 * @returns The lot id
 */
async function insertLot(
  ctx: DbCtx,
  auctionId: Id<"auctions">,
  title: string
): Promise<Id<"lots">> {
  return await ctx.db.insert("lots", {
    title,
    make: "Case IH",
    model: "7250",
    year: 2015,
    operatingHours: 100,
    location: "Bloemfontein",
    reservePrice: 1000,
    startingPrice: 1000,
    currentPrice: 1000,
    minIncrement: 100,
    sellerId: SELLER,
    status: "assigned",
    auctionId,
    images: [],
  });
}

/**
 * Adds a watcher.
 *
 * @param t - Test context
 * @param userId - The watcher
 * @param lotId - The lot
 */
async function watch(t: Ctx, userId: string, lotId: Id<"lots">) {
  await t.run(async (ctx) => {
    await ctx.db.insert("watchlist", { userId, lotId });
  });
}

/**
 * Reads the scheduled push batches.
 *
 * @param t - Test context
 * @returns Scheduled function names and their args
 */
async function scheduled(t: Ctx) {
  return await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect()
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("formatting helpers", () => {
  it("formats rand with no-break separators", () => {
    expect(formatRandPush(450000)).toBe(`R${NBSP}450${NBSP}000`);
    expect(formatRandPush(950)).toBe(`R${NBSP}950`);
    expect(formatRandPush(1234567.4)).toBe(`R${NBSP}1${NBSP}234${NBSP}567`);
  });

  it("formats SAST time", () => {
    expect(formatSastTime(Date.UTC(2026, 0, 1, 7, 5))).toBe("09:05");
    expect(formatSastTime(Date.UTC(2026, 0, 1, 23, 30))).toBe("01:30");
  });
});

describe("outbid push", () => {
  /**
   * Runs a bid as a user.
   *
   * @param t - Test context
   * @param userId - The bidder
   * @param lotId - The lot
   * @param amount - The amount
   * @param maxBid - Optional proxy maximum
   */
  async function bid(
    t: Ctx,
    userId: string,
    lotId: Id<"lots">,
    amount: number,
    maxBid?: number
  ) {
    vi.advanceTimersByTime(5_000);
    await t
      .withIdentity({ subject: userId })
      .mutation(api.auctions.placeBid, { lotId, amount, maxBid });
  }

  it("alerts a watcher who is outbid, in-app and by push", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await watch(t, ALICE, lotId);
    await bid(t, ALICE, lotId, 1000);
    await bid(t, BOB, lotId, 450000);

    const notes = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_recipient", (q) => q.eq("recipientId", ALICE))
        .collect()
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      title: "You've been outbid",
      message: `Case IH 7250: the bid is now R${NBSP}450${NBSP}000. Tap to bid again.`,
      link: `/auction/${lotId}`,
    });

    const batches = (await scheduled(t)).filter((s) =>
      s.name.includes("sendPushBatch")
    );
    expect(batches).toHaveLength(1);
    const [arg] = batches[0].args as [
      { messages: { endpoint: string; payload: string }[] },
    ];
    expect(arg.messages).toHaveLength(1);
    expect(arg.messages[0].endpoint).toBe(
      `https://fcm.googleapis.com/${ALICE}`
    );
    expect(JSON.parse(arg.messages[0].payload)).toEqual({
      title: "You've been outbid",
      body: `Case IH 7250: the bid is now R${NBSP}450${NBSP}000. Tap to bid again.`,
      url: `/auction/${lotId}`,
      tag: `outbid-${lotId}`,
    });
  });

  it("does not alert on the first bid", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await watch(t, ALICE, lotId);
    await bid(t, BOB, lotId, 1000);
    expect(await scheduled(t)).toHaveLength(0);
  });

  it("does not alert when the previous leader does not watch the lot", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await bid(t, ALICE, lotId, 1000);
    // Bidding watches the lot, so Alice has to stop watching it first.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("watchlist").collect();
      for (const row of rows) await ctx.db.delete("watchlist", row._id);
    });
    await bid(t, BOB, lotId, 1100);
    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect())
    ).toHaveLength(0);
    expect(await scheduled(t)).toHaveLength(0);
  });

  it("does not alert while the setting is off", async () => {
    const t = makeContext();
    const { lotId } = await seed(t);
    await watch(t, ALICE, lotId);
    await bid(t, ALICE, lotId, 1000);
    await bid(t, BOB, lotId, 1100);
    expect(await scheduled(t)).toHaveLength(0);
  });

  it("does not alert when a bidder outbids themself", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await watch(t, ALICE, lotId);
    await bid(t, ALICE, lotId, 1000);
    await bid(t, ALICE, lotId, 1100);
    expect(await scheduled(t)).toHaveLength(0);
  });

  it("alerts the previous leader when a third bidder's proxy takes the lead", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await watch(t, ALICE, lotId);
    await bid(t, ALICE, lotId, 1000);
    // Carol's standing proxy (max R5 000) answers Bob's bid and wins.
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("profiles", {
        userId: "user_carol",
        role: "buyer",
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("registrationDeposits", {
        userId: "user_carol",
        reference: "AB-CAROL",
        status: "received",
        amount: 5000,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("proxy_bids", {
        lotId,
        bidderId: "user_carol",
        maxBid: 5000,
        updatedAt: now,
      });
    });
    await bid(t, BOB, lotId, 1100);
    const lot = await t.run((ctx) => ctx.db.get("lots", lotId));
    expect(lot?.winnerId).toBe("user_carol");
    const notes = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notes).toHaveLength(1);
    expect(notes[0].recipientId).toBe(ALICE);
    expect(notes[0].message).toContain(`R${NBSP}1${NBSP}200`);
  });

  it("does not alert when a proxy bid keeps the previous leader on top", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await watch(t, ALICE, lotId);
    await bid(t, ALICE, lotId, 1000, 5000);
    await bid(t, BOB, lotId, 1100);
    expect(await scheduled(t)).toHaveLength(0);
  });

  it("respects a user who switched outbid alerts off", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await t.run((ctx) =>
      ctx.db.insert("userPreferences", {
        userId: ALICE,
        notificationsBidOutbid: false,
        updatedAt: Date.now(),
      })
    );
    await watch(t, ALICE, lotId);
    await bid(t, ALICE, lotId, 1000);
    await bid(t, BOB, lotId, 1100);
    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect())
    ).toHaveLength(0);
    expect(await scheduled(t)).toHaveLength(0);
  });

  it("still creates the in-app notice when the user has no push subscription", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("pushSubscriptions").collect()) {
        await ctx.db.delete("pushSubscriptions", row._id);
      }
    });
    await watch(t, ALICE, lotId);
    await bid(t, ALICE, lotId, 1000);
    await bid(t, BOB, lotId, 1100);
    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect())
    ).toHaveLength(1);
    expect(await scheduled(t)).toHaveLength(0);
  });
});

describe("closing-soon alerts", () => {
  const run = (t: Ctx) =>
    t.run((ctx) => sendClosingSoonAlertsHandler(ctx, Date.now()));

  it("notifies each watcher once per lot", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await watch(t, ALICE, lotId);
    await watch(t, BOB, lotId);

    expect(await run(t)).toEqual({ notified: 2, hasMore: false });
    const lot = await t.run((ctx) => ctx.db.get("lots", lotId));
    expect(lot?.closingSoonNotifiedAt).toBeTypeOf("number");
    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect())
    ).toHaveLength(2);

    const batches = (await scheduled(t)).filter((s) =>
      s.name.includes("sendPushBatch")
    );
    expect(batches).toHaveLength(1);
    const [arg] = batches[0].args as [{ messages: { payload: string }[] }];
    expect(arg.messages).toHaveLength(2);
    const payload = JSON.parse(arg.messages[0].payload) as {
      title: string;
      body: string;
      url: string;
      tag: string;
    };
    expect(payload).toMatchObject({
      title: "Closing in 1 hour",
      url: `/auction/${lotId}`,
      tag: `closing-${lotId}`,
    });
    expect(payload.body).toMatch(
      /^Case IH 7250 closes at \d\d:\d\d\. Tap to see the lot\.$/
    );

    // A second run finds the lot already notified.
    expect(await run(t)).toEqual({ notified: 0, hasMore: false });
    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect())
    ).toHaveLength(2);
  });

  it("only alerts watchers whose ending setting allows the 1-hour alert", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("userPreferences", {
        userId: ALICE,
        notificationsWatchlistEnding: "disabled",
        updatedAt: Date.now(),
      });
      await ctx.db.insert("userPreferences", {
        userId: BOB,
        notificationsWatchlistEnding: "1h",
        updatedAt: Date.now(),
      });
      await ctx.db.insert("userPreferences", {
        userId: "user_carol",
        notificationsWatchlistEnding: "24h",
        updatedAt: Date.now(),
      });
    });
    for (const userId of [ALICE, BOB, "user_carol"]) {
      await watch(t, userId, lotId);
    }
    expect(await run(t)).toEqual({ notified: 3, hasMore: false });
    const notes = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notes.map((n) => n.recipientId)).toEqual([BOB]);
  });

  it("uses the lot's extended end time in the message", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await watch(t, ALICE, lotId);
    const extended = Date.UTC(2030, 0, 1, 10, 7);
    await t.run((ctx) =>
      ctx.db.patch("lots", lotId, { extendedEndTime: extended })
    );
    await run(t);
    const notes = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notes[0].message).toContain("closes at 12:07");
  });

  it("skips sales outside the window, drafts and non-open lots", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId, auctionId } = await seed(
      t,
      CLOSING_SOON_WINDOW_MS + 5 * MINUTE
    );
    await watch(t, ALICE, lotId);
    expect(await run(t)).toEqual({ notified: 0, hasMore: false });

    // Inside the window, but the lot is no longer open.
    await t.run(async (ctx) => {
      await ctx.db.patch("auctions", auctionId, {
        endTime: Date.now() + 10 * MINUTE,
      });
      await ctx.db.patch("lots", lotId, { status: "sold" });
    });
    expect(await run(t)).toEqual({ notified: 0, hasMore: false });

    // Inside the window but a draft sale.
    await t.run(async (ctx) => {
      await ctx.db.patch("lots", lotId, { status: "assigned" });
      await ctx.db.patch("auctions", auctionId, { status: "draft" });
    });
    expect(await run(t)).toEqual({ notified: 0, hasMore: false });
    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect())
    ).toHaveLength(0);
  });

  it("does nothing while the setting is off", async () => {
    const t = makeContext();
    const { lotId } = await seed(t);
    await watch(t, ALICE, lotId);
    expect(await run(t)).toEqual({ notified: 0, hasMore: false });
    expect(
      (await t.run((ctx) => ctx.db.get("lots", lotId)))?.closingSoonNotifiedAt
    ).toBeUndefined();
  });

  it("marks a lot with no watchers as done without pushing", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    expect(await run(t)).toEqual({ notified: 0, hasMore: false });
    expect(
      (await t.run((ctx) => ctx.db.get("lots", lotId)))?.closingSoonNotifiedAt
    ).toBeTypeOf("number");
    expect(await scheduled(t)).toHaveLength(0);
  });

  it("stops at the bound and reports more through the gated wrapper", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId, auctionId } = await seed(t);
    const otherLot = await t.run((ctx) =>
      insertLot(ctx, auctionId, "John Deere 6130")
    );
    await t.run(async (ctx) => {
      for (const lot of [lotId, otherLot]) {
        for (let i = 0; i < CLOSING_SOON_MAX_NOTIFICATIONS - 50; i++) {
          await ctx.db.insert("watchlist", {
            userId: `w${String(i)}`,
            lotId: lot,
          });
        }
      }
    });

    const first = await t.mutation(internal.cronJobs.sendClosingSoonAlerts, {});
    expect(first).toEqual({
      notified: CLOSING_SOON_MAX_NOTIFICATIONS,
      hasMore: true,
    });
    const rescheduled = (await scheduled(t)).filter((s) =>
      s.name.includes("sendClosingSoonAlerts")
    );
    expect(rescheduled).toHaveLength(1);

    const second = await t.mutation(
      internal.cronJobs.sendClosingSoonAlerts,
      {}
    );
    expect(second).toEqual({
      notified: CLOSING_SOON_MAX_NOTIFICATIONS - 100,
      hasMore: false,
    });
    // Nobody was alerted twice, and both lots are done.
    const notes = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notes).toHaveLength((CLOSING_SOON_MAX_NOTIFICATIONS - 50) * 2);
    const lots = await t.run((ctx) => ctx.db.query("lots").collect());
    expect(
      lots.every(
        (l) =>
          l.closingSoonNotifiedAt !== undefined &&
          l.closingSoonCursor === undefined
      )
    ).toBe(true);
  });

  it("alerts a lot with more watchers than one run allows across runs, nobody twice", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    const total = 250;
    await t.run(async (ctx) => {
      for (let i = 0; i < total; i++) {
        await ctx.db.insert("watchlist", {
          userId: `w${String(i)}`,
          lotId,
        });
      }
    });
    expect(await run(t)).toEqual({
      notified: CLOSING_SOON_MAX_NOTIFICATIONS,
      hasMore: true,
    });
    const partial = await t.run((ctx) => ctx.db.get("lots", lotId));
    expect(partial?.closingSoonNotifiedAt).toBeUndefined();
    expect(partial?.closingSoonCursor).toBeTypeOf("number");

    expect(await run(t)).toEqual({
      notified: total - CLOSING_SOON_MAX_NOTIFICATIONS,
      hasMore: false,
    });
    const done = await t.run((ctx) => ctx.db.get("lots", lotId));
    expect(done?.closingSoonNotifiedAt).toBeTypeOf("number");
    expect(done?.closingSoonCursor).toBeUndefined();

    const recipients = (
      await t.run((ctx) => ctx.db.query("notifications").collect())
    ).map((n) => n.recipientId);
    expect(recipients).toHaveLength(total);
    expect(new Set(recipients).size).toBe(total);
    expect(await run(t)).toEqual({ notified: 0, hasMore: false });
  });

  it("alerts again after the lot is reassigned or its sale is pushed back", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId, auctionId } = await seed(t);
    await t.run((ctx) =>
      ctx.db.insert("profiles", {
        userId: "user_admin",
        name: "admin",
        role: "admin",
        isVerified: true,
        kycStatus: "verified",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );
    const asAdmin = t.withIdentity({ subject: "user_admin" });
    await watch(t, ALICE, lotId);
    const notifications = () =>
      t.run((ctx) => ctx.db.query("notifications").collect());

    expect(await run(t)).toEqual({ notified: 1, hasMore: false });
    expect(await notifications()).toHaveLength(1);

    // The sale is pushed back past the window: the flag is cleared...
    await asAdmin.mutation(api.auctions.mutations.adminCrud.updateAuction, {
      auctionId,
      endTime: Date.now() + 3 * 60 * MINUTE,
    });
    expect(
      (await t.run((ctx) => ctx.db.get("lots", lotId)))?.closingSoonNotifiedAt
    ).toBeUndefined();
    expect(await run(t)).toEqual({ notified: 0, hasMore: false });

    // ...and the alert goes out again once it is within the hour.
    vi.advanceTimersByTime(2.5 * 60 * MINUTE);
    expect(await run(t)).toEqual({ notified: 1, hasMore: false });
    expect(await notifications()).toHaveLength(2);

    // Unassign and assign to another sale: the flag is cleared again.
    await asAdmin.mutation(api.auctions.mutations.assignment.unassignLot, {
      lotId,
    });
    expect(
      (await t.run((ctx) => ctx.db.get("lots", lotId)))?.closingSoonNotifiedAt
    ).toBeUndefined();
    await t.run((ctx) => ctx.db.patch("lots", lotId, { status: "approved" }));
    const other = await t.run((ctx) =>
      ctx.db.insert("auctions", {
        title: "Other",
        startTime: Date.now() - MINUTE,
        endTime: Date.now() + 20 * MINUTE,
        status: "published",
        createdBy: "admin",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );
    await t.run((ctx) =>
      ctx.db.patch("lots", lotId, { closingSoonNotifiedAt: 1 })
    );
    await asAdmin.mutation(
      api.auctions.mutations.assignment.assignLotToAuction,
      {
        lotId,
        auctionId: other,
      }
    );
    expect(
      (await t.run((ctx) => ctx.db.get("lots", lotId)))?.closingSoonNotifiedAt
    ).toBeUndefined();
    expect(await run(t)).toEqual({ notified: 1, hasMore: false });
    expect(await notifications()).toHaveLength(3);
  });

  it("the cron wrapper is a no-op while the job is off", async () => {
    const t = makeContext();
    await setAlerts(t, true);
    const { lotId } = await seed(t);
    await watch(t, ALICE, lotId);
    await t.run((ctx) =>
      ctx.db.insert("settings", {
        key: "cron_enabled_send_closing_soon_alerts",
        value: false,
        description: "test",
        updatedAt: Date.now(),
      })
    );
    expect(
      await t.mutation(internal.cronJobs.sendClosingSoonAlerts, {})
    ).toEqual({ notified: 0, hasMore: false });
  });
});
