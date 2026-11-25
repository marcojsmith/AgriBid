import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { isPushRemindersEnabled } from "./admin/platformSettings";
import { notifyUser } from "./auctions/internal";
import { getEnv } from "./config";
import { SALE_REMINDER_BATCH, SALE_REMINDER_STALE_MS } from "./constants";
import { getAuthenticatedUserId, getAuthUser, resolveUserId } from "./lib/auth";
import { isAllowedPushEndpoint, type PushMessage } from "./lib/pushDelivery";
import { pushSwitchAllows } from "./lib/pushToUser";

/** Longest push endpoint URL we store. */
const MAX_ENDPOINT_LENGTH = 2048;
/** Longest p256dh / auth key we store (real keys are 87 and 22 characters). */
const MAX_KEY_LENGTH = 128;
/** Subscriptions read per user, to bound a single run. */
const SUBSCRIPTIONS_PER_USER = 10;

/**
 * The public VAPID key the browser needs to subscribe, or null when push is
 * not configured on this deployment.
 */
export const getVapidPublicKey = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: () => {
    const key = getEnv("VAPID_PUBLIC_KEY");
    return key === undefined || key === "" ? null : key;
  },
});

/**
 * Stores (or refreshes) the caller's push subscription. An endpoint another
 * user held (shared device, new sign-in) is reassigned to the caller.
 */
export const saveSubscription = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (
      args.endpoint.length > MAX_ENDPOINT_LENGTH ||
      args.p256dh.length > MAX_KEY_LENGTH ||
      args.auth.length > MAX_KEY_LENGTH
    ) {
      throw new ConvexError("Invalid push endpoint");
    }
    if (!isAllowedPushEndpoint(args.endpoint)) {
      throw new ConvexError("Unsupported push service.");
    }
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing) {
      await ctx.db.patch("pushSubscriptions", existing._id, {
        userId,
        p256dh: args.p256dh,
        auth: args.auth,
      });
    } else {
      // Keep a user's devices bounded: drop the oldest beyond the cap.
      const mine = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const excess = mine.length - SUBSCRIPTIONS_PER_USER + 1;
      for (const old of mine.slice(0, Math.max(0, excess))) {
        await ctx.db.delete("pushSubscriptions", old._id);
      }
      await ctx.db.insert("pushSubscriptions", {
        userId,
        endpoint: args.endpoint,
        p256dh: args.p256dh,
        auth: args.auth,
        createdAt: Date.now(),
      });
    }
    return null;
  },
});

/** Deletes the caller's own subscription for an endpoint (no-op otherwise). */
export const removeSubscription = mutation({
  args: { endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing?.userId === userId) {
      await ctx.db.delete("pushSubscriptions", existing._id);
    }
    return null;
  },
});

/** Whether the caller has at least one saved push subscription (false when signed out). */
export const hasMySubscription = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    const userId = authUser ? resolveUserId(authUser) : null;
    if (!userId) return false;
    const first = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    return first !== null;
  },
});

/** Whether the caller has asked to be reminded when a sale opens. */
export const getMySaleReminder = query({
  args: { auctionId: v.id("auctions") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const authUser = await getAuthUser(ctx);
    const userId = authUser ? resolveUserId(authUser) : null;
    if (!userId) return false;
    const reminder = await ctx.db
      .query("saleReminders")
      .withIndex("by_userId_and_auctionId", (q) =>
        q.eq("userId", userId).eq("auctionId", args.auctionId)
      )
      .first();
    return reminder?.status === "pending";
  },
});

/**
 * Turns the caller's "Remind me when this sale opens" on or off. Idempotent.
 * Turning it on needs the feature enabled and a published sale that has not
 * opened yet; turning it off is always allowed.
 */
export const setSaleReminder = mutation({
  args: { auctionId: v.id("auctions"), on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const existing = await ctx.db
      .query("saleReminders")
      .withIndex("by_userId_and_auctionId", (q) =>
        q.eq("userId", userId).eq("auctionId", args.auctionId)
      )
      .collect();
    if (!args.on) {
      for (const row of existing) await ctx.db.delete("saleReminders", row._id);
      return null;
    }
    if (!(await isPushRemindersEnabled(ctx))) {
      throw new ConvexError("Reminders are not available");
    }
    const auction = await ctx.db.get("auctions", args.auctionId);
    if (auction?.status !== "published" || auction.startTime <= Date.now()) {
      throw new ConvexError("This sale can't be reminded");
    }
    const [row] = existing;
    if (!row) {
      await ctx.db.insert("saleReminders", {
        userId,
        auctionId: args.auctionId,
        status: "pending",
        startTime: auction.startTime,
        createdAt: Date.now(),
      });
    } else if (row.status === "sent") {
      // The sale was re-timed after its reminder went out: arm it again.
      await ctx.db.patch("saleReminders", row._id, {
        status: "pending",
        startTime: auction.startTime,
        sentAt: undefined,
      });
    } else if (row.startTime !== auction.startTime) {
      await ctx.db.patch("saleReminders", row._id, {
        startTime: auction.startTime,
      });
    }
    return null;
  },
});

