import { v } from "convex/values";
import { paginationOptsValidator, type PaginationOptions } from "convex/server";

import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { findUserById } from "../users";
import { authComponent } from "../auth";
import {
  requireAdmin,
  resolveUserId,
  getAuthenticatedProfile,
} from "../lib/auth";
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
 * Statistics for bids within a specific auction.
 */
export interface AuctionBidStats {
  lastBidTimestamp: number;
  highestBid: number;
  bidCount: number;
}

/**
 * Aggregated bidding statistics for a user across all active auctions.
 */
export interface GlobalUserBidStats {
  totalActive: number;
  winningCount: number;
  outbidCount: number;
  totalExposure: number;
}

/**
 * Result of the internal bid statistics calculation.
 */
export interface CalculateUserBidStatsResult {
  globalStats: GlobalUserBidStats;
  auctionStatsMap: Map<string, AuctionBidStats>;
  auctionsMap: Map<string, Doc<"auctions"> | null>;
}

/**
 * Zeroed-out initial state for auction statistics.
 */
const ZERO_AUCTION_STATS = {
  totalActive: 0,
  winningCount: 0,
  outbidCount: 0,
  totalExposure: 0,
};

/**
 * Computes bid statistics for a given user.
 *
 * Scans all non-voided bids by the user to determine their highest bid and activity status
 * across all participating auctions.
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

  // Fetch auctions in batches to avoid large Promise.all spikes
  const CHUNK_SIZE = 100;
  const fullAuctions: (Doc<"auctions"> | null)[] = [];

  for (let i = 0; i < auctionIds.length; i += CHUNK_SIZE) {
    const chunk = auctionIds.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(chunk.map((id) => ctx.db.get(id)));
    fullAuctions.push(...chunkResults);
  }

  const auctionsMap = new Map<string, Doc<"auctions"> | null>();

  fullAuctions.forEach((auction: Doc<"auctions"> | null, index: number) => {
    auctionsMap.set(auctionIds[index]!, auction);
    if (!auction) return;
    const stats = auctionStatsMap.get(auctionIds[index]!)!;

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

/**
 * Handler for retrieving pending auctions.
 * @param ctx
 * @returns Promise<AuctionSummary[]>
 */
export const getPendingAuctionsHandler = async (ctx: QueryCtx) => {
  await requireAdmin(ctx);

  const auctions = await ctx.db
    .query("auctions")
    .withIndex("by_status", (q) => q.eq("status", "pending_review"))
    .collect();

  return await Promise.all(
    auctions.map((auction) => toAuctionSummary(ctx, auction))
  );
};

/**
 * Retrieve a list of auctions currently pending admin review.
 *
 * Only accessible to admin users.
 */
export const getPendingAuctions = query({
  args: {},
  returns: v.array(AuctionSummaryValidator),
  handler: getPendingAuctionsHandler,
});

/**
 * Handler for advanced search and filter for auctions.
 * @param ctx
 * @param args
 * @param args.paginationOpts
 * @param args.search
 * @param args.make
 * @param args.minYear
 * @param args.maxYear
 * @param args.minPrice
 * @param args.maxPrice
 * @param args.maxHours
 * @param args.statusFilter
 * @returns Promise<PaginatedAuctions>
 */
