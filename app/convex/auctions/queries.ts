/**
 * Computes bid statistics for a given user.
 *
 * @param ctx - The query context used to execute database operations.
 * @param userId - The ID of the user to analyze.
 * @returns A Promise that resolves to a CalculateUserBidStatsResult detailing the user's bidding activity.
 */
async function calculateUserBidStats(
  ctx: QueryCtx,
  userId: string
): Promise<CalculateUserBidStatsResult> {
  const allUserBids = await ctx.db
    .query("bids")
    .withIndex("by_bidder", (q) => q.eq("bidderId", userId))
    .filter((q) => q.neq(q.field("status"), "voided"))
    .collect();

  const auctionStatsMap = new Map<string, AuctionBidStats>();

  for (const bid of allUserBids) {
    const stats = auctionStatsMap.get(bid.auctionId) || {
      lastBidTimestamp: 0,
      highestBid: 0,
      bidCount: 0,
    };
    stats.bidCount++;
    if (bid.amount > stats.highestBid) {
      stats.highestBid = bid.amount;
    }
    if (bid.timestamp > stats.lastBidTimestamp) {
      stats.lastBidTimestamp = bid.timestamp;
    }
    auctionStatsMap.set(bid.auctionId, stats);
  }

  const globalStats: GlobalUserBidStats = {
    totalActive: 0,
    winningCount: 0,
    outbidCount: 0,
    totalExposure: 0,
  };
  const auctionIds = Array.from(auctionStatsMap.keys()) as Id<"auctions">[];
  const fullAuctions = await Promise.all(
    auctionIds.map((id) => ctx.db.get(id))
  );

  const auctionsMap = new Map<string, Doc<"auctions"> | null>();

  fullAuctions.forEach((auction: Doc<"auctions"> | null, index: number) => {
    auctionsMap.set(auctionIds[index], auction);
    if (!auction) return;
    const stats = auctionStatsMap.get(auctionIds[index])!;

    if (auction.status === "active") {
      globalStats.totalActive++;
      const isWinning =
        stats.highestBid === auction.currentPrice &&
        auction.winnerId === userId;
      if (isWinning) {
        globalStats.winningCount++;
        globalStats.totalExposure += stats.highestBid;
      } else {
        globalStats.outbidCount++;
      }
    }
  });

  return { globalStats, auctionStatsMap, auctionsMap };
}

const ZERO_AUCTION_STATS = {
  totalActive: 0,
  winningCount: 0,
  outbidCount: 0,
  totalExposure: 0,
};

import { v } from "convex/values";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { findUserById } from "../users";
import { authComponent } from "../auth";
import { requireAdmin, resolveUserId } from "../lib/auth";
import { getSetting } from "../admin/settings";
import * as constants from "../constants";
import type { Doc, Id } from "../_generated/dataModel";
import {
  AuctionSummaryValidator,
  toAuctionSummary,
  AuctionDetailValidator,
  toAuctionDetail,
  BidValidator,
} from "./helpers";
import { countQuery } from "../admin_utils";

/**
 * Represents the possible status values for an auction.
 */
type AuctionStatus = "active" | "sold" | "unsold";

/**
 * Represents the filter options for querying auctions by status.
 * - "active": Returns only active auctions
 * - "closed": Returns only closed auctions (sold or unsold)
 * - "all": Returns all auctions
 */
type StatusFilter = "active" | "closed" | "all";

/**
 * Maps a StatusFilter to the corresponding array of AuctionStatus values.
 * @param filter - The status filter ("active", "closed", or "all")
 * @returns An array of AuctionStatus values to query
 */
const statusesForFilter = (filter: StatusFilter): AuctionStatus[] => {
  if (filter === "active") return ["active"];
  if (filter === "closed") return ["sold", "unsold"];
  return ["active", "sold", "unsold"];
};

export const getPendingAuctions = query({
  args: {},
  returns: v.array(AuctionSummaryValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const auctions = await ctx.db
      .query("auctions")
      .withIndex("by_status", (q) => q.eq("status", "pending_review"))
      .collect();

    return await Promise.all(
      auctions.map((auction) => toAuctionSummary(ctx, auction))
    );
  },
});

