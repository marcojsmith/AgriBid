import { v } from "convex/values";
import type { PaginationOptions } from "convex/server";

import { paginationOptsValidator, query, type QueryCtx } from "./shared";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  toAuctionSummary,
  AuctionSummaryValidator,
  toAuctionDetail,
  AuctionDetailValidator,
} from "../helpers";
import { getAuthenticatedProfile } from "../../lib/auth";
import { findUserById } from "../../users";
import { countQuery } from "../../admin_utils";
import { MAX_RESULTS_CAP } from "../../constants";

type StatusFilter = "active" | "closed" | "all";

/** Arguments for getActiveAuctions query */
export type ActiveAuctionsArgs = {
  paginationOpts: PaginationOptions;
  search?: string;
  make?: string;
  minYear?: number;
  maxYear?: number;
  minPrice?: number;
  maxPrice?: number;
  maxHours?: number;
  statusFilter?: StatusFilter;
};

function statusesForFilter(
  filter: StatusFilter
): ("active" | "sold" | "unsold")[] {
  if (filter === "active") return ["active"];
  if (filter === "closed") return ["sold", "unsold"];
  return ["active", "sold", "unsold"];
}

/**
 * Manual filter check for auctions.
 * Used when database-level filtering is limited (e.g., after search).
 *
 * @param auction - The auction document to check
 * @param args - Filter arguments to match against
 * @returns True if the auction matches all filter criteria
 */
function matchesAuctionFilter(
  auction: Doc<"auctions">,
  args: Partial<ActiveAuctionsArgs>
): boolean {
  if (args.make !== undefined && auction.make !== args.make) return false;
  if (args.minYear !== undefined && auction.year < args.minYear) return false;
  if (args.maxYear !== undefined && auction.year > args.maxYear) return false;
  if (args.minPrice !== undefined && auction.currentPrice < args.minPrice)
    return false;
  if (args.maxPrice !== undefined && auction.currentPrice > args.maxPrice)
    return false;
  if (
    args.maxHours !== undefined &&
    (auction.operatingHours ?? 0) > args.maxHours
  )
    return false;
  return true;
}

/**
 * Returns paginated active auctions with optional filtering.
 * Supports search, make, year range, price range, and hours filtering.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments including pagination options and filters
 * @returns Paginated auction results with total count
 */