export const getActiveAuctionsHandler = async (
  ctx: QueryCtx,
  args: {
    paginationOpts: PaginationOptions;
    search?: string;
    make?: string;
    minYear?: number;
    maxYear?: number;
    minPrice?: number;
    maxPrice?: number;
    maxHours?: number;
    statusFilter?: "active" | "closed" | "all";
  }
) => {
  const statusFilter: StatusFilter =
    (args.statusFilter as StatusFilter) ?? "active";
  const statuses = statusesForFilter(statusFilter);

  /**
   * Predicate to check if an auction matches the filter arguments.
   * @param a - Auction document to check
   * @returns True if the auction matches all filters
   */
  const matchesAuctionFilter = (a: Doc<"auctions">) => {
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
  };

  // Helper to construct the base query with index selection
  const getBaseQuery = () => {
    const auctionsQuery = ctx.db.query("auctions");

    if (args.search) {
      if (statuses.length === 1) {
        return auctionsQuery.withSearchIndex("search_title", (q) =>
          q.search("title", args.search!).eq("status", statuses[0]!)
        );
      }
      return auctionsQuery.withSearchIndex("search_title_simple", (q) =>
        q.search("title", args.search!)
      );
    }

    if (args.make) {
      if (statuses.length === 1) {
        return auctionsQuery.withIndex("by_status_make", (q) =>
          q.eq("status", statuses[0]!).eq("make", args.make!)
        );
      }
      return auctionsQuery
        .order("desc")
        .filter((q) => q.eq(q.field("make"), args.make!));
    }

    if (args.minYear !== undefined || args.maxYear !== undefined) {
      if (statuses.length === 1) {
        return auctionsQuery.withIndex("by_status_year", (q) => {
          if (args.minYear !== undefined && args.maxYear !== undefined) {
            return q
              .eq("status", statuses[0]!)
              .gte("year", args.minYear)
              .lte("year", args.maxYear);
          }
          if (args.minYear !== undefined) {
            return q.eq("status", statuses[0]!).gte("year", args.minYear);
          }
          // maxYear must be defined if we got here
          return q.eq("status", statuses[0]!).lte("year", args.maxYear!);
        });
      }
      return auctionsQuery.order("desc");
    }

    // Default listing
    if (statuses.length === 1) {
      return auctionsQuery
        .withIndex("by_status", (q) => q.eq("status", statuses[0]!))
        .order("desc");
    }
    return auctionsQuery.order("desc");
  };

  // Helper to apply filters and return a fresh query instance
  const getFilteredQuery = () => {
    const q = getBaseQuery();

    // Search index queries do not support .filter()
    if (args.search) return q;

    return q.filter((f) => {
      const expressions = [];

      // Status filter: if multiple statuses, or if we didn't use a status index
      if (statuses.length > 1) {
        expressions.push(
          f.or(...statuses.map((s) => f.eq(f.field("status"), s)))
        );
      }

      // Always apply make filter if provided and not already covered by the index
      if (args.make !== undefined) {
        expressions.push(f.eq(f.field("make"), args.make));
      }

      if (args.minYear !== undefined)
        expressions.push(f.gte(f.field("year"), args.minYear));
      if (args.maxYear !== undefined)
        expressions.push(f.lte(f.field("year"), args.maxYear));
      if (args.minPrice !== undefined)
        expressions.push(f.gte(f.field("currentPrice"), args.minPrice));
      if (args.maxPrice !== undefined)
        expressions.push(f.lte(f.field("currentPrice"), args.maxPrice));
      if (args.maxHours !== undefined)
        expressions.push(f.lte(f.field("operatingHours"), args.maxHours));

      return expressions.length > 0 ? f.and(...expressions) : true;
    });
  };

  if (args.search) {
    const results = await getFilteredQuery().paginate(args.paginationOpts);

    // Manual filtering for search results (may result in smaller pages)
    const filteredPage = results.page.filter(matchesAuctionFilter);

    const page = await Promise.all(
      filteredPage.map((auction) => toAuctionSummary(ctx, auction))
    );

    // Total count for search results can be expensive
    // We implement a capped count to avoid OOM for very large result sets
    const SEARCH_COUNT_CAP = 1000;
    const allSearchResults = await getFilteredQuery().take(
      SEARCH_COUNT_CAP + 1
    );

    const filteredCount = allSearchResults.filter(matchesAuctionFilter).length;

    const totalCount =
      filteredCount > SEARCH_COUNT_CAP ? `${SEARCH_COUNT_CAP}+` : filteredCount;

    return {
      ...results,
      page,
      totalCount,
    };
  }

  const [results, totalCount] = await Promise.all([
    getFilteredQuery().paginate(args.paginationOpts),
    countQuery(getFilteredQuery()),
  ]);

  const page = await Promise.all(
    results.page.map((auction) => toAuctionSummary(ctx, auction))
  );

  return {
    ...results,
    page,
    totalCount,
  };
};

