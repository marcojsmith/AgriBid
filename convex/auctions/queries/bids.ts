import { v } from "convex/values";

import {
  paginationOptsValidator,
  query,
  type QueryCtx,
  LotSummaryValidator,
  calculateUserBidStats,
  getAuthenticatedUserId,
  unauthenticatedPaginatedResult,
  type PaginationOptions,
} from "./shared";
import type { Doc, Id } from "../../_generated/dataModel";
import { BidValidator, toLotSummary } from "../helpers";
import { countQuery } from "../../admin_utils";
import { getAuthenticatedProfile } from "../../lib/auth";

/**
 * Returns paginated bids for a lot with bidder names.
 * Hides real bidder names unless user is admin or seller.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.lotId - The lot ID to fetch bids for
 * @param args.paginationOpts - Pagination options
 * @returns Paginated bids with bidder names
 */
export const getLotBidsHandler = async (
  ctx: QueryCtx,
  args: {
    lotId: Id<"lots">;
    paginationOpts: PaginationOptions;
  }
) => {
  const bidsQuery = ctx.db
    .query("bids")
    .withIndex("by_lot", (q) => q.eq("lotId", args.lotId));

  const [bidsResult, totalCount] = await Promise.all([
    bidsQuery.order("desc").paginate(args.paginationOpts),
    countQuery(
      ctx.db
        .query("bids")
        .withIndex("by_lot", (q) => q.eq("lotId", args.lotId))
    ),
  ]);

  const bids = bidsResult.page;

  const uniqueBidderIds = Array.from(
    new Set(bids.map((b: Doc<"bids">) => b.bidderId))
  );
  const bidderNames = new Map<string, string>();

  const lot = await ctx.db.get("lots", args.lotId);
  const auth = await getAuthenticatedProfile(ctx);
  const isAdmin = auth?.profile?.role === "admin";
  // Guard against undefined === undefined: a missing lot doc combined
  // with an unauthenticated caller must never mark the caller as the seller.
  const isSeller = Boolean(lot && lot.sellerId === auth?.userId);

  await Promise.all(
    uniqueBidderIds.map(async (bidderId) => {
      if (!bidderId) {
        bidderNames.set(bidderId, "Anonymous");
        return;
      }

      if (!isAdmin && !isSeller) {
        bidderNames.set(bidderId, "Bidder");
        return;
      }

      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", bidderId))
        .unique();

      if (profile) {
        bidderNames.set(bidderId, profile.name ?? "Anonymous");
      } else {
        bidderNames.set(bidderId, "Anonymous");
      }
    })
  );

  const page = bids.map((bid: Doc<"bids">) => ({
    ...bid,
    bidderName: bidderNames.get(bid.bidderId) ?? "Anonymous",
  }));

  return {
    ...bidsResult,
    page,
    totalCount,
  };
};

/**
 * Query: Get paginated lot bids with bidder names.
 * Args: lotId, paginationOpts
 *
 * @returns Paginated bids with bidder names
 */
