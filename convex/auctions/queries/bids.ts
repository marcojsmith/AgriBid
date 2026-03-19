import { v } from "convex/values";

import {
  paginationOptsValidator,
  query,
  type QueryCtx,
  AuctionSummaryValidator,
  calculateUserBidStats,
  getAuthenticatedUserId,
  unauthenticatedPaginatedResult,
  type PaginationOptions,
} from "./shared";
import type { Doc, Id } from "../../_generated/dataModel";
import { BidValidator, toAuctionSummary } from "../helpers";
import { findUserById } from "../../users";
import { countQuery } from "../../admin_utils";
import { getAuthenticatedProfile } from "../../lib/auth";

/**
 * Returns paginated bids for an auction with bidder names.
 * Hides real bidder names unless user is admin or seller.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.auctionId - The auction ID to fetch bids for
 * @param args.paginationOpts - Pagination options
 * @returns Paginated bids with bidder names
 */
export const getAuctionBidsHandler = async (
  ctx: QueryCtx,
  args: {
    auctionId: Id<"auctions">;
    paginationOpts: PaginationOptions;
  }
) => {
  const bidsQuery = ctx.db
    .query("bids")
    .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId));

  const [bidsResult, totalCount] = await Promise.all([
    bidsQuery.order("desc").paginate(args.paginationOpts),
    countQuery(
      ctx.db
        .query("bids")
        .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
    ),
  ]);

  const bids = bidsResult.page;

  const MIN_VALID_BIDDER_ID_LENGTH = 10;
  const ANONYMOUS_KEY = "anonymous";

  const uniqueBidderIds = Array.from(
    new Set(bids.map((b: Doc<"bids">) => b.bidderId))
  );
  const bidderNames = new Map<string, string>();

  const auction = await ctx.db.get(args.auctionId);
  const auth = await getAuthenticatedProfile(ctx);
  const isAdmin = auth?.profile?.role === "admin";
  const isSeller = auction?.sellerId === auth?.userId;

  await Promise.all(
    uniqueBidderIds.map(async (bidderId) => {
      const mapKey = bidderId || ANONYMOUS_KEY;

      if (!bidderId || bidderId.length < MIN_VALID_BIDDER_ID_LENGTH) {
        bidderNames.set(mapKey, "Anonymous");
        return;
      }

      if (!isAdmin && !isSeller) {
        bidderNames.set(mapKey, "Bidder");
        return;
      }

      const user = await findUserById(ctx, bidderId);

      if (user) {
        bidderNames.set(mapKey, user.name ?? "Anonymous");
      } else {
        bidderNames.set(mapKey, "Anonymous");
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
 * Query: Get paginated auction bids with bidder names.
 * Args: auctionId, paginationOpts
 *
 * @returns Paginated bids with bidder names
 */
export const getAuctionBids = query({
  args: {
    auctionId: v.id("auctions"),
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
  handler: getAuctionBidsHandler,
});

/**
 * Returns the total bid count for an auction.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.auctionId - The auction ID
 * @returns The bid count
 */
export const getAuctionBidCountHandler = async (
  ctx: QueryCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  return await countQuery(
    ctx.db
      .query("bids")
      .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
  );
};

/**
 * Query: Get auction bid count.
 * Args: auctionId
 *
 * @returns The bid count
 */
export const getAuctionBidCount = query({
  args: { auctionId: v.id("auctions") },
  returns: v.number(),
  handler: getAuctionBidCountHandler,
});

/**
 * Returns paginated list of auctions the current user has bid on with bid stats.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.paginationOpts - Pagination options
 * @param args.sort - Sort order (recent or ending)
 * @returns Paginated user bids with auction details
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
    Array.from(auctionStatsMap.entries()).map(async ([auctionId, stats]) => {
      const auction = auctionsMap.get(auctionId);
      if (!auction) return null;

      const summary = await toAuctionSummary(ctx, auction);
      const isWinning =
        auction.status === "active" &&
        stats.highestBid === auction.currentPrice &&
        auction.winnerId === userId;

      return {
        ...summary,
        myHighestBid: stats.highestBid,
        isWinning,
        isWon: auction.status === "sold" && auction.winnerId === userId,
        isOutbid: auction.status === "active" && !isWinning,
        isCancelled: auction.status === "rejected",
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
      const timeA = a.endTime ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.endTime ?? Number.MAX_SAFE_INTEGER;
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
 * Query: Get user's bid history with auction details.
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
        ...AuctionSummaryValidator.fields,
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
