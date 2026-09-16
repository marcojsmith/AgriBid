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
 * @param storage - Convex storage context
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
        (normalizedImages.additional ?? []).map((id: string) =>
          resolveUrlCached(storage, id)
        )
      )
    ).filter((url: string | undefined): url is string => !!url),
  };
}

/**
 * Validator for a compact lot summary suitable for list views.
 *
 * The legacy `startTime`/`endTime` fields are the lot's own (superseded)
 * timestamps kept for backward compatibility. The canonical live window lives
 * on the parent auction and is surfaced as `auctionStartTime`/`auctionEndTime`
 * (plus `auctionStatus`), with `extendedEndTime` carrying any per-lot soft-close
 * extension so the effective end is `extendedEndTime ?? auctionEndTime`.
 */
export const LotSummaryValidator = v.object({
  _id: v.id("lots"),
  _creationTime: v.number(),
  title: v.string(),
  make: v.string(),
  model: v.string(),
  year: v.number(),
  operatingHours: v.number(),
  location: v.string(),
  categoryId: v.optional(v.id("equipmentCategories")),
  categoryName: v.string(),
  reservePrice: v.number(),
  startingPrice: v.number(),
  currentPrice: v.number(),
  minIncrement: v.number(),
  durationDays: v.optional(v.number()),
  sellerId: v.string(),
  status: v.string(),
  auctionId: v.optional(v.id("auctions")),
  auctionStartTime: v.optional(v.number()),
  auctionEndTime: v.optional(v.number()),
  auctionStatus: v.optional(
    v.union(v.literal("draft"), v.literal("published"), v.literal("closed"))
  ),
  extendedEndTime: v.optional(v.number()),
  winnerId: v.optional(v.union(v.string(), v.null())),
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
 * Validator for a bid object, including enriched bidder name.
 */
export const BidValidator = v.object({
  _id: v.id("bids"),
  _creationTime: v.number(),
  lotId: v.id("lots"),
  bidderId: v.string(),
  amount: v.number(),
  timestamp: v.number(),
  status: v.optional(v.union(v.literal("valid"), v.literal("voided"))),
  bidderName: v.string(),
});

/**
 * Create a compact lot summary for list views.
 *
 * Resolves image references into accessible URLs and selects only the necessary
 * fields required for displaying a lot in a list or grid view. Also resolves
 * the parent auction (if assigned) so the effective live window can be rendered
 * without a second round-trip per card.
 *
 * @param ctx - Query context used to resolve image URLs and the parent auction
 * @param lot - Full lot document to convert into a summary
 * @returns An object with selected lot fields, the parent auction's window, and an `images` object whose entries are resolved URLs for `front`, `engine`, `cabin`, `rear` and an `additional` array of resolved URLs
 */
export async function toLotSummary(ctx: QueryCtx, lot: Doc<"lots">) {
  const [category, auction] = await Promise.all([
    lot.categoryId
      ? ctx.db.get("equipmentCategories", lot.categoryId)
      : Promise.resolve(null),
    lot.auctionId
      ? ctx.db.get("auctions", lot.auctionId)
      : Promise.resolve(null),
  ]);

  return {
    _id: lot._id,
    _creationTime: lot._creationTime,
    title: lot.title,
    description: lot.description,
    make: lot.make,
    model: lot.model,
    year: lot.year,
    currentPrice: lot.currentPrice,
    startingPrice: lot.startingPrice,
    minIncrement: lot.minIncrement,
    durationDays: lot.durationDays,
    status: lot.status,
    auctionId: lot.auctionId,
    auctionStartTime: auction?.startTime,
    auctionEndTime: auction?.endTime,
    auctionStatus: auction?.status,
    extendedEndTime: lot.extendedEndTime,
    reservePrice: lot.reservePrice,
    operatingHours: lot.operatingHours,
    location: lot.location,
    categoryId: lot.categoryId,
    // Intentionally `||` not `??`: an empty string category name also means "no category"
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- see comment above
    categoryName: category?.name || "Unknown",
    sellerId: lot.sellerId,
    winnerId: lot.winnerId,
    conditionReportUrl: lot.conditionReportUrl,
    isExtended: lot.isExtended,
    seedId: lot.seedId,
    conditionChecklist: lot.conditionChecklist,
    images: await resolveImageUrls(ctx.storage, lot.images, { limit: 0 }),
  };
}

/**
 * Validator for a full lot document with resolved URLs.
 */
export const LotDetailValidator = v.object({
  _id: v.id("lots"),
  _creationTime: v.number(),
  title: v.string(),
  make: v.string(),
  model: v.string(),
  year: v.number(),
  operatingHours: v.number(),
  location: v.string(),
  categoryId: v.optional(v.id("equipmentCategories")),
  categoryName: v.string(),
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
  sellerEmail: v.optional(v.string()),
  status: v.string(),
  currentPrice: v.number(),
  minIncrement: v.number(),
  auctionId: v.optional(v.id("auctions")),
  auctionStartTime: v.optional(v.number()),
  auctionEndTime: v.optional(v.number()),
  auctionStatus: v.optional(
    v.union(v.literal("draft"), v.literal("published"), v.literal("closed"))
  ),
  extendedEndTime: v.optional(v.number()),
  isExtended: v.optional(v.boolean()),
  winnerId: v.optional(v.union(v.string(), v.null())),
  seedId: v.optional(v.string()),
  conditionReportUrl: v.optional(v.string()),
});

/**
 * Create a full lot object with image references resolved to accessible URLs.
 * The returned object includes a sellerEmail string (resolved from the seller lookup)
 * and the parent auction's window, in addition to the described images transformation.
 *
 * @param ctx - Query context providing storage used to resolve image references
 * @param lot - Lot document to convert
 * @returns The same lot object with resolved images, seller details, and parent auction window.
 * sellerEmail may be undefined if no seller is found.
 */
export async function toLotDetail(ctx: QueryCtx, lot: Doc<"lots">) {
  const [sellerProfile, category, identity, auction] = await Promise.all([
    ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", lot.sellerId))
      .unique(),
    lot.categoryId
      ? ctx.db.get("equipmentCategories", lot.categoryId)
      : Promise.resolve(null),
    ctx.auth.getUserIdentity(),
    lot.auctionId
      ? ctx.db.get("auctions", lot.auctionId)
      : Promise.resolve(null),
  ]);
  const isAuthenticated = identity !== null;

  return {
    _id: lot._id,
    _creationTime: lot._creationTime,
    title: lot.title,
    description: lot.description,
    make: lot.make,
    model: lot.model,
    year: lot.year,
    operatingHours: lot.operatingHours,
    location: lot.location,
    categoryId: lot.categoryId,
    // Intentionally `||` not `??`: an empty string category name also means "no category"
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- see comment above
    categoryName: category?.name || "Unknown",
    startingPrice: lot.startingPrice,
    reservePrice: lot.reservePrice,
    durationDays: lot.durationDays,
    currentPrice: lot.currentPrice,
    minIncrement: lot.minIncrement,
    auctionId: lot.auctionId,
    auctionStartTime: auction?.startTime,
    auctionEndTime: auction?.endTime,
    auctionStatus: auction?.status,
    extendedEndTime: lot.extendedEndTime,
    status: lot.status,
    sellerId: lot.sellerId,
    sellerEmail: isAuthenticated
      ? (sellerProfile?.email ?? undefined)
      : undefined,
    winnerId: lot.winnerId,
    isExtended: lot.isExtended,
    seedId: lot.seedId,
    conditionReportUrl: lot.conditionReportUrl,
    conditionChecklist: lot.conditionChecklist,
    images: await resolveImageUrls(ctx.storage, lot.images),
  };
}