/**
 * Advanced search and filter for auctions with pagination support.
 */
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
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRequired"),
        v.literal("SplitRecommended"),
        v.null()
      )
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    totalCount: v.union(v.number(), v.string()),
  }),
  handler: getActiveAuctionsHandler,
});

/**
 * Handler for returning a unique list of all makes currently registered in equipment metadata.
 * @param ctx
 * @returns Promise<string[]>
 */
export const getActiveMakesHandler = async (ctx: QueryCtx) => {
  const metadata = await ctx.db
    .query("equipmentMetadata")
    .filter((q) =>
      q.or(
        q.eq(q.field("isActive"), true),
        q.eq(q.field("isActive"), undefined)
      )
    )
    .collect();
  const makes = Array.from(new Set(metadata.map((m) => m.make))).sort();
  return makes;
};

/**
 * Returns a unique list of all makes currently registered in equipment metadata.
 */
export const getActiveMakes = query({
  args: {},
  returns: v.array(v.string()),
  handler: getActiveMakesHandler,
});

/**
 * Handler for fetching auction by ID.
 * @param ctx
 * @param args
 * @param args.auctionId
 * @returns Promise<AuctionDetail | null>
 */
export const getAuctionByIdHandler = async (
  ctx: QueryCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  const auction = await ctx.db.get(args.auctionId);
  if (!auction) return null;

  // Enforce visibility: Drafts and non-public auctions only for owner/admin
  const PUBLIC_STATUSES = ["active", "sold", "unsold"];
  if (!PUBLIC_STATUSES.includes(auction.status)) {
    const auth = await getAuthenticatedProfile(ctx);
    if (!auth || !auth.profile) return null;

    const isAdmin = auth.profile.role === "admin";
    const isOwner = auction.sellerId === auth.userId;

    if (!isAdmin && !isOwner) return null;
  }

  return await toAuctionDetail(ctx, auction);
};

/**
 * Fetch full details for a single auction by ID.
 */
export const getAuctionById = query({
  args: { auctionId: v.id("auctions") },
  returns: v.union(v.null(), AuctionDetailValidator),
  handler: getAuctionByIdHandler,
});

/**
 * Handler for retrieving a paginated list of bids for a specific auction.
 * @param ctx
 * @param args
 * @param args.auctionId
 * @param args.paginationOpts
 * @returns Promise<PaginatedBids>
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

  const auction = await ctx.db.get(args.auctionId);
  const auth = await getAuthenticatedProfile(ctx);
  const isAdmin = auth?.profile?.role === "admin";
  const isSeller = auction?.sellerId === auth?.userId;

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

      // Only reveal bidder names to admin or the seller of this auction
      if (!isAdmin && !isSeller) {
        bidderNames.set(mapKey as string, "Bidder");
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
};

/**
 * Retrieve a paginated list of bids for a specific auction.
 *
 * Enriches each bid with the bidder's display name.
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
 * Handler for retrieving the total number of bids for a specific auction.
 * @param ctx
 * @param args
 * @param args.auctionId
 * @returns Promise<number>
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
 * Retrieve the total number of bids for a specific auction.
 *
 * @param auctionId - The ID of the auction
 * @returns The total number of bids
 */
export const getAuctionBidCount = query({
  args: { auctionId: v.id("auctions") },
  returns: v.number(),
  handler: getAuctionBidCountHandler,
});

