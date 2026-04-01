import { v } from "convex/values";

import { query, mutation } from "./_generated/server";
import { getAuthUser, resolveUserId, getAuthenticatedUserId } from "./lib/auth";

/**
 * Shared preference field validators used by both the full document validator
 * and the mutation args to prevent drift.
 */
const preferenceFields = {
  viewMode: v.optional(v.union(v.literal("compact"), v.literal("detailed"))),
  sidebarOpen: v.optional(v.boolean()),
  defaultStatusFilter: v.optional(
    v.union(v.literal("active"), v.literal("closed"), v.literal("all"))
  ),
  defaultMake: v.optional(v.string()),
  defaultMinYear: v.optional(v.number()),
  defaultMaxYear: v.optional(v.number()),
  defaultMaxHours: v.optional(v.number()),
  defaultMinPrice: v.optional(v.number()),
  defaultMaxPrice: v.optional(v.number()),
  biddingRequireConfirmation: v.optional(v.boolean()),
  biddingProxyBidDefault: v.optional(v.boolean()),
  notificationsOutbid: v.optional(
    v.object({
      inApp: v.boolean(),
      push: v.boolean(),
      email: v.boolean(),
      whatsapp: v.boolean(),
    })
  ),
  notificationsAuctionWon: v.optional(
    v.object({
      inApp: v.boolean(),
      push: v.boolean(),
      email: v.boolean(),
      whatsapp: v.boolean(),
    })
  ),
  notificationsAuctionLost: v.optional(
    v.object({
      inApp: v.boolean(),
      push: v.boolean(),
      email: v.boolean(),
      whatsapp: v.boolean(),
    })
  ),
  notificationsReserveNotMet: v.optional(
    v.object({
      inApp: v.boolean(),
      push: v.boolean(),
      email: v.boolean(),
      whatsapp: v.boolean(),
    })
  ),
  notificationsWatchlistEnding: v.optional(
    v.object({
      inApp: v.boolean(),
      push: v.boolean(),
      email: v.boolean(),
      whatsapp: v.boolean(),
      window: v.union(
        v.literal("disabled"),
        v.literal("1h"),
        v.literal("3h"),
        v.literal("24h")
      ),
    })
  ),
  notificationsListingApproved: v.optional(
    v.object({
      inApp: v.boolean(),
      push: v.boolean(),
      email: v.boolean(),
      whatsapp: v.boolean(),
    })
  ),
};

/**
 * Validator for the full userPreferences document.
 * Used by server queries/mutations and for type-safe consumption in the frontend.
 * Validates the complete shape of a userPreferences document, including system fields
 * (_id, _creationTime, userId, updatedAt) and all user-configurable preference fields
 * defined in preferenceFields.
 */
export const UserPreferencesValidator = v.object({
  _id: v.id("userPreferences"),
  _creationTime: v.number(),
  userId: v.string(),
  ...preferenceFields,
  updatedAt: v.number(),
});

/**
 * Fetch the authenticated user's preferences.
 * Returns null for unauthenticated users.
 */
export const getMyPreferences = query({
  args: {},
  returns: v.union(UserPreferencesValidator, v.null()),
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return null;
    const userId = resolveUserId(authUser);
    if (!userId) return null;

    return await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

/**
 * Upsert the authenticated user's preferences.
 * All fields are optional — only provided fields are persisted.
 */
export const updateMyPreferences = mutation({
  args: {
    ...preferenceFields,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    // Cross-field validation: compare incoming values against opposite bound
    // from either args or existing preferences to prevent invalid ranges.
    const minYear = args.defaultMinYear ?? existing?.defaultMinYear;
    const maxYear = args.defaultMaxYear ?? existing?.defaultMaxYear;
    if (minYear !== undefined && maxYear !== undefined && minYear > maxYear) {
      throw new Error("defaultMinYear cannot be greater than defaultMaxYear");
    }

    const minPrice = args.defaultMinPrice ?? existing?.defaultMinPrice;
    const maxPrice = args.defaultMaxPrice ?? existing?.defaultMaxPrice;
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new Error("defaultMinPrice cannot be greater than defaultMaxPrice");
    }

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
    } else {
      await ctx.db.insert("userPreferences", {
        userId,
        ...args,
        updatedAt: now,
      });
    }

    return null;
  },
});