export const getActiveAuctions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    make: v.optional(v.string()),
    minYear: v.optional(v.number()),
    maxYear: v.optional(v.number()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    maxHours: v.optional(v.number()),
    statusFilter: v.optional(
      v.union(v.literal("active"), v.literal("closed"), v.literal("all"))
    ),
  },
  returns: v.object({
    page: v.array(AuctionSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const statusFilter: StatusFilter = args.statusFilter ?? "active";
    const statuses = statusesForFilter(statusFilter);
    const auctionsQuery = ctx.db.query("auctions");
    let baseQuery;

    if (args.search) {
      baseQuery = auctionsQuery.withSearchIndex("search_title", (q) => {
        const sq = q.search("title", args.search!);
        if (statuses.length === 1) {
          return sq.eq("status", statuses[0]);
        }
        return sq;
      });
    } else if (args.make) {
      // Use by_status_make index if only one status, otherwise use global order
      if (statuses.length === 1) {
        baseQuery = auctionsQuery.withIndex("by_status_make", (q) =>
          q.eq("status", statuses[0]).eq("make", args.make!)
        );
      } else {
        baseQuery = auctionsQuery
          .order("desc")
          .filter((q) => q.eq(q.field("make"), args.make!));
      }
    } else if (args.minYear !== undefined || args.maxYear !== undefined) {
      // Use by_status_year index if only one status, otherwise fallback to global order
      if (statuses.length === 1) {
        baseQuery = auctionsQuery.withIndex("by_status_year", (q) => {
          const statusQuery = q.eq("status", statuses[0]);
          if (args.minYear !== undefined && args.maxYear !== undefined) {
            return statusQuery
              .gte("year", args.minYear)
              .lte("year", args.maxYear);
          }
          if (args.minYear !== undefined) {
            return statusQuery.gte("year", args.minYear);
          }
          if (args.maxYear !== undefined) {
            return statusQuery.lte("year", args.maxYear);
          }
          return statusQuery;
        });
      } else {
        baseQuery = auctionsQuery.order("desc");
      }
    } else {
      // Default listing: use by_status if single status
      if (statuses.length === 1) {
        baseQuery = auctionsQuery
          .withIndex("by_status", (q) => q.eq("status", statuses[0]))
          .order("desc");
      } else {
        baseQuery = auctionsQuery.order("desc");
      }
    }

    // Apply all other filters (including status if multiple)
    // Note: Search index queries do not support .filter()
    if (args.search) {
      const results = await baseQuery.paginate(args.paginationOpts);

      // Manual filtering for search results (may result in smaller pages)
      const filteredPage = results.page.filter((a) => {
        if (!statuses.includes(a.status as AuctionStatus)) return false;
        if (args.make && a.make !== args.make) return false;
        if (args.minYear !== undefined && a.year < args.minYear) return false;
        if (args.maxYear !== undefined && a.year > args.maxYear) return false;
        if (args.minPrice !== undefined && a.currentPrice < args.minPrice)
          return false;
        if (args.maxPrice !== undefined && a.currentPrice > args.maxPrice)
          return false;
        if (args.maxHours !== undefined && a.operatingHours > args.maxHours)
          return false;
        return true;
      });

      const page = await Promise.all(
        filteredPage.map((auction) => toAuctionSummary(ctx, auction))
      );

      return {
        ...results,
        page,
      };
    }

    // For non-search queries, use efficient .filter() before pagination
    const results = await baseQuery
      .filter((q) => {
        const expressions = [];

        // Status filter: if multiple statuses, or if we didn't use a status index
        if (statuses.length > 1) {
          expressions.push(
            q.or(...statuses.map((s) => q.eq(q.field("status"), s)))
          );
        }

        if (args.make !== undefined && statuses.length > 1) {
          expressions.push(q.eq(q.field("make"), args.make));
        }

        if (args.minYear !== undefined)
          expressions.push(q.gte(q.field("year"), args.minYear));
        if (args.maxYear !== undefined)
          expressions.push(q.lte(q.field("year"), args.maxYear));
        if (args.minPrice !== undefined)
          expressions.push(q.gte(q.field("currentPrice"), args.minPrice));
        if (args.maxPrice !== undefined)
          expressions.push(q.lte(q.field("currentPrice"), args.maxPrice));
        if (args.maxHours !== undefined)
          expressions.push(q.lte(q.field("operatingHours"), args.maxHours));

        return expressions.length > 0 ? q.and(...expressions) : true;
      })
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      results.page.map((auction) => toAuctionSummary(ctx, auction))
    );

    return {
      ...results,
      page,
    };
  },
});

