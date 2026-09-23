import { v } from "convex/values";
import type { PaginationOptions } from "convex/server";

import {
  paginationOptsValidator,
  query,
  type QueryCtx,
  LotSummaryValidator,
} from "./shared";
import type { Doc, Id } from "../../_generated/dataModel";
import { toLotSummary } from "../helpers";
import { requireAdmin } from "../../lib/auth";
import { countQuery } from "../../admin_utils";
import { ADMIN_COLLECTION_CAP } from "../../constants";

/**
 * Returns lots pending review (admin only), capped at
 * {@link ADMIN_COLLECTION_CAP}. The truncation flag prevents consumers from
 * presenting the bounded result length as the total queue size.
 *
 * @param ctx - Convex Query context
 * @returns Capped pending lots and whether more results exist.
 */
export const getPendingLotsHandler = async (ctx: QueryCtx) => {
  await requireAdmin(ctx);

  const fetchedLots = await ctx.db
    .query("lots")
    .withIndex("by_status", (q) => q.eq("status", "pending_review"))
    .take(ADMIN_COLLECTION_CAP + 1);
  const isTruncated = fetchedLots.length > ADMIN_COLLECTION_CAP;
  const lots = fetchedLots.slice(0, ADMIN_COLLECTION_CAP);

  return {
    items: await Promise.all(lots.map((lot) => toLotSummary(ctx, lot))),
    isTruncated,
  };
};

/**
 * Query: Get pending review lots (admin only).
 * Args: (none)
 *
 * @returns Capped pending lots and whether more results exist.
 */
export const getPendingLots = query({
  args: {},
  returns: v.object({
    items: v.array(LotSummaryValidator),
    isTruncated: v.boolean(),
  }),
  handler: getPendingLotsHandler,
});

/**
 * Returns paginated list of all lots (admin only).
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.paginationOpts - Pagination options
 * @returns Paginated all lots
 */
export const getAllLotsHandler = async (
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions }
) => {
  await requireAdmin(ctx);

  const lotsQuery = ctx.db.query("lots");
  const [lotsResult, totalCount] = await Promise.all([
    lotsQuery.order("desc").paginate(args.paginationOpts),
    countQuery(ctx.db.query("lots")),
  ]);

  return {
    ...lotsResult,
    totalCount,
    page: await Promise.all(
      lotsResult.page.map(
        async (lot: Doc<"lots">) => await toLotSummary(ctx, lot)
      )
    ),
  };
};

/**
 * Query: Get all lots (admin only).
 * Args: paginationOpts
 *
 * @returns Paginated all lots
 */
export const getAllLots = query({
  args: {
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
  handler: getAllLotsHandler,
});

/**
 * Returns all flags for a specific lot with reporter names (admin only).
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.lotId - The lot ID
 * @returns Array of lot flags with reporter names
 */
export const getLotFlagsHandler = async (
  ctx: QueryCtx,
  args: { lotId: Id<"lots"> }
) => {
  await requireAdmin(ctx);

  const flags = await ctx.db
    .query("lotFlags")
    .withIndex("by_lot", (q) => q.eq("lotId", args.lotId))
    .order("desc")
    .collect();

  const uniqueReporterIds = Array.from(
    new Set(flags.map((f: Doc<"lotFlags">) => f.reporterId))
  );
  const reporterNames = new Map<string, string>();

  await Promise.all(
    uniqueReporterIds.map(async (reporterId) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", reporterId))
        .unique();
      reporterNames.set(reporterId, profile?.name ?? "Unknown User");
    })
  );

  return flags.map((flag: Doc<"lotFlags">) => ({
    ...flag,
    reporterName: reporterNames.get(flag.reporterId) ?? "Unknown User",
  }));
};

/**
 * Query: Get lot flags (admin only).
 * Args: lotId
 *
 * @returns Array of lot flags
 */
export const getLotFlags = query({
  args: { lotId: v.id("lots") },
  returns: v.array(
    v.object({
      _id: v.id("lotFlags"),
      _creationTime: v.number(),
      lotId: v.id("lots"),
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
  handler: getLotFlagsHandler,
});

/**
 * Returns pending flags across all lots (admin only), capped at
 * {@link ADMIN_COLLECTION_CAP}. The truncation flag prevents consumers from
 * presenting the bounded result length as the total queue size.
 *
 * @param ctx - Convex Query context
 * @returns Capped pending flags with enrichment and truncation state.
 */
export const getAllPendingFlagsHandler = async (ctx: QueryCtx) => {
  await requireAdmin(ctx);

  const fetchedFlags = await ctx.db
    .query("lotFlags")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .order("desc")
    .take(ADMIN_COLLECTION_CAP + 1);
  const isTruncated = fetchedFlags.length > ADMIN_COLLECTION_CAP;
  const flags = fetchedFlags.slice(0, ADMIN_COLLECTION_CAP);

  const uniqueLotIds = Array.from(
    new Set(flags.map((f: Doc<"lotFlags">) => f.lotId))
  );
  const lotTitles = new Map<string, string>();
  const uniqueReporterIds = Array.from(
    new Set(flags.map((f: Doc<"lotFlags">) => f.reporterId))
  );
  const reporterNames = new Map<string, string>();

  await Promise.all([
    ...uniqueLotIds.map(async (lotId) => {
      const lot = await ctx.db.get("lots", lotId);
      lotTitles.set(lotId, lot?.title ?? "Unknown Auction");
    }),
    ...uniqueReporterIds.map(async (reporterId) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", reporterId))
        .unique();
      reporterNames.set(reporterId, profile?.name ?? "Unknown User");
    }),
  ]);

  return {
    items: flags.map((flag: Doc<"lotFlags">) => ({
      ...flag,
      lotTitle: lotTitles.get(flag.lotId) ?? "Unknown Auction",
      reporterName: reporterNames.get(flag.reporterId) ?? "Unknown Reporter",
    })),
    isTruncated,
  };
};

/**
 * Query: Get all pending flags (admin only).
 * Args: (none)
 *
 * @returns Capped pending flags and whether more results exist.
 */
export const getAllPendingFlags = query({
  args: {},
  returns: v.object({
    items: v.array(
      v.object({
        _id: v.id("lotFlags"),
        _creationTime: v.number(),
        lotId: v.id("lots"),
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
        lotTitle: v.string(),
        reporterName: v.string(),
      })
    ),
    isTruncated: v.boolean(),
  }),
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
