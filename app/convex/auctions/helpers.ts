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

// Shared validator for conditionChecklist
export const ConditionChecklistValidator = v.object({
  engine: v.boolean(),
  hydraulics: v.boolean(),
  tires: v.boolean(),
  serviceHistory: v.boolean(),
  notes: v.optional(v.string()),
});

/**
 * Normalises image references and resolves them to accessible URLs.
 *
 * Accepts either a legacy array of image ids or an object with optional
 * front/engine/cabin/rear/additional fields, applies an optional limit to the
 * `additional` list, and resolves each reference to a public URL.
 *
 * @param images - An array of image ids or an object with image fields; non-object inputs are treated as empty.
 * @param options - Optional settings.
 * @param options.limit - If provided, truncates the `additional` images array to this length.
 * @returns An object with resolved URLs for `front`, `engine`, `cabin`, `rear` (each optional) and an `additional` array of resolved URL strings.
 */
export async function resolveImageUrls(
  storage: QueryCtx["storage"],
  images: unknown,
  options: { limit?: number } = {}
) {
  /**
   * Determines whether a value is a non-empty string suitable as an image ID.
   *
   * @param value - The value to check
   * @returns `true` if the value is a non-empty string, `false` otherwise
   */
  function isValidImageId(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
  }

  // Normalize legacy array format or non-object inputs
  let normalizedImages: RawImages;
  if (Array.isArray(images)) {
    normalizedImages = {
      additional: images.filter(isValidImageId),
    };
  } else if (images && typeof images === "object" && !Array.isArray(images)) {
    const imagesObj = images as Record<string, unknown>;
    const tempRawImages: RawImages = {};

    if (isValidImageId(imagesObj.front)) {
      tempRawImages.front = imagesObj.front;
    }
    if (isValidImageId(imagesObj.engine)) {
      tempRawImages.engine = imagesObj.engine;
    }
    if (isValidImageId(imagesObj.cabin)) {
      tempRawImages.cabin = imagesObj.cabin;
    }
    if (isValidImageId(imagesObj.rear)) {
      tempRawImages.rear = imagesObj.rear;
    }
    if (Array.isArray(imagesObj.additional)) {
      tempRawImages.additional = imagesObj.additional.filter(isValidImageId);
    }
    normalizedImages = tempRawImages;
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

  const [front, engine, cabin, rear] = await Promise.all([
    resolveUrlCached(storage, normalizedImages.front),
    resolveUrlCached(storage, normalizedImages.engine),
    resolveUrlCached(storage, normalizedImages.cabin),
    resolveUrlCached(storage, normalizedImages.rear),
  ]);

  return {
    front,
    engine,
    cabin,
    rear,
    additional: (
      await Promise.all(
        (normalizedImages.additional || []).map((id: string) =>
          resolveUrlCached(storage, id)
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
  startTime: v.optional(v.number()),
  endTime: v.optional(v.number()),
  durationDays: v.optional(v.number()),
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
  conditionChecklist: v.optional(ConditionChecklistValidator),
});

/**
 * Create a compact auction summary for list views.
 *
 * @param ctx - Query context used to resolve image URLs
 * @param auction - Full auction document to convert into a summary
 * @returns An object with selected auction fields and an `images` object whose entries are resolved URLs for `front`, `engine`, `cabin`, `rear` and an `additional` array of resolved URLs
 */
export async function toAuctionSummary(
  ctx: QueryCtx,
  auction: Doc<"auctions">
) {
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
    durationDays: auction.durationDays,
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
  conditionChecklist: v.optional(ConditionChecklistValidator),
  sellerId: v.string(),
  status: v.string(),
  currentPrice: v.number(),
  minIncrement: v.number(),
  startTime: v.optional(v.number()),
  endTime: v.optional(v.number()),
  isExtended: v.optional(v.boolean()),
  winnerId: v.optional(v.string()),
  seedId: v.optional(v.string()),
  conditionReportUrl: v.optional(v.string()),
});

/**
 * Create a full auction object with image references resolved to accessible URLs.
 *
 * @param ctx - Query context providing storage used to resolve image references
 * @param auction - Auction document to convert
 * @returns The same auction object with `images` replaced by an object where `front`, `engine`, `cabin` and `rear` are resolved URL strings when present and `additional` is an array of resolved URL strings
 */
export async function toAuctionDetail(ctx: QueryCtx, auction: Doc<"auctions">) {
  return {
    _id: auction._id,
    _creationTime: auction._creationTime,
    title: auction.title,
    description: auction.description,
    make: auction.make,
    model: auction.model,
    year: auction.year,
    operatingHours: auction.operatingHours,
    location: auction.location,
    startingPrice: auction.startingPrice,
    reservePrice: auction.reservePrice,
    durationDays: auction.durationDays,
    currentPrice: auction.currentPrice,
    minIncrement: auction.minIncrement,
    startTime: auction.startTime,
    endTime: auction.endTime,
    status: auction.status,
    sellerId: auction.sellerId,
    winnerId: auction.winnerId,
    isExtended: auction.isExtended,
    seedId: auction.seedId,
    conditionReportUrl: auction.conditionReportUrl,
    conditionChecklist: auction.conditionChecklist,
    images: await resolveImageUrls(ctx.storage, auction.images),
  };
}