export const getActiveMakes = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const limit = await getSetting(
      ctx,
      "max_results_cap",
      constants.MAX_RESULTS_CAP
    );
    const metadata = await ctx.db.query("equipmentMetadata").take(limit);
    const makes = Array.from(new Set(metadata.map((m) => m.make))).sort();
    return makes;
  },
});

export const getAuctionById = query({
  args: { auctionId: v.id("auctions") },
  returns: v.union(v.null(), AuctionDetailValidator),
  handler: async (ctx, args) => {
    const auction = await ctx.db.get(args.auctionId);
    if (!auction) return null;

    return await toAuctionDetail(ctx, auction);
  },
});

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
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
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

    // Minimum length for a valid Convex ID is 10 characters. IDs shorter than
    // this are malformed or legacy data and should be treated as anonymous.
    const MIN_VALID_BIDDER_ID_LENGTH = 10;
    // Sentinel key for falsy bidderId values (null, empty string) to avoid
    // using them as map keys which can cause issues with retrieval.
    const ANONYMOUS_KEY = "anonymous";

    const uniqueBidderIds = Array.from(
      new Set(bids.map((b: Doc<"bids">) => b.bidderId))
    );
    const bidderNames = new Map<string, string>();

    await Promise.all(
      uniqueBidderIds.map(async (bidderId) => {
        const mapKey = (bidderId as string) || ANONYMOUS_KEY;

        if (
          !bidderId ||
          (bidderId as string).length < MIN_VALID_BIDDER_ID_LENGTH
        ) {
          bidderNames.set(mapKey as string, "Anonymous");
          return;
        }
        const user = await findUserById(ctx, bidderId as string);

        if (user) {
          bidderNames.set(mapKey as string, user.name ?? "Anonymous");
        } else {
          bidderNames.set(mapKey as string, "Anonymous");
        }
      })
    );

    const page = bids.map((bid: Doc<"bids">) => ({
      ...bid,
      bidderName: bidderNames.get(bid.bidderId || ANONYMOUS_KEY) || "Anonymous",
    }));

    return {
      ...bidsResult,
      page,
      totalCount,
    };
  },
});

/**
 * Retrieve the total number of bids for a specific auction.
 *
 * @param auctionId - The ID of the auction
 * @returns The total number of bids
 */
export const getAuctionBidCount = query({
  args: { auctionId: v.id("auctions") },
  returns: v.number(),
  handler: async (ctx, args) => {
    return await countQuery(
      ctx.db
        .query("bids")
        .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
    );
  },
});

export const getEquipmentMetadata = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("equipmentMetadata"),
        _creationTime: v.number(),
        make: v.string(),
        models: v.array(v.string()),
        category: v.string(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const metadataQuery = ctx.db.query("equipmentMetadata");
    const [results, totalCount] = await Promise.all([
      metadataQuery.paginate(args.paginationOpts),
      countQuery(ctx.db.query("equipmentMetadata")),
    ]);
    return {
      ...results,
      totalCount,
    };
  },
});

