import { v } from "convex/values";
import type { PaginationOptions } from "convex/server";

import { paginationOptsValidator, query, type QueryCtx } from "./shared";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  toLotSummary,
  LotSummaryValidator,
  toLotDetail,
  LotDetailValidator,
} from "../helpers";
import { getAuthenticatedProfile } from "../../lib/auth";
import { countQuery } from "../../admin_utils";
import { getSellerRatingSummary } from "../../reviews";
import { MAX_RESULTS_CAP } from "../../constants";

type StatusFilter = "active" | "closed" | "all";

/** Arguments for getActiveAuctions query */
// Type alias (not interface): Convex derives the query's FunctionReference args
// type from this handler args type — interfaces break that inference.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- see comment above
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
): ("assigned" | "sold" | "unsold")[] {
  if (filter === "active") return ["assigned"];
  if (filter === "closed") return ["sold", "unsold"];
  return ["assigned", "sold", "unsold"];
}

/**
 * Determines whether a lot is currently live and biddable.
 *
 * A lot is live when it is `assigned` to a parent auction that is `published`
 * and whose effective window is currently open
 * (`auctionStartTime <= now < extendedEndTime ?? auctionEndTime`).
 *
 * @param ctx - Convex Query context used to resolve the parent auction
 * @param lot - The lot document to check
 * @returns True if the lot is live and biddable
 */
async function isLotLive(ctx: QueryCtx, lot: Doc<"lots">): Promise<boolean> {
  if (lot.status !== "assigned" || !lot.auctionId) return false;

  const auction = await ctx.db.get("auctions", lot.auctionId);
  if (auction?.status !== "published") return false;

  const now = Date.now();
  const effectiveEndTime = lot.extendedEndTime ?? auction.endTime;
  return auction.startTime <= now && now < effectiveEndTime;
}

/**
 * Manual filter check for lots.
 * Used when database-level filtering is limited (e.g., after search).
 *
 * @param lot - The lot document to check
 * @param args - Filter arguments to match against
 * @returns True if the lot matches all filter criteria
 */
function matchesLotFilter(
  lot: Doc<"lots">,
  args: Partial<ActiveAuctionsArgs>
): boolean {
  if (args.make !== undefined && lot.make !== args.make) return false;
  if (args.minYear !== undefined && lot.year < args.minYear) return false;
  if (args.maxYear !== undefined && lot.year > args.maxYear) return false;
  if (args.minPrice !== undefined && lot.currentPrice < args.minPrice)
    return false;
  if (args.maxPrice !== undefined && lot.currentPrice > args.maxPrice)
    return false;
  if (args.maxHours !== undefined && lot.operatingHours > args.maxHours)
    return false;
  return true;
}

/**
 * Returns paginated active lots with optional filtering.
 * Supports search, make, year range, price range, and hours filtering.
 *
 * "Active" is derived at query time: a lot must be `assigned` to a published,
 * currently in-window parent auction. Because that requires joining the parent
 * auction, active queries (and searches) are filtered in memory after an
 * indexed scan bounded by MAX_RESULTS_CAP, then paginated manually.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments including pagination options and filters
 * @returns Paginated lot results with total count
 */
