// app/convex/auctions/queries/events.ts
import { v } from "convex/values";
import type { PaginationOptions } from "convex/server";

import { query, paginationOptsValidator, type QueryCtx } from "./shared";
import { LotSummaryValidator, toLotSummaries } from "../helpers";
import { requireAdmin } from "../../lib/auth";
import { parseOffsetCursor } from "../../lib/pagination";
import { resolveUrlCached } from "../../image_cache";
import { countQuery } from "../../admin_utils";
import {
  ADMIN_COLLECTION_CAP,
  AUCTION_SUMMARY_IMAGE_COUNT,
  AUCTION_SUMMARY_LOT_CAP,
  PUBLISHED_AUCTIONS_MAX_PAGE_SIZE,
  PUBLISHED_AUCTIONS_STATUS_CAP,
} from "../../constants";
import type { Doc, Id } from "../../_generated/dataModel";

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
 * The lot count uses `countQuery` (a cheap `count()` on the index) instead of
 * collecting full lot documents.
 *
 * @param ctx - Query context.
 * @param auction - The auction container document.
 * @param knownLotCount - When given, used as the lot count and the index count
 *   is skipped (public feed supplies its buyer-visible count).
 * @returns The auction with a resolved banner URL and lot count.
 */
async function toAuction(
  ctx: QueryCtx,
  auction: AuctionContainerDoc,
  knownLotCount?: number
) {
  const [bannerImageUrl, lotCount] = await Promise.all([
    resolveUrlCached(ctx.storage, auction.bannerImage),
    knownLotCount ??
      countQuery(
        ctx.db
          .query("lots")
          .withIndex("by_auctionId", (q) => q.eq("auctionId", auction._id))
      ),
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
    lotCount,
  };
}

/** Event-card bucket derived from the auction status and window. */
export type AuctionBucket = "live" | "upcoming" | "closed";

/**
 * Validator for a public auction event: the container plus the summary the
 * event cards need. `lotCount` here counts buyer-visible lots only (a lower
 * bound when `lotCountCapped` is true).
 */
export const PublishedAuctionValidator = AuctionValidator.extend({
  lotCountCapped: v.boolean(),
  fromPrice: v.union(v.number(), v.null()),
  leadImageUrls: v.array(v.string()),
  location: v.union(v.string(), v.null()),
  bucket: v.union(
    v.literal("live"),
    v.literal("upcoming"),
    v.literal("closed")
  ),
});

/** Lot statuses buyers can see. */
const PUBLIC_LOT_STATUSES = ["assigned", "sold", "unsold"] as const;

/**
 * Picks one image reference (storage id or absolute URL) to represent a lot:
 * `front`, then `cabin`, `engine`, `rear`, then `additional[0]`. The legacy
 * array format uses its first entry.
 *
 * @param images - The lot's raw `images` value.
 * @returns The chosen reference, or undefined when the lot has no image.
 */
export function pickLeadImageRef(images: Doc<"lots">["images"]) {
  const isRef = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;

  if (Array.isArray(images)) return images.find(isRef);
  return [
    images.front,
    images.cabin,
    images.engine,
    images.rear,
    ...(images.additional?.slice(0, 1) ?? []),
  ].find(isRef);
}

/**
 * Builds the public event summary for one auction: buyer-visible lot count,
 * lowest current price, up to {@link AUCTION_SUMMARY_IMAGE_COUNT} lead photos
 * (one per lot, first lots in the sale), the first lot's location and the
 * live/upcoming/closed bucket.
 *
 * Reads at most {@link AUCTION_SUMMARY_LOT_CAP}+1 lots per public status via
 * `by_status_auctionId`. "First lots" means oldest `_creationTime` (there is no
 * lot number yet).
 *
 * @param ctx - Query context.
 * @param auction - The auction container document.
 * @returns The summary fields to merge into the auction view.
 */
async function summarizeAuction(ctx: QueryCtx, auction: AuctionContainerDoc) {
  const perStatus = await Promise.all(
    PUBLIC_LOT_STATUSES.map((status) =>
      ctx.db
        .query("lots")
        .withIndex("by_status_auctionId", (q) =>
          q.eq("status", status).eq("auctionId", auction._id)
        )
        .take(AUCTION_SUMMARY_LOT_CAP + 1)
    )
  );
  const lotCountCapped = perStatus.some(
    (rows) => rows.length > AUCTION_SUMMARY_LOT_CAP
  );
  const lots = perStatus
    .flatMap((rows) => rows.slice(0, AUCTION_SUMMARY_LOT_CAP))
    .filter((lot) => lot.hiddenByFlags !== true)
    .sort((a, b) => a._creationTime - b._creationTime);

  // Resolve while iterating so a deleted storage file is skipped in favour of
  // the next lot's photo (bounded by the lots read above).
  const leadImageUrls: string[] = [];
  for (const lot of lots) {
    if (leadImageUrls.length >= AUCTION_SUMMARY_IMAGE_COUNT) break;
    const ref = pickLeadImageRef(lot.images);
    const url = ref ? await resolveUrlCached(ctx.storage, ref) : undefined;
    if (url) leadImageUrls.push(url);
  }

  const now = Date.now();
  const effectiveEnd = lots.reduce(
    (end, lot) => Math.max(end, lot.extendedEndTime ?? 0),
    auction.endTime
  );
  let bucket: AuctionBucket = "closed";
  if (auction.status === "published") {
    if (now < auction.startTime) bucket = "upcoming";
    else if (now < effectiveEnd) bucket = "live";
  }

  // On an open sale, "from" prices only lots still open for bidding; settled
  // lots (sold/unsold) only count when nothing is still assigned. When
  // `lotCountCapped` is true this is a bound over the lots read, not exact.
  const firstLot: Doc<"lots"> | undefined =
    lots.length > 0 ? lots[0] : undefined;
  const assignedLots = lots.filter((lot) => lot.status === "assigned");
  const pricedLots =
    bucket !== "closed" && assignedLots.length > 0 ? assignedLots : lots;

  return {
    lotCount: lots.length,
    lotCountCapped,
    fromPrice: pricedLots.length
      ? Math.min(...pricedLots.map((lot) => lot.currentPrice))
      : null,
    leadImageUrls,
    location: firstLot ? firstLot.location : null,
    bucket,
  };
}

/**
 * Returns every auction container, newest first (admin only), capped at
 * {@link ADMIN_COLLECTION_CAP} so the admin listing can't blow up as the
 * table grows.
 *
 * @param ctx - Convex Query context.
 * @returns Array of auctions with resolved banner URLs and lot counts.
 */
export const getAllAuctionsHandler = async (ctx: QueryCtx) => {
  await requireAdmin(ctx);

  const auctions = await ctx.db
    .query("auctions")
    .order("desc")
    .take(ADMIN_COLLECTION_CAP);
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
 * Returns a paginated page of published/closed auction containers, newest
 * start first, for the public auction gallery. Draft containers are never
 * exposed publicly.
 *
 * When `status` is provided, filters server-side:
 * - `"active"`: only `status: "published"` auctions
 * - `"closed"`: only `status: "closed"` auctions
 * - `"all"` (default): both published and closed merged by startTime
 *
 * Results are a union of two indexes (`by_status`) merged and re-sorted by
 * `startTime`, so a true cross-index cursor isn't feasible without a bigger
 * redesign. Instead each status side is capped at
 * {@link PUBLISHED_AUCTIONS_STATUS_CAP} before merging, and pagination is a
 * manual offset cursor over the merged, sorted list.
 *
 * @param ctx - Convex Query context.
 * @param args - Handler arguments.
 * @param args.paginationOpts - Pagination options (numItems and cursor).
 * @param args.status - Optional status filter (`"active"` | `"closed"` | `"all"`).
 * @returns Standard pagination result: `{ page, isDone, continueCursor }`.
 */
export const getPublishedAuctionsHandler = async (
  ctx: QueryCtx,
  args: {
    paginationOpts: PaginationOptions;
    status?: "active" | "closed" | "all";
  }
) => {
  const statusFilter = args.status ?? "all";

  let published: AuctionContainerDoc[] = [];
  let closed: AuctionContainerDoc[] = [];

  if (statusFilter === "active" || statusFilter === "all") {
    published = await ctx.db
      .query("auctions")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .take(PUBLISHED_AUCTIONS_STATUS_CAP);
  }

  if (statusFilter === "closed" || statusFilter === "all") {
    closed = await ctx.db
      .query("auctions")
      .withIndex("by_status", (q) => q.eq("status", "closed"))
      .order("desc")
      .take(PUBLISHED_AUCTIONS_STATUS_CAP);
  }

  const all = [...published, ...closed].sort(
    (a, b) => b.startTime - a.startTime
  );

  // Each event reads up to 3 x (cap+1) lots, so the page size is clamped.
  const numItems = Math.min(
    args.paginationOpts.numItems,
    PUBLISHED_AUCTIONS_MAX_PAGE_SIZE
  );
  const startIndex = parseOffsetCursor(args.paginationOpts.cursor);

  const paginatedSlice = all.slice(startIndex, startIndex + numItems);
  const page = await Promise.all(
    paginatedSlice.map(async (auction) => {
      const summary = await summarizeAuction(ctx, auction);
      // The buyer-visible lotCount replaces the all-lots index count.
      const view = await toAuction(ctx, auction, summary.lotCount);
      return { ...view, ...summary };
    })
  );

  const nextIndex = startIndex + numItems;
  const isDone = all.length <= nextIndex;

  return {
    page,
    isDone,
    continueCursor: isDone ? "" : nextIndex.toString(),
  };
};

export const getPublishedAuctions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(v.literal("active"), v.literal("closed"), v.literal("all"))
    ),
  },
  returns: v.object({
    page: v.array(PublishedAuctionValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
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
    lots: await toLotSummaries(ctx, lots),
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

  // The approved-lots bucket is an admin moderation queue that would
  // otherwise grow unbounded; cap it and keep the assignment scan precise.
  const [approvedLots, auctionLots] = await Promise.all([
    ctx.db
      .query("lots")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .take(ADMIN_COLLECTION_CAP),
    ctx.db
      .query("lots")
      .withIndex("by_auctionId", (q) => q.eq("auctionId", args.auctionId))
      .collect(),
  ]);

  const [unassigned, assigned] = await Promise.all([
    toLotSummaries(ctx, approvedLots),
    toLotSummaries(ctx, auctionLots),
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
