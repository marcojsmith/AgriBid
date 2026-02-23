import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { resolveUrlCached } from "../image_cache";

export interface RawImages {
  front?: string;
  engine?: string;
  cabin?: string;
  rear?: string;
  additional?: string[];
}

/**
 * Normalises image references and resolves them to accessible URLs.
 */
export async function resolveImageUrls(
  storage: QueryCtx["storage"],
  images: unknown,
  options: { limit?: number } = {}
) {
  // Normalize legacy array format or non-object inputs
  let normalizedImages: RawImages;
  if (Array.isArray(images)) {
    normalizedImages = {
      additional: images.filter((i): i is string => typeof i === "string"),
    };
  } else if (images && typeof images === "object") {
    normalizedImages = { ...(images as RawImages) };
  } else {
    normalizedImages = { additional: [] };
  }

  // Apply limit to additional images if specified
  if (options.limit !== undefined && normalizedImages.additional) {
    normalizedImages.additional = normalizedImages.additional.slice(
      0,
      options.limit
    );
  }

  return {
    ...normalizedImages,
    front: await resolveUrlCached(storage, normalizedImages.front),
    engine: await resolveUrlCached(storage, normalizedImages.engine),
    cabin: await resolveUrlCached(storage, normalizedImages.cabin),
    rear: await resolveUrlCached(storage, normalizedImages.rear),
    additional: (
      await Promise.all(
        (normalizedImages.additional || []).map(async (id: string) =>
          await resolveUrlCached(storage, id)
        )
      )
    ).filter((url: string | undefined): url is string => !!url),
  };
}

/**
 * Validator for a compact auction summary suitable for list views.
 */
export const AuctionSummaryValidator = v.object({
  _id: v.id("auctions"),
  _creationTime: v.number(),
  title: v.string(),
  make: v.string(),
  model: v.string(),
  year: v.number(),
  operatingHours: v.number(),
  location: v.string(),
  reservePrice: v.number(),
  startingPrice: v.number(),
  currentPrice: v.number(),
  minIncrement: v.number(),
  startTime: v.number(),
  endTime: v.number(),
  sellerId: v.string(),
  status: v.string(),
  winnerId: v.optional(v.string()),
  description: v.optional(v.string()),
  conditionReportUrl: v.optional(v.string()),
  isExtended: v.optional(v.boolean()),
  seedId: v.optional(v.string()),
  images: v.object({
    front: v.optional(v.string()),
    engine: v.optional(v.string()),
    cabin: v.optional(v.string()),
    rear: v.optional(v.string()),
    additional: v.array(v.string()),
  }),
  conditionChecklist: v.optional(v.any()),
});

/**
 * Create a compact auction summary suitable for list views.
 */
export async function toAuctionSummary(ctx: QueryCtx, auction: Doc<"auctions">) {
  return {
    _id: auction._id,
    _creationTime: auction._creationTime,
    title: auction.title,
    description: auction.description,
    make: auction.make,
    model: auction.model,
    year: auction.year,
    currentPrice: auction.currentPrice,
    startingPrice: auction.startingPrice,
    minIncrement: auction.minIncrement,
    startTime: auction.startTime,
    endTime: auction.endTime,
    status: auction.status,
    reservePrice: auction.reservePrice,
    operatingHours: auction.operatingHours,
    location: auction.location,
    sellerId: auction.sellerId,
    winnerId: auction.winnerId,
    conditionReportUrl: auction.conditionReportUrl,
    isExtended: auction.isExtended,
    seedId: auction.seedId,
    conditionChecklist: auction.conditionChecklist,
    images: await resolveImageUrls(ctx.storage, auction.images, { limit: 0 }),
  };
}

/**
 * Validator for a full auction document with resolved URLs.
 */
export const AuctionDetailValidator = v.object({
  _id: v.id("auctions"),
  _creationTime: v.number(),
  title: v.string(),
  make: v.string(),
  model: v.string(),
  year: v.number(),
  operatingHours: v.number(),
  location: v.string(),
  description: v.optional(v.string()),
  startingPrice: v.number(),
  reservePrice: v.number(),
  durationDays: v.optional(v.number()),
  images: v.object({
    front: v.optional(v.string()),
    engine: v.optional(v.string()),
    cabin: v.optional(v.string()),
    rear: v.optional(v.string()),
    additional: v.array(v.string()),
  }),
  conditionChecklist: v.optional(
    v.object({
      engine: v.boolean(),
      hydraulics: v.boolean(),
      tires: v.boolean(),
      serviceHistory: v.boolean(),
      notes: v.optional(v.string()),
    })
  ),
  sellerId: v.string(),
  status: v.string(),
  currentPrice: v.number(),
  minIncrement: v.number(),
  startTime: v.number(),
  endTime: v.number(),
  isExtended: v.optional(v.boolean()),
  winnerId: v.optional(v.string()),
  seedId: v.optional(v.string()),
  conditionReportUrl: v.optional(v.string()),
});

/**
 * Resolves full auction details including all image URLs.
 */
export async function toAuctionDetail(ctx: QueryCtx, auction: Doc<"auctions">) {
  return {
    ...auction,
    images: await resolveImageUrls(ctx.storage, auction.images),
  };
}