export const getSellerInfo = query({
  args: { sellerId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      name: v.optional(v.string()),
      isVerified: v.boolean(),
      role: v.string(),
      createdAt: v.optional(v.number()),
      itemsSold: v.number(),
      totalListings: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await findUserById(ctx, args.sellerId);

    if (!user) return null;

    const linkId = resolveUserId(user);
    if (!linkId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", linkId))
      .unique();
    const [soldAuctions, allListings] = await Promise.all([
      countQuery(
        ctx.db
          .query("auctions")
          .withIndex("by_seller_status", (q) =>
            q.eq("sellerId", linkId).eq("status", "sold")
          )
      ),
      countQuery(
        ctx.db
          .query("auctions")
          .withIndex("by_seller", (q) => q.eq("sellerId", linkId))
      ),
    ]);

    return {
      name: user.name,
      isVerified: profile?.isVerified || false,
      role: profile?.role || "Private Seller",
      createdAt: user.createdAt,
      itemsSold: soldAuctions,
      totalListings: allListings,
    };
  },
});

export const getSellerListings = query({
  args: { userId: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(AuctionSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const listingsQuery = ctx.db
      .query("auctions")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.userId))
      .filter((q) =>
        q.or(q.eq(q.field("status"), "active"), q.eq(q.field("status"), "sold"))
      );

    const [results, totalCount] = await Promise.all([
      listingsQuery.paginate(args.paginationOpts),
      countQuery(
        ctx.db
          .query("auctions")
          .withIndex("by_seller", (q) => q.eq("sellerId", args.userId))
          .filter((q) =>
            q.or(
              q.eq(q.field("status"), "active"),
              q.eq(q.field("status"), "sold")
            )
          )
      ),
    ]);

    const page = await Promise.all(
      results.page.map(
        async (auction: Doc<"auctions">) => await toAuctionSummary(ctx, auction)
      )
    );

    return {
      ...results,
      page,
      totalCount,
    };
  },
});

export const getAllAuctions = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(AuctionSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const auctionsQuery = ctx.db.query("auctions");
    const [auctionsResult, totalCount] = await Promise.all([
      auctionsQuery.order("desc").paginate(args.paginationOpts),
      countQuery(ctx.db.query("auctions")),
    ]);

    return {
      ...auctionsResult,
      totalCount,
      page: await Promise.all(
        auctionsResult.page.map(
          async (auction: Doc<"auctions">) =>
            await toAuctionSummary(ctx, auction)
        )
      ),
    };
  },
});

