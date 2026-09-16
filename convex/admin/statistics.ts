import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { requireAdmin } from "../lib/auth";
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
 * Computes total sold lot sums and counts via cursor-based pagination.
 *
 * Full pagination is required because sold lots can exceed Convex's single-query
 * document limit (~8192). This helper pages through all sold lots to accurately
 * compute salesVolume and soldCount without truncation.
 *
 * @param ctx - Convex mutation or query context used for DB operations
 * @returns Promise resolving to { sum: total currentPrice, count: number of sold lots }
 */
async function computeSoldLots(
  ctx: MutationCtx | QueryCtx
): Promise<{ sum: number; count: number }> {
  let sum = 0;
  let count = 0;
  let cursor: string | null = null;
  let isDone = false;
  while (!isDone) {
    const page = await ctx.db
      .query("lots")
      .withIndex("by_status", (q) => q.eq("status", "sold"))
      .paginate({ numItems: 500, cursor });
    for (const lot of page.page) {
      sum += lot.currentPrice;
      count++;
    }
    cursor = page.continueCursor;
    isDone = page.isDone;
  }
  return { sum, count };
}

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
    await ctx.db.patch("counters", existing._id, data);
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
 * Financial statistics including total sales volume and actual fees collected.
 */
export const getFinancialStats = query({
  args: {
    salesPaginationOpts: v.optional(paginationOptsValidator),
  },
  returns: v.object({
    totalSalesVolume: v.number(),
    totalFeesCollected: v.number(),
    buyerFeesTotal: v.number(),
    sellerFeesTotal: v.number(),
    recentSales: v.object({
      page: v.array(
        v.object({
          id: v.id("lots"),
          title: v.string(),
          amount: v.number(),
          fees: v.array(
            v.object({
              feeName: v.string(),
              appliedTo: v.union(v.literal("buyer"), v.literal("seller")),
              amount: v.number(),
            })
          ),
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
      const counter = await getCounter(ctx, "lots");
      const salesVolume = counter?.salesVolume;
      const soldCount = counter?.soldCount;

      let totalSalesVolume = 0;
      let auctionCount = 0;
      let partialResults = false;

      if (salesVolume == null || soldCount == null) {
        partialResults = true;
        const computed = await computeSoldLots(ctx);
        totalSalesVolume = computed.sum;
        auctionCount = computed.count;
      } else {
        totalSalesVolume = salesVolume;
        auctionCount = soldCount;
        const liveSoldCount = await countQuery(
          ctx.db
            .query("lots")
            .withIndex("by_status", (q) => q.eq("status", "sold"))
        );
        if (liveSoldCount !== soldCount) {
          partialResults = true;
          const computed = await computeSoldLots(ctx);
          totalSalesVolume = computed.sum;
          auctionCount = computed.count;
        }
      }

      const numItems = args.salesPaginationOpts?.numItems ?? 100;
      const cursor = args.salesPaginationOpts?.cursor ?? null;
      const parsed = cursor ? parseInt(cursor, 10) : 0;
      const startIndex = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;

      const [recentSoldLots, totalSoldCount, allLotFees] = await Promise.all([
        ctx.db
          .query("lots")
          .withIndex("by_status_endTime", (q) => q.eq("status", "sold"))
          .order("desc")
          .take(startIndex + numItems),
        countQuery(
          ctx.db
            .query("lots")
            .withIndex("by_status_endTime", (q) => q.eq("status", "sold"))
        ),
        ctx.db.query("lotFees").collect(),
      ]);

      const lotFeeMap = new Map<
        string,
        {
          feeName: string;
          appliedTo: "buyer" | "seller";
          amount: number;
        }[]
      >();

      let buyerFeesTotal = 0;
      let sellerFeesTotal = 0;

      for (const fee of allLotFees) {
        if (fee.appliedTo === "buyer") {
          buyerFeesTotal += fee.calculatedAmount;
        } else {
          sellerFeesTotal += fee.calculatedAmount;
        }

        // Fees and recentSales are both lot-scoped, so they key directly on
        // the lot id.
        const existing = lotFeeMap.get(fee.lotId);
        if (existing) {
          existing.push({
            feeName: fee.feeName,
            appliedTo: fee.appliedTo,
            amount: fee.calculatedAmount,
          });
        } else {
          lotFeeMap.set(fee.lotId, [
            {
              feeName: fee.feeName,
              appliedTo: fee.appliedTo,
              amount: fee.calculatedAmount,
            },
          ]);
        }
      }

      const totalFeesCollected = buyerFeesTotal + sellerFeesTotal;

      const allSales = recentSoldLots.map((lot) => ({
        id: lot._id,
        title: lot.title,
        amount: lot.currentPrice,
        fees: lotFeeMap.get(lot._id) ?? [],
        date: lot.settledAt ?? 0,
      }));

      const page = allSales.slice(startIndex);
      const isDone = allSales.length < startIndex + numItems;
      const continueCursor = isDone ? "" : String(startIndex + page.length);

      return {
        totalSalesVolume,
        totalFeesCollected,
        buyerFeesTotal,
        sellerFeesTotal,
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
    totalLots,
    approvedLots,
    assignedLots,
    pendingLots,
    draftLots,
    totalUsers,
    verifiedSellers,
    kycPending,
    activeWatch,
  ] = await Promise.all([
    countQuery(ctx.db.query("lots")),
    countQuery(
      ctx.db
        .query("lots")
        .withIndex("by_status", (q) => q.eq("status", "approved"))
    ),
    countQuery(
      ctx.db
        .query("lots")
        .withIndex("by_status", (q) => q.eq("status", "assigned"))
    ),
    countQuery(
      ctx.db
        .query("lots")
        .withIndex("by_status", (q) => q.eq("status", "pending_review"))
    ),
    countQuery(
      ctx.db
        .query("lots")
        .withIndex("by_status", (q) => q.eq("status", "draft"))
    ),
    countUsers(ctx),
    countUsers(ctx, { isVerified: true }),
    countUsers(ctx, { kycStatus: "pending" }),
    countQuery(ctx.db.query("watchlist")),
  ]);

  // Step-3 counter semantics: `approved` and `assigned` lots are both live.
  const activeLots = approvedLots + assignedLots;

  const { sum: soldSum, count: soldCount } = await computeSoldLots(ctx);

  await Promise.all([
    // The global item counter is `lots` (mirrors step-3's adjustLotStatusCounters).
    // No `auctions` container counter is written because nothing reads one.
    upsertCounter(ctx, "lots", {
      total: totalLots,
      active: activeLots,
      pending: pendingLots,
      draft: draftLots,
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
    const [lotCounter, profileCounter, watchlistCounter, liveUsers] =
      await Promise.all([
        getCounter(ctx, "lots"),
        getCounter(ctx, "profiles"),
        getCounter(ctx, "watchlist"),
        countOnlineUsers(ctx),
      ]);

    // If counters are missing, we return zeros but log a warning
    let status: "partial" | "healthy" = "healthy";
    if (!lotCounter || !profileCounter || !watchlistCounter) {
      console.warn(
        "Admin stats: Some counters are missing. Run initializeCounters."
      );
      status = "partial";
    }

    return {
      totalLots: lotCounter?.total ?? 0,
      activeLots: lotCounter?.active ?? 0,
      pendingReview: lotCounter?.pending ?? 0,
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
};

/**
 * Core admin dashboard statistics.
 */
export const getAdminStats = query({
  args: {},
  returns: v.object({
    totalLots: v.number(),
    activeLots: v.number(),
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