/**
 * Handler for retrieving a paginated list of equipment metadata for administration.
 * @param ctx
 * @param args
 * @param args.paginationOpts
 * @returns Promise<PaginatedMetadata>
 */
export const getEquipmentMetadataHandler = async (
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions }
) => {
  const metadataQuery = ctx.db.query("equipmentMetadata");
  const [results, totalCount] = await Promise.all([
    metadataQuery.paginate(args.paginationOpts),
    countQuery(ctx.db.query("equipmentMetadata")),
  ]);
  return {
    ...results,
    totalCount,
  };
};

/**
 * Retrieve a paginated list of equipment metadata for administration.
 */
export const getEquipmentMetadata = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("equipmentMetadata"),
        _creationTime: v.number(),
        make: v.string(),
        models: v.array(v.string()),
        categoryId: v.optional(v.id("equipmentCategories")),
        category: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
        updatedAt: v.optional(v.number()),
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
  handler: getEquipmentMetadataHandler,
});

/**
 * Handler for fetching all active equipment categories.
 * @param ctx
 * @returns Promise<EquipmentCategory[]>
 */
export const getCategoriesHandler = async (ctx: QueryCtx) => {
  return await ctx.db
    .query("equipmentCategories")
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();
};

/**
 * Fetch all active equipment categories.
 *
 * @returns An array of equipment categories with _id, _creationTime, name, and isActive.
 */
export const getCategories = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("equipmentCategories"),
      _creationTime: v.number(),
      name: v.string(),
      isActive: v.boolean(),
    })
  ),
  handler: getCategoriesHandler,
});

/**
 * Handler for retrieving public profile information and sales statistics for a seller.
 * @param ctx
 * @param args
 * @param args.sellerId
 * @returns Promise<SellerInfo | null>
 */
export const getSellerInfoHandler = async (
  ctx: QueryCtx,
  args: { sellerId: string }
) => {
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
};

/**
 * Retrieve public profile information and sales statistics for a seller.
 */
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
  handler: getSellerInfoHandler,
});

/**
 * Handler for retrieving a paginated list of active or sold listings for a specific seller.
 * @param ctx
 * @param args
 * @param args.userId
 * @param args.paginationOpts
 * @returns Promise<PaginatedAuctions>
 */
export const getSellerListingsHandler = async (
  ctx: QueryCtx,
  args: { userId: string; paginationOpts: PaginationOptions }
) => {
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
};

/**
 * Retrieve a paginated list of active or sold listings for a specific seller.
 */
export const getSellerListings = query({
  args: { userId: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(AuctionSummaryValidator),
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
  handler: getSellerListingsHandler,
});

/**
 * Handler for retrieving a paginated list of all auctions (all statuses) for admin oversight.
 * @param ctx
 * @param args
 * @param args.paginationOpts
 * @returns Promise<PaginatedAuctions>
 */
export const getAllAuctionsHandler = async (
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions }
) => {
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
        async (auction: Doc<"auctions">) => await toAuctionSummary(ctx, auction)
      )
    ),
  };
};

/**
 * Retrieve a paginated list of all auctions (all statuses) for admin oversight.
 *
 * Only accessible to admin users.
 */
export const getAllAuctions = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(AuctionSummaryValidator),
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
  handler: getAllAuctionsHandler,
});

/**
 * Helper to get the authenticated user's ID.
 *
 * @param ctx - Convex Query context
 * @returns The user's ID, or null if unauthenticated
 */
async function getAuthenticatedUserId(ctx: QueryCtx): Promise<string | null> {
  try {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) return null;
    return resolveUserId(authUser);
  } catch (err) {
    // The authComponent does not expose a specific error class or error code for
    // unauthenticated errors. This relies on the error message containing "Unauthenticated"
    // which is the default behavior from the underlying auth library.
    if (err instanceof Error && err.message.includes("Unauthenticated")) {
      return null;
    }
    throw err;
  }
}

