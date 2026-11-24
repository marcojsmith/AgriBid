import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
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
import type { PushMessage } from "./lib/pushDelivery";

/** Longest push endpoint URL we store. */
const MAX_ENDPOINT_LENGTH = 2048;
/** Longest p256dh / auth key we store (real keys are 87 and 22 characters). */
const MAX_KEY_LENGTH = 128;
/** Sales examined per reminder run. */
const SALES_PER_RUN = 50;
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
      !args.endpoint.startsWith("https://") ||
      args.endpoint.length > MAX_ENDPOINT_LENGTH ||
      args.p256dh.length > MAX_KEY_LENGTH ||
      args.auth.length > MAX_KEY_LENGTH
    ) {
      throw new ConvexError("Invalid push endpoint");
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
    if (row?.status === "sent") {
      // The sale was re-timed after its reminder went out: arm it again.
      await ctx.db.patch("saleReminders", row._id, {
        status: "pending",
        sentAt: undefined,
      });
    } else if (!row) {
      await ctx.db.insert("saleReminders", {
        userId,
        auctionId: args.auctionId,
        status: "pending",
        createdAt: Date.now(),
      });
    }
    return null;
  },
});

/**
 * Sends the "sale is open" reminders that are due: for each published sale
 * that opened in the last {@link SALE_REMINDER_STALE_MS}, marks pending
 * reminders sent, creates the in-app notification and schedules one push
 * batch. Bounded to {@link SALE_REMINDER_BATCH} reminders per run; a full
 * batch reschedules the gated cron wrapper to continue.
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

  const sales = await ctx.db
    .query("auctions")
    .withIndex("by_status_startTime", (q) =>
      q
        .eq("status", "published")
        .gt("startTime", now - SALE_REMINDER_STALE_MS)
        .lte("startTime", now)
    )
    .take(SALES_PER_RUN);

  let sent = 0;
  const messages: PushMessage[] = [];
  for (const sale of sales) {
    const budget = SALE_REMINDER_BATCH - sent;
    if (budget <= 0) break;
    const pending = await ctx.db
      .query("saleReminders")
      .withIndex("by_auctionId_and_status", (q) =>
        q.eq("auctionId", sale._id).eq("status", "pending")
      )
      .take(budget);
    if (pending.length === 0) continue;

    const title = `${sale.title} is open`;
    const body = "Bidding has started. Tap to see the lots.";
    const url = `/auctions/${sale._id}`;
    const payload = JSON.stringify({
      title,
      body,
      url,
      tag: `sale-${sale._id}`,
    });
    for (const reminder of pending) {
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
      const subscriptions = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", reminder.userId))
        .take(SUBSCRIPTIONS_PER_USER);
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
  }

  if (messages.length > 0) {
    await ctx.scheduler.runAfter(0, internal.pushNode.sendPushBatch, {
      messages,
    });
  }
  const hasMore = sent >= SALE_REMINDER_BATCH;
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