export const getMyBids = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        ...AuctionSummaryValidator.fields,
        myHighestBid: v.number(),
        isWinning: v.boolean(),
        isWon: v.boolean(),
        bidAmount: v.number(),
        bidTimestamp: v.number(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser)
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          totalCount: 0,
          pageStatus: null,
          splitCursor: null,
        };
      const linkId = resolveUserId(authUser);
      if (!linkId)
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          totalCount: 0,
          pageStatus: null,
          splitCursor: null,
        };

      const bidsQuery = ctx.db
        .query("bids")
        .withIndex("by_bidder", (q) => q.eq("bidderId", linkId))
        // exclude voided bids from results
        .filter((q) => q.neq(q.field("status"), "voided"));

      const [bidsResult, totalCount] = await Promise.all([
        bidsQuery.order("desc").paginate(args.paginationOpts),
        countQuery(
          ctx.db
            .query("bids")
            .withIndex("by_bidder", (q) => q.eq("bidderId", linkId))
            .filter((q) => q.neq(q.field("status"), "voided"))
        ),
      ]);

      const uniqueAuctionIds = Array.from(
        new Set(bidsResult.page.map((bid: Doc<"bids">) => bid.auctionId))
      );

      const bidsByAuction = new Map<string, number>();
      const auctionStatsMap = new Map<
        string,
        { bidCount: number; lastBidTimestamp: number }
      >();

      await Promise.all(
        uniqueAuctionIds.map(async (auctionId) => {
          const [latestUserBid, lastBid, bidCount] = await Promise.all([
            ctx.db
              .query("bids")
              .withIndex("by_auction", (q) =>
                q.eq("auctionId", auctionId as Id<"auctions">)
              )
              .filter((q) => q.neq(q.field("status"), "voided"))
              .filter((q) => q.eq(q.field("bidderId"), linkId))
              .order("desc")
              .first(),
            ctx.db
              .query("bids")
              .withIndex("by_auction", (q) =>
                q.eq("auctionId", auctionId as Id<"auctions">)
              )
              .filter((q) => q.neq(q.field("status"), "voided"))
              .order("desc")
              .first(),
            countQuery(
              ctx.db
                .query("bids")
                .withIndex("by_auction", (q) =>
                  q.eq("auctionId", auctionId as Id<"auctions">)
                )
                .filter((q) => q.neq(q.field("status"), "voided"))
            ),
          ]);

          bidsByAuction.set(auctionId as string, latestUserBid?.amount || 0);
          auctionStatsMap.set(auctionId as string, {
            bidCount,
            lastBidTimestamp: lastBid?.timestamp || 0,
          });
        })
      );

      const page = await Promise.all(
        bidsResult.page.map(async (bid: Doc<"bids">) => {
          const auction = await ctx.db.get(bid.auctionId);
          if (!auction) return null;

          const summary = await toAuctionSummary(ctx, auction);
          const myHighestBid = bidsByAuction.get(auction._id) || 0;
          const stats = auctionStatsMap.get(auction._id) || {
            bidCount: 1,
            lastBidTimestamp: bid.timestamp,
          };
          const isWinning =
            auction.status === "active" &&
            myHighestBid === auction.currentPrice &&
            auction.winnerId === linkId;

          return {
            ...summary,
            myHighestBid,
            isWinning,
            isWon: auction.status === "sold" && auction.winnerId === linkId,
            isOutbid: auction.status === "active" && !isWinning,
            isCancelled: auction.status === "rejected",
            bidAmount: bid.amount,
            bidTimestamp: bid.timestamp,
            lastBidTimestamp: stats.lastBidTimestamp,
            bidCount: stats.bidCount,
          };
        })
      );

      return {
        ...bidsResult,
        page: page.flatMap((a) => (a ? [a] : [])),
        totalCount,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes("Unauthenticated")) {
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          totalCount: 0,
          pageStatus: null,
          splitCursor: null,
        };
      }
      console.error("getMyBids failure:", err);
      throw err;
    }
  },
});

export const getMyListings = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(AuctionSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser)
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          totalCount: 0,
          pageStatus: null,
          splitCursor: null,
        };
      const linkId = resolveUserId(authUser);
      if (!linkId)
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          totalCount: 0,
          pageStatus: null,
          splitCursor: null,
        };

      const listingsQuery = ctx.db
        .query("auctions")
        .withIndex("by_seller", (q) => q.eq("sellerId", linkId));

      const [listingsResult, totalCount] = await Promise.all([
        listingsQuery.paginate(args.paginationOpts),
        countQuery(
          ctx.db
            .query("auctions")
            .withIndex("by_seller", (q) => q.eq("sellerId", linkId))
        ),
      ]);

      const page = await Promise.all(
        listingsResult.page.map(
          async (auction: Doc<"auctions">) =>
            await toAuctionSummary(ctx, auction)
        )
      );

      return {
        ...listingsResult,
        page,
        totalCount,
      };
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("getMyListings failure:", err);
      }
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        totalCount: 0,
        pageStatus: null,
        splitCursor: null,
      };
    }
  },
});

/**
 * Get the total number of listings for the authenticated user.
 *
 * @returns The total number of listings
 */
export const getMyListingsCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return 0;
      const userId = resolveUserId(authUser);
      if (!userId) return 0;

      return await countQuery(
        ctx.db
          .query("auctions")
          .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      );
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("getMyListingsCount failure:", err);
      }
      return 0;
    }
  },
});

/**
 * Get the total number of non-voided bids placed by the authenticated user.
 *
 * @returns The total number of non-voided bids
 */
export const getMyBidsCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return 0;
      const userId = resolveUserId(authUser);
      if (!userId) return 0;

      return await countQuery(
        ctx.db
          .query("bids")
          .withIndex("by_bidder", (q) => q.eq("bidderId", userId))
          .filter((q) => q.neq(q.field("status"), "voided"))
      );
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("getMyBidsCount failure:", err);
      }
      return 0;
    }
  },
});

