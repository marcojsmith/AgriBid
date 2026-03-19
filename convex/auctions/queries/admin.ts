import { v } from "convex/values";
import type { PaginationOptions } from "convex/server";

import {
  paginationOptsValidator,
  query,
  type QueryCtx,
  AuctionSummaryValidator,
} from "./shared";
import type { Doc, Id } from "../../_generated/dataModel";
import { toAuctionSummary } from "../helpers";
import { requireAdmin } from "../../lib/auth";
import { findUserById } from "../../users";
import { countQuery } from "../../admin_utils";

/**
 * Returns all auctions pending review (admin only).
 *
 * @param ctx - Convex Query context
 * @returns Array of pending auctions
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
 * Query: Get pending review auctions (admin only).
 * Args: (none)
 *
 * @returns Array of pending auctions
 */
export const getPendingAuctions = query({
  args: {},
  returns: v.array(AuctionSummaryValidator),
  handler: getPendingAuctionsHandler,
});

/**
 * Returns paginated list of all auctions (admin only).
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.paginationOpts - Pagination options
 * @returns Paginated all auctions
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
 * Query: Get all auctions (admin only).
 * Args: paginationOpts
 *
 * @returns Paginated all auctions
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
 * Returns all flags for a specific auction with reporter names (admin only).
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.auctionId - The auction ID
 * @returns Array of auction flags with reporter names
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

  const uniqueReporterIds = Array.from(
    new Set(flags.map((f: Doc<"auctionFlags">) => f.reporterId))
  );
  const reporterNames = new Map<string, string>();

  await Promise.all(
    uniqueReporterIds.map(async (reporterId) => {
      const user = await findUserById(ctx, reporterId);
      reporterNames.set(reporterId, user?.name ?? "Unknown User");
    })
  );

  return flags.map((flag: Doc<"auctionFlags">) => ({
    ...flag,
    reporterName: reporterNames.get(flag.reporterId) ?? "Unknown User",
  }));
};

/**
 * Query: Get auction flags (admin only).
 * Args: auctionId
 *
 * @returns Array of auction flags
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
 * Returns all pending flags across all auctions (admin only).
 *
 * @param ctx - Convex Query context
 * @returns Array of pending flags with auction titles and reporter names
 */
export const getAllPendingFlagsHandler = async (ctx: QueryCtx) => {
  await requireAdmin(ctx);

  const flags = await ctx.db
    .query("auctionFlags")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .order("desc")
    .collect();

  const uniqueAuctionIds = Array.from(
    new Set(flags.map((f: Doc<"auctionFlags">) => f.auctionId))
  );
  const auctionTitles = new Map<string, string>();
  const uniqueReporterIds = Array.from(
    new Set(flags.map((f: Doc<"auctionFlags">) => f.reporterId))
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

  return flags.map((flag: Doc<"auctionFlags">) => ({
    ...flag,
    auctionTitle: auctionTitles.get(flag.auctionId) ?? "Unknown Auction",
    reporterName: reporterNames.get(flag.reporterId) ?? "Unknown User",
  }));
};

/**
 * Query: Get all pending flags (admin only).
 * Args: (none)
 *
 * @returns Array of pending flags
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

/**
 * Returns paginated equipment metadata for admin management.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.paginationOpts - Pagination options
 * @returns Paginated equipment metadata
 */
export const getEquipmentMetadataHandler = async (
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions }
) => {
  await requireAdmin(ctx);

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
 * Query: Get equipment metadata (admin only).
 * Args: paginationOpts
 *
 * @returns Paginated equipment metadata
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
 * Returns all active equipment categories.
 *
 * @param ctx - Convex Query context
 * @returns Array of active categories
 */
export const getCategoriesHandler = async (ctx: QueryCtx) => {
  return await ctx.db
    .query("equipmentCategories")
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();
};

/**
 * Query: Get equipment categories.
 * Args: (none)
 *
 * @returns Array of categories
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
