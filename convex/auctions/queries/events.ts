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
export const AuctionEventValidator = v.object({
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

/** Raw auction container document shape consumed by {@link toAuctionEvent}. */
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
async function toAuctionEvent(ctx: QueryCtx, auction: AuctionContainerDoc) {
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
 * @returns Array of auction events with resolved banner URLs and lot counts.
 */
export const getAllAuctionEventsHandler = async (ctx: QueryCtx) => {
  await requireAdmin(ctx);

  const auctions = await ctx.db.query("auctions").order("desc").collect();
  return await Promise.all(auctions.map((a) => toAuctionEvent(ctx, a)));
};

export const getAllAuctionEvents = query({
  args: {},
  returns: v.array(AuctionEventValidator),
  handler: getAllAuctionEventsHandler,
});

/**
 * Returns a single auction container by id, with its resolved banner URL and
 * lot count (admin only).
 *
 * @param ctx - Convex Query context.
 * @param args - Handler arguments.
 * @param args.auctionId - The auction container id.
 * @returns The auction event, or null if it doesn't exist.
 */
export const getAuctionEventByIdHandler = async (
  ctx: QueryCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  await requireAdmin(ctx);

  const auction = await ctx.db.get("auctions", args.auctionId);
  if (!auction) return null;
  return await toAuctionEvent(ctx, auction);
};

export const getAuctionEventById = query({
  args: { auctionId: v.id("auctions") },
  returns: v.union(AuctionEventValidator, v.null()),
  handler: getAuctionEventByIdHandler,
});

/**
 * Returns every published auction container (past or present), newest-start
 * first, for the public auction gallery. Draft containers are never exposed
 * publicly.
 *
 * @param ctx - Convex Query context.
 * @returns Array of published/closed auction events with resolved banners.
 */
export const getPublishedAuctionEventsHandler = async (ctx: QueryCtx) => {
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

  return await Promise.all(all.map((a) => toAuctionEvent(ctx, a)));
};

export const getPublishedAuctionEvents = query({
  args: {},
  returns: v.array(AuctionEventValidator),
  handler: getPublishedAuctionEventsHandler,
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
