import { v } from "convex/values";

import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  compareLotsInSale,
  getPublishedAuctionHandler,
  pickLeadImageRef,
} from "./auctions/queries/events";
import { EVENT_LOTS_READ_PER_STATUS } from "./constants";
import { listLiveAuctions, mostEngagedLotDocs } from "./engagement";
import { resolveUrlCached } from "./image_cache";
import {
  SALE_VISIBLE_STATUSES,
  getAuctionLotCount,
  getBidCount,
} from "./lib/lotCounters";
import { PROVINCE_LABELS } from "./lib/provinces";
import { lotPlace } from "../src/lib/lotPlace";

/** Most photos a sale's share image shows. */
const SALE_SHARE_IMAGES = 3;

/** Lots read when a sale's counter is missing or a closed sale is ranked. */
const SHARE_LOT_READ_CAP = EVENT_LOTS_READ_PER_STATUS;

/**
 * Resolves lead photos of lots in order, skipping lots with no usable photo.
 *
 * @param ctx - Query context
 * @param lots - Lots in preference order
 * @param max - Most URLs to return
 * @param skip - Lot ids already used
 * @returns Up to `max` photo URLs
 */
async function leadPhotoUrls(
  ctx: QueryCtx,
  lots: readonly Doc<"lots">[],
  max: number,
  skip: ReadonlySet<Id<"lots">> = new Set()
): Promise<string[]> {
  const urls: string[] = [];
  for (const lot of lots) {
    if (urls.length >= max) break;
    if (skip.has(lot._id)) continue;
    const ref = pickLeadImageRef(lot.images);
    const url = ref ? await resolveUrlCached(ctx.storage, ref) : undefined;
    if (url) urls.push(url);
  }
  return urls;
}

/**
 * The visible, unhidden assigned lots of a sale in lot-number order.
 *
 * @param ctx - Query context
 * @param auctionId - The sale
 * @returns Lots sorted by lot number then creation time
 */
async function assignedLotsInOrder(
  ctx: QueryCtx,
  auctionId: Id<"auctions">
): Promise<Doc<"lots">[]> {
  const rows = await ctx.db
    .query("lots")
    .withIndex("by_status_auctionId", (q) =>
      q.eq("status", "assigned").eq("auctionId", auctionId)
    )
    .take(SHARE_LOT_READ_CAP);
  return rows
    .filter((lot) => lot.hiddenByFlags !== true)
    .sort(compareLotsInSale);
}

/**
 * A sale's exact visible lot count, with a bounded read as the fallback when
 * its counter does not exist yet.
 *
 * @param ctx - Query context
 * @param auctionId - The sale
 * @returns The lot count
 */
async function saleLotCount(
  ctx: QueryCtx,
  auctionId: Id<"auctions">
): Promise<number> {
  const counted = await getAuctionLotCount(ctx, auctionId);
  if (counted !== null) return counted;
  let total = 0;
  for (const status of SALE_VISIBLE_STATUSES) {
    const rows = await ctx.db
      .query("lots")
      .withIndex("by_status_auctionId", (q) =>
        q.eq("status", status).eq("auctionId", auctionId)
      )
      .take(SHARE_LOT_READ_CAP);
    total += rows.filter((lot) => lot.hiddenByFlags !== true).length;
  }
  return total;
}

/**
 * Up to `max` photos for a live or upcoming sale: its most engaged lots first,
 * topped up from assigned lots in lot-number order.
 *
 * @param ctx - Query context
 * @param auctionId - The sale
 * @param max - Most photos wanted
 * @returns Photo URLs
 */
async function openSalePhotos(
  ctx: QueryCtx,
  auctionId: Id<"auctions">,
  max: number
): Promise<string[]> {
  const engaged = await mostEngagedLotDocs(ctx, auctionId, SALE_SHARE_IMAGES);
  const urls = await leadPhotoUrls(
    ctx,
    engaged.map((entry) => entry.lot),
    max
  );
  if (urls.length >= max) return urls;
  const used = new Set(engaged.map((entry) => entry.lot._id));
  const rest = await leadPhotoUrls(
    ctx,
    await assignedLotsInOrder(ctx, auctionId),
    max - urls.length,
    used
  );
  return [...urls, ...rest];
}

const lotShareValidator = v.object({
  make: v.string(),
  model: v.string(),
  title: v.string(),
  lotNumber: v.optional(v.number()),
  status: v.union(
    v.literal("assigned"),
    v.literal("under_consideration"),
    v.literal("sold"),
    v.literal("unsold")
  ),
  startingPrice: v.number(),
  currentPrice: v.number(),
  bidCount: v.number(),
  place: v.string(),
  auctionStartTime: v.optional(v.number()),
  closeTime: v.optional(v.number()),
  imageUrl: v.optional(v.string()),
});