/**
 * Result for paginated queries when the user is unauthenticated.
 * @param totalCount - Optional count to return (defaults to 0)
 * @returns A standard empty paginated result
 */
const unauthenticatedPaginatedResult = (totalCount = 0) => ({
  page: [],
  isDone: true,
  continueCursor: "",
  totalCount,
  pageStatus: null,
  splitCursor: null,
});

/**
 * Handler for retrieving auctions the authenticated user has bid on.
 * @param ctx
 * @param args
 * @param args.paginationOpts
 * @param args.sort
 * @returns Promise<PaginatedBids>
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

  // 1. Get all bid stats for the user (handles grouping and basic metrics)
  const { auctionStatsMap, auctionsMap } = await calculateUserBidStats(
    ctx,
    userId
  );

  // 2. Transform into the required return format
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

  // Filter out invalid items
  const validAuctions = allAuctionSummaries.filter(
    (a): a is NonNullable<typeof a> => a !== null
  );

  // 3. Sort based on user preference
  const sortBy = args.sort || "recent";
  validAuctions.sort((a, b) => {
    if (sortBy === "ending") {
      const timeA = a.endTime ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.endTime ?? Number.MAX_SAFE_INTEGER;
      return timeA - timeB; // Ending soonest first
    }
    // Default: Most recent activity first
    return b.lastBidTimestamp - a.lastBidTimestamp;
  });

  // 4. Apply manual pagination
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
 * Retrieve auctions the authenticated user has bid on, enriched with participation stats.
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
 * Handler for retrieving a paginated list of all listings owned by the authenticated user.
 * @param ctx
 * @param args
 * @param args.paginationOpts
 * @returns Promise<PaginatedAuctions>
 */
export const getMyListingsHandler = async (
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions }
) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) return { ...unauthenticatedPaginatedResult(), page: [] };

  const listingsQuery = ctx.db
    .query("auctions")
    .withIndex("by_seller", (q) => q.eq("sellerId", userId));

  const [results, totalCount] = await Promise.all([
    listingsQuery.paginate(args.paginationOpts),
    countQuery(
      ctx.db
        .query("auctions")
        .withIndex("by_seller", (q) => q.eq("sellerId", userId))
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
};

/**
 * Retrieve a paginated list of all listings owned by the authenticated user.
 */
export const getMyListings = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(AuctionSummaryValidator),
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
  handler: getMyListingsHandler,
});

/**
 * Handler for getting the total number of listings for the authenticated user, optionally filtered by status.
 * @param ctx
 * @param args
 * @param args.status
 * @returns Promise<number>
 */
export const getMyListingsCountHandler = async (
  ctx: QueryCtx,
  args: { status?: string }
) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) return 0;

  let baseQuery = ctx.db
    .query("auctions")
    .withIndex("by_seller", (q) => q.eq("sellerId", userId));

  if (args.status && args.status !== "all") {
    baseQuery = baseQuery.filter((q) => q.eq(q.field("status"), args.status));
  }

  return await countQuery(baseQuery);
};

/**
 * Get the total number of listings for the authenticated user, optionally filtered by status.
 *
 * @param ctx - Convex Query context containing authentication info
 * @param args - Filtering arguments
 * @param args.status - Optional status to filter listings by (e.g., 'active', 'sold')
 * @returns The total number of matching listings
 */
export const getMyListingsCount = query({
  args: { status: v.optional(v.string()) },
  returns: v.number(),
  handler: getMyListingsCountHandler,
});

const COUNTABLE_STATUSES = [
  "draft",
  "pending_review",
  "active",
  "sold",
  "unsold",
  "rejected",
] as const;
type CountableStatus = (typeof COUNTABLE_STATUSES)[number];

/**
 * Handler for getting listing counts for the authenticated user, grouped by status.
 * @param ctx
 * @returns Promise<ListingStats>
 */