export const getActiveAuctionsHandler = async (
  ctx: QueryCtx,
  args: ActiveAuctionsArgs
) => {
  const statusFilter = args.statusFilter ?? ("active" as StatusFilter);
  const statuses = statusesForFilter(statusFilter);

  const getBaseQuery = () => {
    const auctionsQuery = ctx.db.query("auctions");

    if (args.search) {
      if (statuses.length === 1) {
        return auctionsQuery.withSearchIndex("search_title", (q) =>
          q.search("title", args.search ?? "").eq("status", statuses[0])
        );
      }
      return auctionsQuery.withSearchIndex("search_title_simple", (q) =>
        q.search("title", args.search ?? "")
      );
    }

    if (args.make) {
      if (statuses.length === 1) {
        return auctionsQuery.withIndex("by_status_make", (q) =>
          q.eq("status", statuses[0]).eq("make", args.make ?? "")
        );
      }
      return auctionsQuery
        .order("desc")
        .filter((q) => q.eq(q.field("make"), args.make ?? ""));
    }

    if (args.minYear !== undefined || args.maxYear !== undefined) {
      if (statuses.length === 1) {
        return auctionsQuery.withIndex("by_status_year", (q) => {
          if (args.minYear !== undefined && args.maxYear !== undefined) {
            return q
              .eq("status", statuses[0])
              .gte("year", args.minYear)
              .lte("year", args.maxYear);
          }
          if (args.minYear !== undefined) {
            return q.eq("status", statuses[0]).gte("year", args.minYear);
          }
          return q.eq("status", statuses[0]).lte("year", args.maxYear ?? 0);
        });
      }
      return auctionsQuery.order("desc");
    }

    if (statuses.length === 0) {
      // Return an empty query if no status matches the filter using a type-safe always-false condition
      return auctionsQuery.filter((q) => q.neq(q.field("_id"), q.field("_id")));
    }

    if (statuses.length === 1) {
      return auctionsQuery
        .withIndex("by_status", (q) => q.eq("status", statuses[0]))
        .order("desc");
    }
    return auctionsQuery.order("desc");
  };

  const getFilteredQuery = () => {
    const q = getBaseQuery();

    return q.filter((f) => {
      const expressions = [];

      if (statuses.length > 1) {
        expressions.push(
          f.or(...statuses.map((s) => f.eq(f.field("status"), s)))
        );
      }

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

      return expressions.length > 0 ? f.and(...expressions) : true;
    });
  };

  if (args.search) {
    // For search, we fetch all potentially matching items (up to cap) and filter them manually.
    // This ensures accurate totalCount and non-empty pages when filters are combined with search.
    const allSearchResults = await getFilteredQuery().take(MAX_RESULTS_CAP + 1);

    const filteredResults = allSearchResults.filter((auction) =>
      matchesAuctionFilter(auction, args)
    );

    const totalCount =
      filteredResults.length > MAX_RESULTS_CAP
        ? "1000+"
        : filteredResults.length;

    // Apply manual pagination to the filtered results
    const numItems = args.paginationOpts.numItems;
    const cursor = args.paginationOpts.cursor;
    const startIndex = cursor ? parseInt(cursor, 10) : 0;

    const paginatedSlice = filteredResults.slice(
      startIndex,
      startIndex + numItems
    );

    const page = await Promise.all(
      paginatedSlice.map((auction) => toAuctionSummary(ctx, auction))
    );

    const nextIndex = startIndex + numItems;
    const isDone = filteredResults.length <= nextIndex;

    return {
      page,
      isDone,
      continueCursor: isDone ? "" : nextIndex.toString(),
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

  const finalTotalCount = totalCount > 1000 ? "1000+" : totalCount;

  return {
    ...results,
    page,
    totalCount: finalTotalCount,
  };
};

/**
 * Query: Get paginated list of active auctions with filtering.
 * Args: paginationOpts, search, make, minYear, maxYear, minPrice, maxPrice, maxHours, statusFilter
 *
 * @returns Paginated auction results
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
 * Returns list of active equipment makes for filter dropdowns.
 *
 * @param ctx - Convex Query context
 * @returns Array of unique equipment makes
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
 * Query: Get list of active equipment makes.
 * Args: (none)
 *
 * @returns Array of equipment makes
 */
export const getActiveMakes = query({
  args: {},
  returns: v.array(v.string()),
  handler: getActiveMakesHandler,
});

/**
 * Returns a single auction by ID with full details including all images and seller email.
 * Returns null if auction not found or not accessible (non-public auctions require auth).
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.auctionId - The auction ID to fetch
 * @returns The auction with full details or null if not found
 */
export const getAuctionByIdHandler = async (
  ctx: QueryCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  const auction = await ctx.db.get(args.auctionId);
  if (!auction) return null;

  const PUBLIC_STATUSES = ["active", "sold", "unsold"];
  if (!PUBLIC_STATUSES.includes(auction.status)) {
    const auth = await getAuthenticatedProfile(ctx);
    if (!auth?.profile) return null;

    const isAdmin = auth.profile.role === "admin";
    const isOwner = auction.sellerId === auth.authUser._id || auction.sellerId === auth.userId;

    if (!isAdmin && !isOwner) return null;
  }

  return await toAuctionDetail(ctx, auction);
};

/**
 * Query: Get auction by ID with full details.
 * Args: auctionId
 *
 * @returns Auction detail or null
 */
export const getAuctionById = query({
  args: { auctionId: v.id("auctions") },
  returns: v.union(v.null(), AuctionDetailValidator),
  handler: getAuctionByIdHandler,
});

/**
 * Returns seller profile info including verification status, items sold, and total listings.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.sellerId - The seller user ID
 * @returns Seller profile information or null if not found
 */
export const getSellerInfoHandler = async (
  ctx: QueryCtx,
  args: { sellerId: string }
) => {
  const user = await findUserById(ctx, args.sellerId);

  if (!user) return null;

  // Use the shared userId for profile lookup
  const sharedUserId = user.userId ?? user._id;
  if (!sharedUserId) return null;

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", sharedUserId))
    .unique();

  // Use the auth _id for auction queries (auctions are keyed by auth _id)
  const authId = user._id;
  const [soldAuctions, allListings] = await Promise.all([
    countQuery(
      ctx.db
        .query("auctions")
        .withIndex("by_seller_status", (q) =>
          q.eq("sellerId", authId).eq("status", "sold")
        )
    ),
    countQuery(
      ctx.db
        .query("auctions")
        .withIndex("by_seller", (q) => q.eq("sellerId", authId))
    ),
  ]);

  return {
    name: user.name,
    isVerified: profile?.isVerified ?? false,
    role: profile?.role ?? "Private Seller",
    createdAt: user.createdAt,
    itemsSold: soldAuctions,
    totalListings: allListings,
  };
};

/**
 * Query: Get seller profile information.
 * Args: sellerId
 *
 * @returns Seller profile or null
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
 * Returns paginated listings for a specific seller with active and sold auctions.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.userId - The seller's user ID
 * @param args.paginationOpts - Pagination options
 * @returns Paginated seller listings
 */
export const getSellerListingsHandler = async (
  ctx: QueryCtx,
  args: {
    userId: string;
    paginationOpts: PaginationOptions;
  }
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
 * Query: Get paginated seller listings.
 * Args: userId, paginationOpts
 *
 * @returns Paginated listings
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