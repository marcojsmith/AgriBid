import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { getCallerRole } from "../users";
import { UnauthorizedError } from "../lib/auth";
import { COMMISSION_RATE } from "../config";
import {
  countQuery,
  countUsers,
  sumQuery,
  getCounter,
  type CounterField,
} from "../admin_utils";
import { countOnlineUsers } from "../presence";

/**
 * Internal helper to upsert a counter document with multiple fields.
 */
async function upsertCounter(
  ctx: MutationCtx,
  name: string,
  payload: Partial<Record<CounterField, number>>
) {
  const existing = await getCounter(ctx, name);
  const data = {
    ...payload,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, data);
  } else {
    await ctx.db.insert("counters", {
      name,
      total: 0,
      active: 0,
      pending: 0,
      verified: 0,
      open: 0,
      resolved: 0,
      draft: 0,
      salesVolume: 0,
      soldCount: 0,
      ...data,
    });
  }
}

/**
 * Financial statistics including total sales volume and estimated commissions.
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
    truncated: v.optional(v.boolean()),
  }),
  handler: async (ctx) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new UnauthorizedError();

    try {
      const counter = await getCounter(ctx, "auctions");

      let totalSalesVolume = counter?.salesVolume ?? 0;
      let auctionCount = counter?.soldCount ?? 0;
      let truncated = false;

      // Fallback: If counters are missing or look wrong, we can still do a scan
      // For now, we trust the counter if it exists.
      if (!counter || counter.soldCount === undefined) {
        // Scan all sold auctions to compute global aggregates
        // SAFETY: We add a circuit breaker to avoid long-running queries
        totalSalesVolume = 0;
        auctionCount = 0;
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
          console.warn(
            "getFinancialStats reached iteration limit during fallback scan. Totals are truncated."
          );
          truncated = true;
        }
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
        truncated,
      };
    } catch (err) {
      console.error("Error in getFinancialStats:", err);
      // Re-throw to allow frontend to catch and show error state
      throw err;
    }
  },
});

/**
 * Recalculates all counters from scratch.
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
      kycPending,
      activeWatch,
      soldStats,
    ] = await Promise.all([
      countQuery(ctx.db.query("auctions")),
      countQuery(
        ctx.db
          .query("auctions")
          .withIndex("by_status", (q) => q.eq("status", "active"))
      ),
      countQuery(
        ctx.db
          .query("auctions")
          .withIndex("by_status", (q) => q.eq("status", "pending_review"))
      ),
      countUsers(ctx),
      countUsers(ctx, { isVerified: true }),
      countUsers(ctx, { kycStatus: "pending" }),
      countQuery(ctx.db.query("watchlist")),
      sumQuery(
        ctx.db
          .query("auctions")
          .withIndex("by_status", (q) => q.eq("status", "sold")),
        "currentPrice"
      ),
    ]);

    await Promise.all([
      upsertCounter(ctx, "auctions", {
        total: totalAuctions,
        active: activeAuctions,
        pending: pendingAuctions,
        salesVolume: soldStats.sum,
        soldCount: soldStats.count,
      }),
      upsertCounter(ctx, "profiles", {
        total: totalUsers,
        verified: verifiedSellers,
        pending: kycPending,
      }),
      upsertCounter(ctx, "watchlist", {
        total: activeWatch,
      }),
    ]);

    return { success: true };
  },
});

/**
 * Core admin dashboard statistics.
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
    liveUsers: v.number(),
    activeWatch: v.number(),
  }),
  handler: async (ctx) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new UnauthorizedError();

    try {
      const [auctionCounter, profileCounter, watchlistCounter, liveUsers] =
        await Promise.all([
          getCounter(ctx, "auctions"),
          getCounter(ctx, "profiles"),
          getCounter(ctx, "watchlist"),
          countOnlineUsers(ctx),
        ]);

      // If counters are missing, we return zeros but log a warning
      let status: "partial" | "healthy" = "healthy";
      if (!auctionCounter || !profileCounter || !watchlistCounter) {
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
        liveUsers,
        activeWatch: watchlistCounter?.total ?? 0,
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
 * Announcement statistics.
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

    const counter = await getCounter(ctx, "announcements");

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const recentCount = (
      await ctx.db
        .query("notifications")
        .withIndex("by_recipient_createdAt", (q) =>
          q.eq("recipientId", "all").gte("createdAt", sevenDaysAgo)
        )
        .take(1000)
    ).length;

    return {
      total: counter?.total ?? 0,
      recent: recentCount,
    };
  },
});

/**
 * Support ticket statistics.
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

    const counter = await getCounter(ctx, "support");

    return {
      open: counter?.open ?? 0,
      resolved: counter?.resolved ?? 0,
      total: counter?.total ?? 0,
    };
  },
});