export const getActiveAuctionsHandler = async (
  ctx: QueryCtx,
  args: ActiveAuctionsArgs
) => {
  const statusFilter = args.statusFilter ?? ("active" as StatusFilter);
  const statuses = statusesForFilter(statusFilter);
  const requiresWindowCheck = statusFilter === "active";

  const getBaseQuery = () => {
    const lotsQuery = ctx.db.query("lots");

    if (args.search) {
      if (statuses.length === 1) {
        return lotsQuery.withSearchIndex("search_title", (q) =>
          q.search("title", args.search ?? "").eq("status", statuses[0])
        );
      }
      return lotsQuery.withSearchIndex("search_title_simple", (q) =>
        q.search("title", args.search ?? "")
      );
    }

    if (args.make) {
      if (statuses.length === 1) {
        return lotsQuery.withIndex("by_status_make", (q) =>
          q.eq("status", statuses[0]).eq("make", args.make ?? "")
        );
      }
      return lotsQuery
        .order("desc")
        .filter((q) => q.eq(q.field("make"), args.make ?? ""));
    }

    if (args.minYear !== undefined || args.maxYear !== undefined) {
      if (statuses.length === 1) {
        return lotsQuery.withIndex("by_status_year", (q) => {
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
      return lotsQuery.order("desc");
    }

    if (statuses.length === 1) {
      return lotsQuery
        .withIndex("by_status", (q) => q.eq("status", statuses[0]))
        .order("desc");
    }
    return lotsQuery.order("desc");
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

  if (requiresWindowCheck || args.search) {
    // For active/search we fetch all potentially matching items (up to cap) and
    // filter them manually, so the derived liveness check and accurate
    // totalCount/non-empty pages are preserved when filters are combined.
    const allResults = await getFilteredQuery().take(MAX_RESULTS_CAP + 1);

    const filteredResults: Doc<"lots">[] = [];
    for (const lot of allResults) {
      if (!matchesLotFilter(lot, args)) continue;
      if (requiresWindowCheck && !(await isLotLive(ctx, lot))) continue;
      filteredResults.push(lot);
    }

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
      paginatedSlice.map((lot) => toLotSummary(ctx, lot))
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
    results.page.map((lot) => toLotSummary(ctx, lot))
  );

  const finalTotalCount = totalCount > 1000 ? "1000+" : totalCount;

  return {
    ...results,
    page,
    totalCount: finalTotalCount,
  };
};

/**
 * Query: Get paginated list of active lots with filtering.
 * Args: paginationOpts, search, make, minYear, maxYear, minPrice, maxPrice, maxHours, statusFilter
 *
 * @returns Paginated lot results
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
    page: v.array(LotSummaryValidator),
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
 * Returns up to 4 active lots with the same make, excluding the given lot.
 * Used for the "More from this make" related lots section on LotDetail.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.make - Equipment make to match
 * @param args.excludeId - Lot ID to exclude (the current lot)
 * @returns Array of matching lot summaries (max 4)
 */
export const getRelatedAuctions = query({
  args: {
    make: v.string(),
    excludeId: v.id("lots"),
  },
  returns: v.array(LotSummaryValidator),
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query("lots")
      .withIndex("by_status_make", (q) =>
        q.eq("status", "assigned").eq("make", args.make)
      )
      .filter((q) => q.neq(q.field("_id"), args.excludeId))
      .take(MAX_RESULTS_CAP + 1);

    const related: Doc<"lots">[] = [];
    for (const lot of candidates) {
      if (await isLotLive(ctx, lot)) related.push(lot);
      if (related.length >= 4) break;
    }

    return Promise.all(related.map((lot) => toLotSummary(ctx, lot)));
  },
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
 * Returns a single lot by ID with full details including all images and seller email.
 * Returns null if the lot is not found or not accessible (non-public lots require auth).
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.lotId - The lot ID to fetch
 * @returns The lot with full details or null if not found
 */
export const getLotByIdHandler = async (
  ctx: QueryCtx,
  args: { lotId: Id<"lots"> }
) => {
  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) return null;

  const PUBLIC_STATUSES = ["assigned", "sold", "unsold"];
  if (!PUBLIC_STATUSES.includes(lot.status)) {
    const auth = await getAuthenticatedProfile(ctx);
    if (!auth?.profile) return null;

    const isAdmin = auth.profile.role === "admin";
    const isOwner =
      lot.sellerId === auth.authUser._id || lot.sellerId === auth.userId;

    if (!isAdmin && !isOwner) return null;
  }

  return await toLotDetail(ctx, lot);
};

/**
 * Query: Get lot by ID with full details.
 * Args: lotId
 *
 * @returns Lot detail or null
 */
export const getLotById = query({
  args: { lotId: v.id("lots") },
  returns: v.union(v.null(), LotDetailValidator),
  handler: getLotByIdHandler,
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
  const sellerId = args.sellerId;

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", sellerId))
    .unique();

  if (!profile) return null;

  const [soldLots, activeLots, bidsPlaced, { avgRating, reviewCount }] =
    await Promise.all([
      ctx.db
        .query("lots")
        .withIndex("by_seller_status", (q) =>
          q.eq("sellerId", sellerId).eq("status", "sold")
        )
        .collect(),
      countQuery(
        ctx.db
          .query("lots")
          .withIndex("by_seller_status", (q) =>
            q.eq("sellerId", sellerId).eq("status", "assigned")
          )
      ),
      countQuery(
        ctx.db
          .query("bids")
          .withIndex("by_bidder", (q) => q.eq("bidderId", sellerId))
      ),
      getSellerRatingSummary(ctx, sellerId),
    ]);

  const soldLotsCount = soldLots.length;
  const activeListingsCount = activeLots;
  const totalSoldPrice = soldLots.reduce(
    (sum, lot) => sum + lot.currentPrice,
    0
  );
  const avgSalePrice =
    soldLotsCount > 0
      ? Math.round(totalSoldPrice / soldLotsCount)
      : undefined;

  return {
    name: profile.name,
    isVerified: profile.isVerified,
    kycStatus: profile.kycStatus,
    role: profile.role,
    createdAt: profile.createdAt,
    itemsSold: soldLotsCount,
    activeListings: activeListingsCount,
    totalListings: soldLotsCount + activeListingsCount,
    bio: profile.bio,
    companyName: profile.companyName,
    location: profile.location,
    emailVerified: profile.emailVerified,
    phoneVerified: profile.phoneVerified,
    bankingVerified: profile.bankingVerified,
    taxNumberVerified: profile.taxNumberVerified,
    bidsPlaced,
    avgSalePrice,
    avgRating,
    reviewCount,
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
      kycStatus: v.optional(
        v.union(
          v.literal("pending"),
          v.literal("verified"),
          v.literal("rejected")
        )
      ),
      role: v.string(),
      createdAt: v.optional(v.number()),
      itemsSold: v.number(),
      activeListings: v.number(),
      totalListings: v.number(),
      bio: v.optional(v.string()),
      companyName: v.optional(v.string()),
      location: v.optional(v.string()),
      emailVerified: v.optional(v.boolean()),
      phoneVerified: v.optional(v.boolean()),
      bankingVerified: v.optional(v.boolean()),
      taxNumberVerified: v.optional(v.boolean()),
      bidsPlaced: v.number(),
      avgSalePrice: v.optional(v.number()),
      avgRating: v.optional(v.number()),
      reviewCount: v.number(),
    })
  ),
  handler: getSellerInfoHandler,
});

/**
 * Returns paginated listings for a specific seller.
 * When `statusFilter` is provided, only listings with that status are returned
 * (via the `by_seller_status` index); otherwise both active and sold listings
 * are returned (via the `by_seller` index with an in-memory status filter).
 *
 * The public "active" filter maps to a lot's stored `assigned` status.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.userId - The seller's user ID
 * @param args.statusFilter - Optional status to filter by ("active" or "sold")
 * @param args.paginationOpts - Pagination options
 * @returns Paginated seller listings
 */
export const getSellerListingsHandler = async (
  ctx: QueryCtx,
  args: {
    userId: string;
    statusFilter?: "active" | "sold";
    paginationOpts: PaginationOptions;
  }
) => {
  const { userId, statusFilter, paginationOpts } = args;

  const getListingsQuery = () => {
    if (statusFilter !== undefined) {
      const status = statusFilter === "active" ? "assigned" : "sold";
      return ctx.db
        .query("lots")
        .withIndex("by_seller_status", (q) =>
          q.eq("sellerId", userId).eq("status", status)
        );
    }
    return ctx.db
      .query("lots")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "assigned"),
          q.eq(q.field("status"), "sold")
        )
      );
  };

  const [results, totalCount] = await Promise.all([
    getListingsQuery().paginate(paginationOpts),
    countQuery(getListingsQuery()),
  ]);

  const page = await Promise.all(
    results.page.map(async (lot: Doc<"lots">) => await toLotSummary(ctx, lot))
  );

  return {
    ...results,
    page,
    totalCount,
  };
};

/**
 * Query: Get paginated seller listings.
 * Args: userId, statusFilter (optional), paginationOpts
 *
 * @returns Paginated listings
 */
export const getSellerListings = query({
  args: {
    userId: v.string(),
    statusFilter: v.optional(v.union(v.literal("active"), v.literal("sold"))),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(LotSummaryValidator),
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