export const getMyBidsStats = query({
  args: {},
  returns: v.object({
    totalActive: v.number(),
    winningCount: v.number(),
    outbidCount: v.number(),
    totalExposure: v.number(),
  }),
  handler: async (ctx) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return ZERO_AUCTION_STATS;

      const userId = resolveUserId(authUser);
      if (!userId) return ZERO_AUCTION_STATS;

      const { globalStats } = await calculateUserBidStats(ctx, userId);
      return globalStats;
    } catch (err) {
      console.error("getMyBidsStats failure:", err);
      return ZERO_AUCTION_STATS;
    }
  },
});

export const getAuctionFlags = query({
  args: { auctionId: v.id("auctions") },
  returns: v.array(
    v.object({
      _id: v.id("auctionFlags"),
      _creationTime: v.number(),
      auctionId: v.id("auctions"),
      reporterId: v.string(),
      reason: v.union(
        v.literal("misleading"),
        v.literal("inappropriate"),
        v.literal("suspicious"),
        v.literal("other")
      ),
      details: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("reviewed"),
        v.literal("dismissed")
      ),
      createdAt: v.number(),
      reporterName: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const flags = await ctx.db
      .query("auctionFlags")
      .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
      .order("desc")
      .collect();

    const uniqueReporterIds = Array.from(
      new Set(flags.map((f) => f.reporterId))
    );
    const reporterNames = new Map<string, string>();

    await Promise.all(
      uniqueReporterIds.map(async (reporterId) => {
        const user = await findUserById(ctx, reporterId);
        reporterNames.set(reporterId, user?.name ?? "Unknown User");
      })
    );

    return flags.map((flag) => ({
      ...flag,
      reporterName: reporterNames.get(flag.reporterId) ?? "Unknown User",
    }));
  },
});

export const getAllPendingFlags = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("auctionFlags"),
      _creationTime: v.number(),
      auctionId: v.id("auctions"),
      reporterId: v.string(),
      reason: v.union(
        v.literal("misleading"),
        v.literal("inappropriate"),
        v.literal("suspicious"),
        v.literal("other")
      ),
      details: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("reviewed"),
        v.literal("dismissed")
      ),
      createdAt: v.number(),
      auctionTitle: v.string(),
      reporterName: v.string(),
    })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const flags = await ctx.db
      .query("auctionFlags")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    const uniqueAuctionIds = Array.from(new Set(flags.map((f) => f.auctionId)));
    const auctionTitles = new Map<string, string>();
    const uniqueReporterIds = Array.from(
      new Set(flags.map((f) => f.reporterId))
    );
    const reporterNames = new Map<string, string>();

    await Promise.all([
      ...uniqueAuctionIds.map(async (auctionId) => {
        const auction = await ctx.db.get(auctionId);
        auctionTitles.set(auctionId, auction?.title ?? "Unknown Auction");
      }),
      ...uniqueReporterIds.map(async (reporterId) => {
        const user = await findUserById(ctx, reporterId);
        reporterNames.set(reporterId, user?.name ?? "Unknown User");
      }),
    ]);

    return flags.map((flag) => ({
      ...flag,
      auctionTitle: auctionTitles.get(flag.auctionId) ?? "Unknown Auction",
      reporterName: reporterNames.get(flag.reporterId) ?? "Unknown User",
    }));
  },
});

export interface CalculateUserBidStatsResult {
  globalStats: GlobalUserBidStats;
  auctionStatsMap: Map<string, AuctionBidStats>;
  auctionsMap: Map<string, Doc<"auctions"> | null>;
}

export interface AuctionBidStats {
  lastBidTimestamp: number;
  highestBid: number;
  bidCount: number;
}

export interface GlobalUserBidStats {
  totalActive: number;
  winningCount: number;
  outbidCount: number;
  totalExposure: number;
}
