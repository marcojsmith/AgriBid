import { v } from "convex/values";

import {
  internalQuery,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";

/** Maps notification event types to their preference field names. */
const EVENT_TO_PREFERENCE_FIELD = {
  outbid: "notificationsOutbid",
  auctionWon: "notificationsAuctionWon",
  auctionLost: "notificationsAuctionWon",
  reserveNotMet: "notificationsAuctionWon",
  watchlistEnding: "notificationsWatchlistEnding",
  listingApproved: "notificationsListingApproved",
} as const;

type NotificationEventType = keyof typeof EVENT_TO_PREFERENCE_FIELD;

/**
 * Gets the user's push preference for a specific notification event type.
 * Defaults to `true` (push enabled) when no preference is stored.
 *
 * @param ctx - Convex query context
 * @param userId - The user ID to check
 * @param eventType - The notification event type
 * @returns Whether push notifications are enabled for this event type
 */
export const getNotificationPreference = internalQuery({
  args: {
    userId: v.string(),
    eventType: v.union(
      v.literal("outbid"),
      v.literal("auctionWon"),
      v.literal("auctionLost"),
      v.literal("reserveNotMet"),
      v.literal("watchlistEnding"),
      v.literal("listingApproved")
    ),
  },
  returns: v.object({ push: v.boolean() }),
  handler: async (
    ctx: QueryCtx,
    args: { userId: string; eventType: NotificationEventType }
  ) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    const prefKey = EVENT_TO_PREFERENCE_FIELD[args.eventType];
    const pref = prefs?.[prefKey] as { push: boolean } | undefined;
    return { push: pref?.push ?? true };
  },
});

/**
 * Gets all push subscriptions for a user across all devices.
 *
 * @param ctx - Convex query context
 * @param userId - The user ID
 * @returns Array of push subscription documents
 */
export const getSubscriptionsForUser = internalQuery({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("pushSubscriptions"),
      _creationTime: v.number(),
      userId: v.string(),
      endpoint: v.string(),
      expirationTime: v.union(v.number(), v.null()),
      keys: v.object({
        p256dh: v.string(),
        auth: v.string(),
      }),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx: QueryCtx, args: { userId: string }) => {
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Gets all user IDs that have push notifications enabled globally.
 *
 * @param ctx - Convex query context
 * @returns Array of user IDs with push enabled
 */
export const getUserIdsWithPushEnabled = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx: QueryCtx) => {
    const subs = await ctx.db.query("pushSubscriptions").collect();
    return [...new Set(subs.map((s) => s.userId))];
  },
});

/**
 * Removes an expired push subscription by endpoint.
 *
 * @param ctx - Convex mutation context
 * @param endpoint - The expired subscription endpoint
 */
export const removeExpiredSubscription = internalMutation({
  args: { endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx: MutationCtx, args: { endpoint: string }) => {
    const sub = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();

    if (sub) {
      await ctx.db.delete(sub._id);
    }
    return null;
  },
});

/**
 * Upserts a push subscription for a user. Updates keys if the endpoint
 * already exists, or inserts a new subscription.
 *
 * @param ctx - Convex mutation context
 * @param userId - The user ID
 * @param subscription - The PushSubscriptionJSON data
 */
export const upsertPushSubscription = internalMutation({
  args: {
    userId: v.string(),
    endpoint: v.string(),
    expirationTime: v.union(v.number(), v.null()),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
  },
  returns: v.null(),
  handler: async (ctx: MutationCtx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        keys: args.keys,
        expirationTime: args.expirationTime,
      });
    } else {
      await ctx.db.insert("pushSubscriptions", {
        userId: args.userId,
        endpoint: args.endpoint,
        expirationTime: args.expirationTime,
        keys: args.keys,
        createdAt: Date.now(),
      });
    }
    return null;
  },
});

/**
 * Removes all push subscriptions for a user (used when push is disabled).
 *
 * @param ctx - Convex mutation context
 * @param userId - The user ID
 */
export const removeAllSubscriptionsForUser = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx: MutationCtx, args: { userId: string }) => {
    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const sub of subs) {
      await ctx.db.delete(sub._id);
    }
    return null;
  },
});