export const getLotBids = query({
  args: {
    lotId: v.id("lots"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(BidValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRequired"),
        v.literal("SplitRecommended"),
        v.null()
      )
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: getLotBidsHandler,
});

/**
 * Returns the total bid count for a lot.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.lotId - The lot ID
 * @returns The bid count
 */
export const getLotBidCountHandler = async (
  ctx: QueryCtx,
  args: { lotId: Id<"lots"> }
) => {
  return await countQuery(
    ctx.db
      .query("bids")
      .withIndex("by_lot", (q) => q.eq("lotId", args.lotId))
  );
};

/**
 * Query: Get lot bid count.
 * Args: lotId
 *
 * @returns The bid count
 */
export const getLotBidCount = query({
  args: { lotId: v.id("lots") },
  returns: v.number(),
  handler: getLotBidCountHandler,
});

/**
 * Returns paginated list of lots the current user has bid on with bid stats.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.paginationOpts - Pagination options
 * @param args.sort - Sort order (recent or ending)
 * @returns Paginated user bids with lot details
 */
export const getMyBidsHandler = async (
  ctx: QueryCtx,
  args: {
    paginationOpts: PaginationOptions;
    sort?: string;
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) return { ...unauthenticatedPaginatedResult(), page: [] };

  const { auctionStatsMap, auctionsMap } = await calculateUserBidStats(
    ctx,
    userId
  );

  const allAuctionSummaries = await Promise.all(
    Array.from(auctionStatsMap.entries()).map(async ([lotId, stats]) => {
      const lot = auctionsMap.get(lotId);
      if (!lot) return null;

      const summary = await toLotSummary(ctx, lot);
      const isWinning =
        lot.status === "assigned" &&
        stats.highestBid === lot.currentPrice &&
        lot.winnerId === userId;

      return {
        ...summary,
        myHighestBid: stats.highestBid,
        isWinning,
        isWon: lot.status === "sold" && lot.winnerId === userId,
        isOutbid: lot.status === "assigned" && !isWinning,
        isCancelled: lot.status === "rejected",
        bidAmount: stats.highestBid,
        bidTimestamp: stats.lastBidTimestamp,
        lastBidTimestamp: stats.lastBidTimestamp,
        bidCount: stats.bidCount,
      };
    })
  );

  const validAuctions = allAuctionSummaries.filter(
    (a): a is NonNullable<typeof a> => a !== null
  );

  const sortBy = args.sort ?? "recent";
  validAuctions.sort((a, b) => {
    if (sortBy === "ending") {
      const timeA =
        a.extendedEndTime ?? a.auctionEndTime ?? Number.MAX_SAFE_INTEGER;
      const timeB =
        b.extendedEndTime ?? b.auctionEndTime ?? Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    }
    return b.lastBidTimestamp - a.lastBidTimestamp;
  });

  const totalCount = validAuctions.length;
  const numItems = args.paginationOpts.numItems;

  let startIndex = 0;
  if (args.paginationOpts.cursor) {
    const parsed = parseInt(args.paginationOpts.cursor, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      startIndex = Math.min(parsed, totalCount);
    }
  }

  const page = validAuctions.slice(startIndex, startIndex + numItems);
  const isDone = startIndex + numItems >= totalCount;
  const continueCursor = isDone ? "" : (startIndex + numItems).toString();

  return {
    page,
    isDone,
    continueCursor,
    totalCount,
    pageStatus: null,
    splitCursor: null,
  };
};

/**
 * Query: Get user's bid history with lot details.
 * Args: paginationOpts, sort (recent|ending)
 *
 * @returns Paginated bid results
 */
export const getMyBids = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sort: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        ...LotSummaryValidator.fields,
        myHighestBid: v.number(),
        isWinning: v.boolean(),
        isWon: v.boolean(),
        isOutbid: v.boolean(),
        isCancelled: v.boolean(),
        bidAmount: v.number(),
        bidTimestamp: v.number(),
        lastBidTimestamp: v.number(),
        bidCount: v.number(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRequired"),
        v.literal("SplitRecommended"),
        v.null()
      )
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: getMyBidsHandler,
});

/**
 * Returns the total number of active auctions the user has bid on.
 *
 * @param ctx - Convex Query context
 * @returns The bid count
 */
export const getMyBidsCountHandler = async (ctx: QueryCtx) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) return 0;

  const { auctionStatsMap } = await calculateUserBidStats(ctx, userId);
  return auctionStatsMap.size;
};

/**
 * Query: Get user's bid count.
 * Args: (none)
 *
 * @returns The bid count
 */
export const getMyBidsCount = query({
  args: {},
  returns: v.number(),
  handler: getMyBidsCountHandler,
});

/**
 * Returns global bid statistics for the current user (winning, outbid, exposure).
 *
 * @param ctx - Convex Query context
 * @returns User bid statistics
 */
export const getMyBidsStatsHandler = async (ctx: QueryCtx) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId)
    return {
      totalActive: 0,
      winningCount: 0,
      outbidCount: 0,
      totalExposure: 0,
    };

  const { globalStats } = await calculateUserBidStats(ctx, userId);
  return globalStats;
};

/**
 * Query: Get user's bid statistics.
 * Args: (none)
 *
 * @returns User bid statistics
 */
export const getMyBidsStats = query({
  args: {},
  returns: v.object({
    totalActive: v.number(),
    winningCount: v.number(),
    outbidCount: v.number(),
    totalExposure: v.number(),
  }),
  handler: getMyBidsStatsHandler,
});
