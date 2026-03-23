import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { COMMISSION_RATE } from "../config";
import {
  countQuery,
  countUsers,
  getCounter,
  type CounterField,
} from "../admin_utils";
import { countOnlineUsers } from "../presence";
import { MS_PER_DAY } from "../constants";

const RECENT_DAYS_THRESHOLD = 7;

/**
 * Internal helper to upsert a counter document with multiple fields.
 *
 * This function overwrites existing counter fields with the provided values in the `payload` object.
 * It does not increment or accumulate existing values; it uses `ctx.db.patch` for existing documents
 * and `ctx.db.insert` for new ones, writing the `payload` values as-is.
 *
 * @param ctx - Convex mutation context used for DB operations
 * @param name - The identifier for the counter document (e.g., "auctions", "profiles")
 * @param payload - Object mapping counter fields to their new values to be written/overwritten
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
  args: {
    salesPaginationOpts: v.optional(paginationOptsValidator),
  },
  returns: v.object({
    totalSalesVolume: v.number(),
    estimatedCommission: v.number(),
    commissionRate: v.number(),
    recentSales: v.object({
      page: v.array(
        v.object({
          id: v.id("auctions"),
          title: v.string(),
          amount: v.number(),
          estimatedCommission: v.number(),
          date: v.number(),
        })
      ),
      isDone: v.boolean(),
      continueCursor: v.string(),
      totalCount: v.number(),
      pageStatus: v.null(),
      splitCursor: v.null(),
    }),
    auctionCount: v.number(),
    partialResults: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    try {
      const counter = await getCounter(ctx, "auctions");

      let totalSalesVolume = counter?.salesVolume ?? 0;
      let auctionCount = counter?.soldCount ?? 0;
      let partialResults = false;

      const computeSoldAuctions = async () => {
        let sum = 0;
        let count = 0;
        let cursor: string | null = null;
        let isDone = false;
        while (!isDone) {
          const page = await ctx.db
            .query("auctions")
            .withIndex("by_status", (q) => q.eq("status", "sold"))
            .paginate({ numItems: 500, cursor });
          for (const a of page.page) {
            sum += a.currentPrice;
            count++;
          }
          cursor = page.continueCursor;
          isDone = page.isDone;
        }
        return { sum, count };
      };

      if (counter?.soldCount === undefined) {
        partialResults = true;
        const computed = await computeSoldAuctions();
        totalSalesVolume = computed.sum;
        auctionCount = computed.count;
      } else if (counter?.soldCount !== undefined) {
        const liveSoldCount = await countQuery(
          ctx.db
            .query("auctions")
            .withIndex("by_status", (q) => q.eq("status", "sold"))
        );
        if (liveSoldCount !== counter.soldCount) {
          partialResults = true;
          const computed = await computeSoldAuctions();
          totalSalesVolume = computed.sum;
          auctionCount = computed.count;
        }
      }

      const estimatedCommission = totalSalesVolume * COMMISSION_RATE;

      const numItems = args.salesPaginationOpts?.numItems ?? 100;
      const cursor = args.salesPaginationOpts?.cursor ?? null;
      const parsed = cursor ? parseInt(cursor, 10) : 0;
      const startIndex = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;

      const [recentSoldAuctions, totalSoldCount] = await Promise.all([
        ctx.db
          .query("auctions")
          .withIndex("by_status_endTime", (q) => q.eq("status", "sold"))
          .order("desc")
          .take(startIndex + numItems),
        countQuery(
          ctx.db
            .query("auctions")
            .withIndex("by_status_endTime", (q) => q.eq("status", "sold"))
        ),
      ]);

      const allSales = recentSoldAuctions.map((a) => ({
        id: a._id,
        title: a.title,
        amount: a.currentPrice,
        estimatedCommission: a.currentPrice * COMMISSION_RATE,
        date: a.endTime ?? 0,
      }));

      const page = allSales.slice(startIndex);
      const isDone = allSales.length < startIndex + numItems;
      const continueCursor = isDone ? "" : String(startIndex + page.length);

      return {
        totalSalesVolume,
        estimatedCommission,
        commissionRate: COMMISSION_RATE,
        recentSales: {
          page,
          isDone,
          continueCursor,
          totalCount: totalSoldCount,
          pageStatus: null,
          splitCursor: null,
        },
        auctionCount,
        partialResults,
      };
    } catch (err) {
      console.error("Error in getFinancialStats:", err);
      throw err;
    }
  },
});

/**
 * Handler for recalculating all counters from scratch.
 * @param ctx - The mutation context.
 * @returns Object indicating success status.
 */
export const initializeCountersHandler = async (ctx: MutationCtx) => {
  await requireAdmin(ctx);

  const [
    totalAuctions,
    activeAuctions,
    pendingAuctions,
    totalUsers,
    verifiedSellers,
    kycPending,
    activeWatch,
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
  ]);

  let soldSum = 0;
  let soldCount = 0;
  let cursor: string | null = null;
  let isDone = false;
  while (!isDone) {
    const page = await ctx.db
      .query("auctions")
      .withIndex("by_status", (q) => q.eq("status", "sold"))
      .paginate({ numItems: 500, cursor });
    for (const a of page.page) {
      soldSum += a.currentPrice;
      soldCount++;
    }
    cursor = page.continueCursor;
    isDone = page.isDone;
  }

  await Promise.all([
    upsertCounter(ctx, "auctions", {
      total: totalAuctions,
      active: activeAuctions,
      pending: pendingAuctions,
      salesVolume: soldSum,
      soldCount,
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
};

/**
 * Recalculates all counters from scratch.
 */
export const initializeCounters = mutation({
  args: {},
  returns: v.object({ success: v.boolean() }),
  handler: initializeCountersHandler,
});

/**
 * Handler for core admin dashboard statistics.
 * @param ctx - The query context.
 * @returns Stats object.
 */
export const getAdminStatsHandler = async (ctx: QueryCtx) => {
  await requireAdmin(ctx);

  try {
    const [
      auctionCounter,
      profileCounter,
      watchlistCounter,
      liveUsers,
      pendingKycProfiles,
    ] = await Promise.all([
      getCounter(ctx, "auctions"),
      getCounter(ctx, "profiles"),
      getCounter(ctx, "watchlist"),
      countOnlineUsers(ctx),
      countQuery(
        ctx.db
          .query("profiles")
          .withIndex("by_kycStatus", (q) => q.eq("kycStatus", "pending"))
      ),
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
      kycPending: pendingKycProfiles,
      liveUsers,
      activeWatch: watchlistCounter?.total ?? 0,
      status,
    };
  } catch (err) {
    console.error("Critical error in getAdminStats:", err);
    // Re-throw to allow frontend to catch and show error state
    throw err;
  }
};

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
  handler: getAdminStatsHandler,
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
    await requireAdmin(ctx);

    const counter = await getCounter(ctx, "announcements");

    const now = Date.now();
    const sevenDaysAgo = now - RECENT_DAYS_THRESHOLD * MS_PER_DAY;

    const recent = await countQuery(
      ctx.db
        .query("notifications")
        .withIndex("by_recipient_createdAt", (q) =>
          q.eq("recipientId", "all").gte("createdAt", sevenDaysAgo)
        )
    );

    return {
      total: counter?.total ?? 0,
      recent,
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
    await requireAdmin(ctx);

    const counter = await getCounter(ctx, "support");

    return {
      open: counter?.open ?? 0,
      resolved: counter?.resolved ?? 0,
      total: counter?.total ?? 0,
    };
  },
});
