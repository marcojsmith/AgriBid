import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";

const WINDOW_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Sends watchlist-ending-soon notifications to users whose watched auctions
 * are approaching their end time, respecting per-user window preferences.
 *
 * Note: The userPreferences and notificationLog fetches below follow an N+1
 * pattern (one query per user). This is a known scaling limitation — Convex
 * does not support batch-get-by-multiple-IDs, so sequential indexed lookups
 * are the idiomatic approach.
 *
 * @param ctx - Convex mutation context
 * @returns null
 */
export const notifyWatchlistEndingSoonHandler = async (
  ctx: MutationCtx
): Promise<null> => {
  const now = Date.now();

  // Find all active auctions ending within 24h (the widest supported window)
  const endingSoon = await ctx.db
    .query("auctions")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .filter((q) =>
      q.and(
        q.gt(q.field("endTime"), now),
        q.lte(q.field("endTime"), now + WINDOW_MS["24h"])
      )
    )
    .collect();

  if (endingSoon.length === 0) return null;

  // Collect all watcher userIds across all auctions
  const allWatcherUserIds = new Set<string>();
  const auctionWatchersMap = new Map<Id<"auctions">, string[]>();

  for (const auction of endingSoon) {
    const watchers = await ctx.db
      .query("watchlist")
      .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
      .collect();

    const watcherIds = watchers.map((w) => w.userId);
    auctionWatchersMap.set(auction._id, watcherIds);
    for (const id of watcherIds) {
      allWatcherUserIds.add(id);
    }
  }

  // Fetch all userPreferences for watchers (N+1 — known scaling limitation,
  // see function comment above).
  const userIds = [...allWatcherUserIds];
  const prefsMap = new Map<string, Doc<"userPreferences"> | null>();
  for (const userId of userIds) {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    prefsMap.set(userId, prefs);
  }

  // Fetch notificationLog entries within the last 24 hours for deduplication.
  // This avoids notifying the same user about the same auction more than once
  // per day, regardless of how often the cron runs.
  const dedupWindowStart = now - DEDUP_WINDOW_MS;
  const notificationLogMap = new Map<string, Set<Id<"auctions">>>();
  for (const userId of userIds) {
    const logs = await ctx.db
      .query("notificationLog")
      .withIndex("by_user_auction", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("notifiedAt"), dedupWindowStart))
      .collect();
    const auctionIds = new Set(logs.map((l) => l.auctionId));
    notificationLogMap.set(userId, auctionIds);
  }

  for (const auction of endingSoon) {
    if (!auction.endTime) continue;
    const timeLeft = auction.endTime - now;

    const watchers = auctionWatchersMap.get(auction._id) ?? [];

    for (const watcherUserId of watchers) {
      const prefs = prefsMap.get(watcherUserId);

      const windowPref = prefs?.notificationsWatchlistEnding?.window ?? "1h";
      const inApp = prefs?.notificationsWatchlistEnding?.inApp ?? true;

      if (windowPref === "disabled" || !inApp) continue;

      const windowMs = WINDOW_MS[windowPref];
      if (!windowMs) continue;

      // Only notify if the auction is within the user's configured window
      if (timeLeft > windowMs) continue;

      // Avoid duplicate notifications using notificationLog (last 24h window)
      const alreadyNotified = notificationLogMap
        .get(watcherUserId)
        ?.has(auction._id);
      if (alreadyNotified) continue;

      const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
      const timeLabel =
        minutesLeft >= 60
          ? `${Math.ceil(minutesLeft / 60).toString()}h`
          : `${minutesLeft.toString()}m`;

      await ctx.runMutation(internal.notifications.notifyUser, {
        recipientId: watcherUserId,
        type: "warning",
        title: "Watchlist auction ending soon",
        message: `"${auction.title}" ends in ~${timeLabel}. Don't miss your chance to bid.`,
        link: `/auctions/${auction._id}`,
        event: "watchlistEnding",
      });

      // Log the notification for deduplication
      await ctx.db.insert("notificationLog", {
        userId: watcherUserId,
        auctionId: auction._id,
        notifiedAt: now,
      });
    }
  }

  return null;
};

/**
 * Scheduled mutation that scans all active auctions and sends in-app (and push,
 * if enabled) notifications to users who have watchlisted an auction ending
 * within their configured alert window. Takes no arguments and returns null.
 * See {@link notifyWatchlistEndingSoonHandler} for full implementation details.
 */
export const notifyWatchlistEndingSoon = internalMutation({
  args: {},
  returns: v.null(),
  handler: notifyWatchlistEndingSoonHandler,
});

/**
 * Deletes notificationLog rows older than 7 days to prevent unbounded growth.
 * Intended to run daily via a cron job.
 */
export const cleanupOldNotificationLogs = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("notificationLog")
      .withIndex("by_notifiedAt", (q) => q.lt("notifiedAt", cutoff))
      .collect();
    for (const row of old) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});
