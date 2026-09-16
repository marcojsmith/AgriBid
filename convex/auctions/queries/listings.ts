import { v } from "convex/values";

import {
  paginationOptsValidator,
  query,
  type QueryCtx,
  LotSummaryValidator,
  getAuthenticatedUserId,
  unauthenticatedPaginatedResult,
  type PaginationOptions,
} from "./shared";
import type { Doc } from "../../_generated/dataModel";
import { toLotSummary } from "../helpers";
import { countQuery } from "../../admin_utils";

/**
 * Returns paginated listings for the authenticated user.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.paginationOpts - Pagination options
 * @returns Paginated listings
 */
export const getMyListingsHandler = async (
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions }
) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) return { ...unauthenticatedPaginatedResult(), page: [] };

  const listingsQuery = ctx.db
    .query("lots")
    .withIndex("by_seller", (q) => q.eq("sellerId", userId));

  const [results, totalCount] = await Promise.all([
    listingsQuery.paginate(args.paginationOpts),
    countQuery(
      ctx.db
        .query("lots")
        .withIndex("by_seller", (q) => q.eq("sellerId", userId))
    ),
  ]);

  const page = await Promise.all(
    results.page.map(
      async (lot: Doc<"lots">) => await toLotSummary(ctx, lot)
    )
  );

  return {
    ...results,
    page,
    totalCount,
  };
};

/**
 * Query: Get user's listings.
 * Args: paginationOpts
 *
 * @returns Paginated listings
 */
export const getMyListings = query({
  args: { paginationOpts: paginationOptsValidator },
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
  handler: getMyListingsHandler,
});

/**
 * Returns the count of user's listings, optionally filtered by status.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.status - Optional status filter
 * @returns The listing count
 */
export const getMyListingsCountHandler = async (
  ctx: QueryCtx,
  args: { status?: string }
) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) return 0;

  let baseQuery;

  if (args.status && args.status !== "all") {
    // The UI's "active" filter maps to a lot's stored `assigned` status.
    const status = (args.status === "active"
      ? "assigned"
      : args.status) as
      | "draft"
      | "pending_review"
      | "approved"
      | "assigned"
      | "sold"
      | "unsold"
      | "rejected";
    baseQuery = ctx.db
      .query("lots")
      .withIndex("by_seller_status", (q) =>
        q.eq("sellerId", userId).eq("status", status)
      );
  } else {
    baseQuery = ctx.db
      .query("lots")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId));
  }

  return await countQuery(baseQuery);
};

/**
 * Query: Get user's listings count.
 * Args: status (optional)
 *
 * @returns The listing count
 */
export const getMyListingsCount = query({
  args: { status: v.optional(v.string()) },
  returns: v.number(),
  handler: getMyListingsCountHandler,
});

/**
 * Returns breakdown of user's listings by status (draft, pending_review, active, sold, etc).
 *
 * @param ctx - Convex Query context
 * @returns Listing statistics by status
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
    .query("lots")
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
    switch (listing.status) {
      case "draft":
        stats.draft++;
        break;
      case "pending_review":
        stats.pending_review++;
        break;
      case "approved":
      case "assigned":
        // Both pre-sale states surface as "active" in the seller dashboard.
        stats.active++;
        break;
      case "sold":
        stats.sold++;
        break;
      case "unsold":
        stats.unsold++;
        break;
      case "rejected":
        stats.rejected++;
        break;
    }
  }

  return stats;
};

/**
 * Query: Get user's listings statistics.
 * Args: (none)
 *
 * @returns Listing statistics
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