/**
 * Public: the few fields a lot's link preview needs. Never returns the
 * reserve price, seller, winner or bidders. Null for anything not visible in
 * a published or closed sale.
 */
export const getLotShare = query({
  args: { lotId: v.id("lots") },
  returns: v.union(v.null(), lotShareValidator),
  handler: async (ctx, args) => {
    const lot = await ctx.db.get("lots", args.lotId);
    if (!lot || lot.hiddenByFlags === true || lot.auctionId === undefined) {
      return null;
    }
    const status = SALE_VISIBLE_STATUSES.find((s) => s === lot.status);
    if (!status) return null;
    const auction = await ctx.db.get("auctions", lot.auctionId);
    if (!auction || auction.status === "draft") return null;

    const ref = pickLeadImageRef(lot.images);
    const [bidCount, imageUrl] = await Promise.all([
      getBidCount(ctx, lot._id),
      ref ? resolveUrlCached(ctx.storage, ref) : undefined,
    ]);
    const province = lot.province ? PROVINCE_LABELS[lot.province] : undefined;
    return {
      make: lot.make,
      model: lot.model,
      title: lot.title,
      lotNumber: lot.lotNumber,
      status,
      startingPrice: lot.startingPrice,
      currentPrice: lot.currentPrice,
      bidCount,
      place: lotPlace(lot.location, province),
      auctionStartTime: auction.startTime,
      closeTime: lot.extendedEndTime ?? auction.endTime,
      imageUrl,
    };
  },
});

/**
 * Public: what a sale's link preview needs. Null for a missing or draft sale.
 */
export const getSaleShare = query({
  args: { auctionId: v.id("auctions") },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      status: v.union(v.literal("published"), v.literal("closed")),
      startTime: v.number(),
      effectiveEndTime: v.number(),
      lotCount: v.number(),
      soldCount: v.optional(v.number()),
      imageUrls: v.array(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const header = await getPublishedAuctionHandler(ctx, args);
    if (!header) return null;
    const lotCount = await saleLotCount(ctx, header._id);

    if (header.status === "published") {
      return {
        title: header.title,
        status: "published" as const,
        startTime: header.startTime,
        effectiveEndTime: header.effectiveEndTime,
        lotCount,
        imageUrls: await openSalePhotos(ctx, header._id, SALE_SHARE_IMAGES),
      };
    }

    // A closed sale's engagement scores are deleted: show its dearest sales.
    const sold = (
      await ctx.db
        .query("lots")
        .withIndex("by_status_auctionId", (q) =>
          q.eq("status", "sold").eq("auctionId", header._id)
        )
        .take(SHARE_LOT_READ_CAP)
    ).filter((lot) => lot.hiddenByFlags !== true);
    const ranked = [...sold].sort(
      (a, b) => b.currentPrice - a.currentPrice || compareLotsInSale(a, b)
    );
    return {
      title: header.title,
      status: "closed" as const,
      startTime: header.startTime,
      effectiveEndTime: header.effectiveEndTime,
      lotCount,
      soldCount: sold.length,
      imageUrls: await leadPhotoUrls(ctx, ranked, SALE_SHARE_IMAGES),
    };
  },
});

/**
 * Public: what the home page's link preview needs: the live sale that ends
 * soonest, else the next upcoming one. `now` is rounded to the minute by the
 * caller so the result can be cached. Null when no sale is published.
 */
export const getHomeShare = query({
  args: { now: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      phase: v.union(v.literal("live"), v.literal("upcoming")),
      startTime: v.number(),
      effectiveEndTime: v.number(),
      lotCount: v.number(),
      imageUrl: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const live = (await listLiveAuctions(ctx, args.now))[0];
    const auction =
      live ??
      (await ctx.db
        .query("auctions")
        .withIndex("by_status_startTime", (q) =>
          q.eq("status", "published").gt("startTime", args.now)
        )
        .first());
    if (!auction) return null;
    const header = await getPublishedAuctionHandler(ctx, {
      auctionId: auction._id,
    });
    if (!header) return null;
    const [lotCount, photos] = await Promise.all([
      saleLotCount(ctx, auction._id),
      openSalePhotos(ctx, auction._id, 1),
    ]);
    return {
      title: header.title,
      phase: live ? ("live" as const) : ("upcoming" as const),
      startTime: header.startTime,
      effectiveEndTime: header.effectiveEndTime,
      lotCount,
      imageUrl: photos[0],
    };
  },
});