export const getMyListingsStatsHandler = async (ctx: QueryCtx) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId)
    return {
      all: 0,
      draft: 0,
      pending_review: 0,
      active: 0,
      sold: 0,
      unsold: 0,
      rejected: 0,
    };

  const listings = await ctx.db
    .query("auctions")
    .withIndex("by_seller", (q) => q.eq("sellerId", userId))
    .collect();

  const stats = {
    all: listings.length,
    draft: 0,
    pending_review: 0,
    active: 0,
    sold: 0,
    unsold: 0,
    rejected: 0,
  };

  for (const listing of listings) {
    if (COUNTABLE_STATUSES.includes(listing.status as CountableStatus)) {
      stats[listing.status as CountableStatus]++;
    }
  }

  return stats;
};

/**
 * Get listing counts for the authenticated user, grouped by status.
 *
 * @param ctx - Convex Query context
 * @returns Object mapping status types to their respective counts
 */
export const getMyListingsStats = query({
  args: {},
  returns: v.object({
    all: v.number(),
    draft: v.number(),
    pending_review: v.number(),
    active: v.number(),
    sold: v.number(),
    unsold: v.number(),
    rejected: v.number(),
  }),
  handler: getMyListingsStatsHandler,
});

/**
 * Handler for getting the total number of non-voided bids placed by the authenticated user.
 * @param ctx
 * @returns Promise<number>
 */
export const getMyBidsCountHandler = async (ctx: QueryCtx) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) return 0;

  const { auctionStatsMap } = await calculateUserBidStats(ctx, userId);
  return auctionStatsMap.size;
};

/**
 * Get the total number of non-voided bids placed by the authenticated user.
 *
 * @param ctx
 * @returns The total number of non-voided bids
 */
export const getMyBidsCount = query({
  args: {},
  returns: v.number(),
  handler: getMyBidsCountHandler,
});

/**
 * Handler for retrieving high-level bidding statistics for the authenticated user.
 * @param ctx
 * @returns Promise<BidStats>
 */
export const getMyBidsStatsHandler = async (ctx: QueryCtx) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) return ZERO_AUCTION_STATS;

  const { globalStats } = await calculateUserBidStats(ctx, userId);
  return globalStats;
};

/**
 * Retrieve high-level bidding statistics for the authenticated user.
 *
 * Includes counts for active, winning, and outbid auctions, as well as total exposure.
 * @param ctx
 * @returns An object containing aggregated bidding metrics
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

/**
 * Handler for retrieving all flags (reports) associated with a specific auction.
 * @param ctx
 * @param args
 * @param args.auctionId
 * @returns Promise<AuctionFlag[]>
 */
export const getAuctionFlagsHandler = async (
  ctx: QueryCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  await requireAdmin(ctx);

  const flags = await ctx.db
    .query("auctionFlags")
    .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
    .order("desc")
    .collect();

  const uniqueReporterIds = Array.from(new Set(flags.map((f) => f.reporterId)));
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
};

/**
 * Retrieve all flags (reports) associated with a specific auction.
 *
 * Enriches each flag with the reporter's name. Only accessible to admin users.
 */
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
  handler: getAuctionFlagsHandler,
});

/**
 * Handler for retrieving all auctions flagged by users that are currently pending review.
 * @param ctx
 * @returns Promise<PendingFlag[]>
 */
export const getAllPendingFlagsHandler = async (ctx: QueryCtx) => {
  await requireAdmin(ctx);

  const flags = await ctx.db
    .query("auctionFlags")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .order("desc")
    .collect();

  const uniqueAuctionIds = Array.from(new Set(flags.map((f) => f.auctionId)));
  const auctionTitles = new Map<string, string>();
  const uniqueReporterIds = Array.from(new Set(flags.map((f) => f.reporterId)));
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
};

/**
 * Retrieve all auctions flagged by users that are currently pending review.
 *
 * Only accessible to admin users.
 */
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
  handler: getAllPendingFlagsHandler,
});
