/**
 * Statistics, reporting, and analytics queries for the admin dashboard.
 *
 * Provides aggregated metrics about auctions, users, support, and communications.
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCallerRole } from "../users";
import { UnauthorizedError } from "../lib/auth";
import { COMMISSION_RATE } from "../config";

/**
 * Count results from a paginated query by repeatedly paginating until completion.
 *
 * @param queryFn - Function that returns a fresh query object with a `paginate` method for retrieving pages
 * @param maxIterations - Maximum pagination iterations before aborting to prevent infinite loops (default: 1000)
 * @returns The total number of items across all pages
 * @throws Error if the pagination loop exceeds `maxIterations`
 */
async function countQuery(
  queryFn: () => {
    paginate: (options: {
      numItems: number;
      cursor: string | null;
    }) => Promise<{
      page: Record<string, unknown>[];
      continueCursor: string;
      isDone: boolean;
    }>;
  },
  maxIterations: number = 1000
) {
  let count = 0;
  let cursor: string | null = null;
  let isDone = false;
  let iterations = 0;

  while (!isDone) {
    if (iterations >= maxIterations) {
      throw new Error(
        `countQuery exceeded max iterations (${maxIterations}). Possible infinite loop or cursor invalidation.`
      );
    }
    const result = await queryFn().paginate({ numItems: 500, cursor });
    count += result.page.length;
    cursor = result.continueCursor;
    isDone = result.isDone;
    iterations++;
  }

  return count;
}

/**
 * Financial statistics including total sales volume and estimated commissions.
 *
 * Scans all sold auctions to compute global aggregates.
 * Only accessible to admin users.
 */
export const getFinancialStats = query({
  args: {},
  returns: v.object({
    totalSalesVolume: v.number(),
    estimatedCommission: v.number(),
    commissionRate: v.number(),
    recentSales: v.array(
      v.object({
        id: v.id("auctions"),
        title: v.string(),
        amount: v.number(),
        estimatedCommission: v.number(),
        date: v.number(),
      })
    ),
    auctionCount: v.number(),
  }),
  handler: async (ctx) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new UnauthorizedError();

    try {
      // Scan all sold auctions to compute global aggregates
      // SAFETY: We add a circuit breaker to avoid long-running queries
      let totalSalesVolume = 0;
      let auctionCount = 0;
      let cursor: string | null = null;
      let isDone = false;
      let iterations = 0;
      const MAX_ITERATIONS = 20; // Limit to 10,000 auctions total for now

      while (!isDone && iterations < MAX_ITERATIONS) {
        const page = await ctx.db
          .query("auctions")
          .withIndex("by_status", (q) => q.eq("status", "sold"))
          .paginate({ numItems: 500, cursor });

        for (const a of page.page) {
          totalSalesVolume += a.currentPrice;
          auctionCount++;
        }
        cursor = page.continueCursor;
        isDone = page.isDone;
        iterations++;
      }

      if (iterations >= MAX_ITERATIONS) {
        throw new Error(
          "getFinancialStats reached iteration limit. Totals may be incomplete."
        );
      }

      const estimatedCommission = totalSalesVolume * COMMISSION_RATE;

      // Fetch only the most recent sales for the activity list
      const recentSoldAuctions = await ctx.db
        .query("auctions")
        .withIndex("by_status_endTime", (q) => q.eq("status", "sold"))
        .order("desc")
        .take(10);

      const recentSales = recentSoldAuctions.map((a) => ({
        id: a._id,
        title: a.title,
        amount: a.currentPrice,
        estimatedCommission: a.currentPrice * COMMISSION_RATE,
        date: a.endTime ?? 0,
      }));

      return {
        totalSalesVolume,
        estimatedCommission,
        commissionRate: COMMISSION_RATE,
        recentSales,
        auctionCount,
      };
    } catch (err) {
      console.error("Error in getFinancialStats:", err);
      // Re-throw to allow frontend to catch and show error state
      throw err;
    }
  },
});

/**
 * Recalculates all counters from scratch by scanning the database.
 *
 * Should only be run manually or during migration to ensure counter accuracy.
 * Only accessible to admin users.
 */