/**
 * Sends the "sale is open" reminders that are due. Driven by the pending
 * reminders themselves (index `by_status_and_startTime`, on the sale's start
 * time copied onto each reminder), so the number of sales never starves a
 * reminder. Per run, bounded to {@link SALE_REMINDER_BATCH} rows each:
 *
 * 1. Reminders older than {@link SALE_REMINDER_STALE_MS} are dropped, unless
 *    their sale was re-timed into the future (then they are re-armed).
 * 2. Due reminders: the sale is loaded; if it is gone or unpublished the
 *    reminder is deleted, if it was re-timed the reminder's `startTime` is
 *    updated, otherwise it is marked sent, the in-app notification is
 *    created and the user's push subscriptions go into one scheduled batch.
 *
 * A full batch reschedules the gated cron wrapper to continue.
 *
 * @param ctx - Mutation context
 * @param now - Current time (ms)
 * @returns How many reminders were sent and whether more may remain
 */
export async function sendDueSaleRemindersHandler(
  ctx: MutationCtx,
  now: number
): Promise<{ sent: number; hasMore: boolean }> {
  if (!(await isPushRemindersEnabled(ctx))) return { sent: 0, hasMore: false };

  const staleBefore = now - SALE_REMINDER_STALE_MS;
  const stale = await ctx.db
    .query("saleReminders")
    .withIndex("by_status_and_startTime", (q) =>
      q.eq("status", "pending").lte("startTime", staleBefore)
    )
    .take(SALE_REMINDER_BATCH);
  for (const reminder of stale) {
    const sale = await ctx.db.get("auctions", reminder.auctionId);
    if (sale?.status === "published" && sale.startTime > staleBefore) {
      await ctx.db.patch("saleReminders", reminder._id, {
        startTime: sale.startTime,
      });
    } else {
      await ctx.db.delete("saleReminders", reminder._id);
    }
  }

  const due = await ctx.db
    .query("saleReminders")
    .withIndex("by_status_and_startTime", (q) =>
      q
        .eq("status", "pending")
        .gt("startTime", staleBefore)
        .lte("startTime", now)
    )
    .take(SALE_REMINDER_BATCH);

  let sent = 0;
  const messages: PushMessage[] = [];
  const sales = new Map<string, Doc<"auctions"> | null>();
  const body = "Bidding has started. Tap to see the lots.";
  for (const reminder of due) {
    let sale = sales.get(reminder.auctionId);
    if (sale === undefined) {
      sale = await ctx.db.get("auctions", reminder.auctionId);
      sales.set(reminder.auctionId, sale);
    }
    if (sale?.status !== "published") {
      await ctx.db.delete("saleReminders", reminder._id);
      continue;
    }
    if (sale.startTime !== reminder.startTime) {
      // Re-timed: follow the sale; it is picked up again when it is due.
      await ctx.db.patch("saleReminders", reminder._id, {
        startTime: sale.startTime,
      });
      continue;
    }

    const title = `${sale.title} is open`;
    const url = `/auctions/${sale._id}`;
    const payload = JSON.stringify({
      title,
      body,
      url,
      tag: `sale-${sale._id}`,
    });
    await ctx.db.patch("saleReminders", reminder._id, {
      status: "sent",
      sentAt: now,
    });
    await notifyUser(ctx, {
      recipientId: reminder.userId,
      type: "info",
      title,
      message: body,
      link: url,
    });
    // "Sales opening" switched off: the reminder is still marked sent and the
    // in-app notification written, but no push is queued.
    const subscriptions = (await pushSwitchAllows(
      ctx,
      reminder.userId,
      "notificationsSalesOpening"
    ))
      ? await ctx.db
          .query("pushSubscriptions")
          .withIndex("by_userId", (q) => q.eq("userId", reminder.userId))
          .take(SUBSCRIPTIONS_PER_USER)
      : [];
    for (const subscription of subscriptions) {
      messages.push({
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        payload,
      });
    }
    sent += 1;
  }

  if (messages.length > 0) {
    await ctx.scheduler.runAfter(0, internal.pushNode.sendPushBatch, {
      messages,
    });
  }
  // A full read means more rows may be waiting; every row read leaves the
  // due window (sent, deleted or re-timed), so the rerun always progresses.
  const hasMore =
    due.length >= SALE_REMINDER_BATCH || stale.length >= SALE_REMINDER_BATCH;
  if (hasMore) {
    await ctx.scheduler.runAfter(0, internal.cronJobs.sendSaleReminders, {});
  }
  return { sent, hasMore };
}

/** Internal: deletes subscriptions the push service reported as gone. */
export const deleteSubscriptions = internalMutation({
  args: { endpoints: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const endpoint of args.endpoints) {
      const rows = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
        .collect();
      for (const row of rows) await ctx.db.delete("pushSubscriptions", row._id);
    }
    return null;
  },
});
