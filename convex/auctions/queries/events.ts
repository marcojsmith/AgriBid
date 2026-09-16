// app/convex/auctions/queries/events.ts
import { v } from "convex/values";

import { query, type QueryCtx } from "./shared";
import { LotSummaryValidator, toLotSummary } from "../helpers";
import { requireAdmin } from "../../lib/auth";
import { resolveUrlCached } from "../../image_cache";
import type { Id } from "../../_generated/dataModel";

/**
 * Validator for an auction (scheduled sale container) with a resolved banner
 * image URL.
 */
export const AuctionValidator = v.object({
  _id: v.id("auctions"),
  _creationTime: v.number(),
  title: v.string(),
  description: v.optional(v.string()),
  bannerImageUrl: v.optional(v.string()),
  startTime: v.number(),
  endTime: v.number(),
  status: v.union(
    v.literal("draft"),
    v.literal("published"),
    v.literal("closed")
  ),
  defaultBuyerPremiumPct: v.optional(v.number()),
  defaultSellerCommissionPct: v.optional(v.number()),
  createdBy: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  lotCount: v.number(),
});

/**
 * Auction container with its lots, used by the public container-detail page.
 */
export const AuctionWithLotsValidator = AuctionValidator.extend({
  lots: v.array(LotSummaryValidator),
});

/** Raw auction container document shape consumed by {@link toAuction}. */
interface AuctionContainerDoc {
  _id: Id<"auctions">;
  _creationTime: number;
  title: string;
  description?: string;
  bannerImage?: Id<"_storage">;
  startTime: number;
  endTime: number;
  status: "draft" | "published" | "closed";
  defaultBuyerPremiumPct?: number;
  defaultSellerCommissionPct?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Convert an auction container document into the client-facing shape,
 * resolving its banner image to an accessible URL and counting assigned lots.
 *
 * @param ctx - Query context.
 * @param auction - The auction container document.
 * @returns The auction with a resolved banner URL and lot count.
 */
async function toAuction(ctx: QueryCtx, auction: AuctionContainerDoc) {
  const [bannerImageUrl, lots] = await Promise.all([
    resolveUrlCached(ctx.storage, auction.bannerImage),
    ctx.db
      .query("lots")
      .withIndex("by_auctionId", (q) => q.eq("auctionId", auction._id))
      .collect(),
  ]);

  return {
    _id: auction._id,
    _creationTime: auction._creationTime,
    title: auction.title,
    description: auction.description,
    bannerImageUrl,
    startTime: auction.startTime,
    endTime: auction.endTime,
    status: auction.status,
    defaultBuyerPremiumPct: auction.defaultBuyerPremiumPct,
    defaultSellerCommissionPct: auction.defaultSellerCommissionPct,
    createdBy: auction.createdBy,
    createdAt: auction.createdAt,
    updatedAt: auction.updatedAt,
    lotCount: lots.length,
  };
}

/**
 * Returns every auction container, newest first (admin only).
 *
 * @param ctx - Convex Query context.
 * @returns Array of auctions with resolved banner URLs and lot counts.
 */
export const getAllAuctionsHandler = async (ctx: QueryCtx) => {
  await requireAdmin(ctx);

  const auctions = await ctx.db.query("auctions").order("desc").collect();
  return await Promise.all(auctions.map((a) => toAuction(ctx, a)));
};

export const getAllAuctions = query({
  args: {},
  returns: v.array(AuctionValidator),
  handler: getAllAuctionsHandler,
});

/**
 * Returns a single auction container by id, with its resolved banner URL and
 * lot count (admin only).
 *
 * @param ctx - Convex Query context.
 * @param args - Handler arguments.
 * @param args.auctionId - The auction container id.
 * @returns The auction, or null if it doesn't exist.
 */
export const getAuctionByIdHandler = async (
  ctx: QueryCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  await requireAdmin(ctx);

  const auction = await ctx.db.get("auctions", args.auctionId);
  if (!auction) return null;
  return await toAuction(ctx, auction);
};

export const getAuctionById = query({
  args: { auctionId: v.id("auctions") },
  returns: v.union(AuctionValidator, v.null()),
  handler: getAuctionByIdHandler,
});

/**
 * Returns every published auction container (past or present), newest-start
 * first, for the public auction gallery. Draft containers are never exposed
 * publicly.
 *
 * @param ctx - Convex Query context.
 * @returns Array of published/closed auctions with resolved banners.
 */
export const getPublishedAuctionsHandler = async (ctx: QueryCtx) => {
  const published = await ctx.db
    .query("auctions")
    .withIndex("by_status", (q) => q.eq("status", "published"))
    .collect();
  const closed = await ctx.db
    .query("auctions")
    .withIndex("by_status", (q) => q.eq("status", "closed"))
    .collect();

  const all = [...published, ...closed].sort(
    (a, b) => b.startTime - a.startTime
  );

  return await Promise.all(all.map((a) => toAuction(ctx, a)));
};

export const getPublishedAuctions = query({
  args: {},
  returns: v.array(AuctionValidator),
  handler: getPublishedAuctionsHandler,
});

/**
 * Returns a single published or closed auction container together with its
 * lots, for the public container-detail page. Draft containers are never
 * exposed publicly.
 *
 * @param ctx - Convex Query context.
 * @param args - Handler arguments.
 * @param args.auctionId - The auction container id.
 * @returns The auction with its lots, or null if missing or still a draft.
 */
export const getPublishedAuctionHandler = async (
  ctx: QueryCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  const auction = await ctx.db.get("auctions", args.auctionId);
  if (!auction || auction.status === "draft") return null;

  const [auctionView, lots] = await Promise.all([
    toAuction(ctx, auction),
    ctx.db
      .query("lots")
      .withIndex("by_auctionId", (q) => q.eq("auctionId", auction._id))
      .collect(),
  ]);

  return {
    ...auctionView,
    lots: await Promise.all(lots.map((lot) => toLotSummary(ctx, lot))),
  };
};

export const getPublishedAuction = query({
  args: { auctionId: v.id("auctions") },
  returns: v.union(AuctionWithLotsValidator, v.null()),
  handler: getPublishedAuctionHandler,
});

/**
 * Returns lots eligible for assignment (status "approved", not yet assigned
 * to any auction) plus the lots currently assigned to the given auction
 * (admin only) — everything an admin needs to manage one auction's roster.
 *
 * @param ctx - Convex Query context.
 * @param args - Handler arguments.
 * @param args.auctionId - The auction container to load assigned lots for.
 * @returns `{ unassigned, assigned }` lot summaries.
 */
export const getAssignmentCandidatesHandler = async (
  ctx: QueryCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  await requireAdmin(ctx);

  const [approvedLots, auctionLots] = await Promise.all([
    ctx.db
      .query("lots")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect(),
    ctx.db
      .query("lots")
      .withIndex("by_auctionId", (q) => q.eq("auctionId", args.auctionId))
      .collect(),
  ]);

  const [unassigned, assigned] = await Promise.all([
    Promise.all(approvedLots.map((lot) => toLotSummary(ctx, lot))),
    Promise.all(auctionLots.map((lot) => toLotSummary(ctx, lot))),
  ]);

  return { unassigned, assigned };
};

export const getAssignmentCandidates = query({
  args: { auctionId: v.id("auctions") },
  returns: v.object({
    unassigned: v.array(LotSummaryValidator),
    assigned: v.array(LotSummaryValidator),
  }),
  handler: getAssignmentCandidatesHandler,
});