export const initializeCounters = mutation({
  args: {},
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new UnauthorizedError();

    const [
      totalAuctions,
      activeAuctions,
      pendingAuctions,
      totalUsers,
      verifiedSellers,
      pendingKycProfiles,
    ] = await Promise.all([
      countQuery(() => ctx.db.query("auctions")),
      countQuery(() =>
        ctx.db
          .query("auctions")
          .withIndex("by_status", (q) => q.eq("status", "active"))
      ),
      countQuery(() =>
        ctx.db
          .query("auctions")
          .withIndex("by_status", (q) => q.eq("status", "pending_review"))
      ),
      countQuery(() => ctx.db.query("profiles")),
      countQuery(() =>
        ctx.db
          .query("profiles")
          .withIndex("by_isVerified", (q) => q.eq("isVerified", true))
      ),
      countQuery(() =>
        ctx.db
          .query("profiles")
          .withIndex("by_kycStatus", (q) => q.eq("kycStatus", "pending"))
      ),
    ]);

    // Update or insert auction counters
    const auctionCounter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "auctions"))
      .unique();
    const auctionPayload = {
      total: totalAuctions,
      active: activeAuctions,
      pending: pendingAuctions,
      verified: 0, // Auctions don't use verified
      updatedAt: Date.now(),
    };

    if (auctionCounter) {
      await ctx.db.patch(auctionCounter._id, auctionPayload);
    } else {
      await ctx.db.insert("counters", {
        name: "auctions",
        ...auctionPayload,
      });
    }

    // Update or insert profile counters
    const profileCounter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "profiles"))
      .unique();
    const profilePayload = {
      total: totalUsers,
      verified: verifiedSellers,
      active: 0, // Profiles don't use active/pending in this context currently
      pending: pendingKycProfiles,
      updatedAt: Date.now(),
    };

    if (profileCounter) {
      await ctx.db.patch(profileCounter._id, profilePayload);
    } else {
      await ctx.db.insert("counters", {
        name: "profiles",
        ...profilePayload,
      });
    }

    return { success: true };
  },
});

/**
 * Core admin dashboard statistics.
 *
 * Returns high-level metrics about auctions and users.
 * Only accessible to admin users.
 */
export const getAdminStats = query({
  args: {},
  returns: v.object({
    totalAuctions: v.number(),
    activeAuctions: v.number(),
    pendingReview: v.number(),
    totalUsers: v.number(),
    verifiedSellers: v.number(),
    kycPending: v.number(),
    status: v.union(v.literal("partial"), v.literal("healthy")), // To indicate partial/cached data
  }),
  handler: async (ctx) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new UnauthorizedError();

    try {
      // We prioritize counters for performance and scalability
      const [auctionCounter, profileCounter] = await Promise.all([
        ctx.db
          .query("counters")
          .withIndex("by_name", (q) => q.eq("name", "auctions"))
          .unique(),
        ctx.db
          .query("counters")
          .withIndex("by_name", (q) => q.eq("name", "profiles"))
          .unique(),
      ]);

      // If counters are missing, we return zeros but log a warning
      // This is safer than scanning the whole DB in a reactive query
      let status: "partial" | "healthy" = "healthy";
      if (!auctionCounter || !profileCounter) {
        console.warn(
          "Admin stats: Some counters are missing. Run initializeCounters."
        );
        status = "partial";
      }

      return {
        totalAuctions: auctionCounter?.total ?? 0,
        activeAuctions: auctionCounter?.active ?? 0,
        pendingReview: auctionCounter?.pending ?? 0,
        totalUsers: profileCounter?.total ?? 0,
        verifiedSellers: profileCounter?.verified ?? 0,
        kycPending: profileCounter?.pending ?? 0,
        status,
      };
    } catch (err) {
      console.error("Critical error in getAdminStats:", err);
      // Re-throw to allow frontend to catch and show error state
      throw err;
    }
  },
});

/**
 * Announcement/communication statistics.
 *
 * Tracks total and recent announcements distributed to users.
 * Only accessible to admin users.
 */
export const getAnnouncementStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    recent: v.number(),
  }),
  handler: async (ctx) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new UnauthorizedError();

    const announcementCounter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "announcements"))
      .unique();

    const counter = announcementCounter as { total?: number } | null;

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let recent = 0;
    const recentNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_createdAt", (q) =>
        q.eq("recipientId", "all").gte("createdAt", sevenDaysAgo)
      )
      .take(1000);
    recent = recentNotifications.length;

    return {
      total: counter?.total ?? 0,
      recent,
    };
  },
});

/**
 * Support ticket statistics.
 *
 * Tracks open, resolved, and total support tickets.
 * Only accessible to admin users.
 */
export const getSupportStats = query({
  args: {},
  returns: v.object({
    open: v.number(),
    resolved: v.number(),
    total: v.number(),
  }),
  handler: async (ctx) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new UnauthorizedError();

    const supportCounter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "support"))
      .unique();

    const counter = supportCounter as {
      open?: number;
      resolved?: number;
      total?: number;
    } | null;

    return {
      open: counter?.open ?? 0,
      resolved: counter?.resolved ?? 0,
      total: counter?.total ?? 0,
    };
  },
});
