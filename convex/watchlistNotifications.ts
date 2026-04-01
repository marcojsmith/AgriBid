import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

const WINDOW_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

/**
 * Sends watchlist-ending-soon notifications to users whose watched auctions
 * are approaching their end time, respecting per-user window preferences.
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

  for (const auction of endingSoon) {
    if (!auction.endTime) continue;
    const timeLeft = auction.endTime - now;

    // Find all watchers of this auction (no by_auction index, use filter)
    const watchers = await ctx.db
      .query("watchlist")
      .withIndex("by_user_auction")
      .filter((q) => q.eq(q.field("auctionId"), auction._id))
      .collect();

    for (const watcher of watchers) {
      const prefs = await ctx.db
        .query("userPreferences")
        .withIndex("by_userId", (q) => q.eq("userId", watcher.userId))
        .unique();

      const windowPref = prefs?.notificationsWatchlistEnding?.window ?? "1h";
      const inApp = prefs?.notificationsWatchlistEnding?.inApp ?? true;

      if (windowPref === "disabled" || !inApp) continue;

      const windowMs = WINDOW_MS[windowPref];
      if (!windowMs) continue;

      // Only notify if the auction is within the user's configured window
      if (timeLeft > windowMs) continue;

      // Avoid duplicate notifications within the same window
      const alreadyNotified = await ctx.db
        .query("notifications")
        .withIndex("by_recipient_createdAt", (q) =>
          q.eq("recipientId", watcher.userId).gt("createdAt", now - windowMs)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("title"), "Watchlist auction ending soon"),
            q.eq(q.field("link"), `/auctions/${auction._id}`)
          )
        )
        .first();

      if (alreadyNotified) continue;

      const hoursLeft = Math.round(timeLeft / (60 * 60 * 1000));
      const timeLabel = hoursLeft >= 1 ? `${hoursLeft.toString()}h` : "soon";

      await ctx.runMutation(internal.notifications.notifyUser, {
        recipientId: watcher.userId,
        type: "warning",
        title: "Watchlist auction ending soon",
        message: `"${auction.title}" ends in ~${timeLabel}. Don't miss your chance to bid.`,
        link: `/auctions/${auction._id}`,
        event: "watchlistEnding",
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
