import { v } from "convex/values";

import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getBuyerPremiumPct } from "../admin/platformSettings";
import { resolveUrlCached } from "../image_cache";
import { getAuthWithProfile } from "../lib/auth";
import {
  isBuyerPercentageFee,
  percentToFraction,
  resolveBuyerPremium,
} from "../lib/buyerPremium";
import { getBidCount, getWatcherCount } from "../lib/lotCounters";
import { reserveStateOf } from "../lib/reserve";
import { provinceValidator } from "../lib/provinces";
import { resolveLotSellerVat } from "../lib/sellerVat";
import {
  driveValidator,
  imageAnglesValidator,
  photoAngleValidator,
  PHOTO_ANGLES,
  SELLER_TYPE_LABELS,
  type PhotoAngle,
} from "../lib/lotSpecs";

/**
 * Narrows a string to a photo angle.
 *
 * @param value - The stored angle
 * @returns True when it is a known angle
 */
function isPhotoAngle(value: string): value is PhotoAngle {
  return (PHOTO_ANGLES as readonly string[]).includes(value);
}

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

/** One photo of the lot page gallery, with its shot-list angle when known. */
export const LotPhotoValidator = v.object({
  url: v.string(),
  angle: v.optional(photoAngleValidator),
});

/**
 * Resolves a lot's photos in gallery order (front, engine, cabin, rear, then
 * the additional photos), each with its angle caption. The angle map is keyed
 * by storage reference, so the angle is looked up before the reference is
 * turned into a URL.
 *
 * @param storage - Convex storage context
 * @param images - The lot's stored images (object form or legacy array)
 * @param angles - Map of image reference to angle
 * @returns Photos whose URL resolved, in order
 */
export async function resolveLotPhotos(
  storage: QueryCtx["storage"],
  images: unknown,
  angles: Record<string, string> | undefined
) {
  const refs: string[] = [];
  if (Array.isArray(images)) {
    refs.push(...images);
  } else if (images && typeof images === "object") {
    const o = images as RawImages;
    refs.push(o.front ?? "", o.engine ?? "", o.cabin ?? "", o.rear ?? "");
    refs.push(...(o.additional ?? []));
  }
  const valid = refs.filter(
    (r): r is string => typeof r === "string" && r !== ""
  );
  const urls = await Promise.all(
    valid.map((r) => resolveUrlCached(storage, r))
  );
  const photos: { url: string; angle?: PhotoAngle }[] = [];
  valid.forEach((ref, i) => {
    const url = urls[i];
    if (!url) return;
    const angle = angles?.[ref];
    photos.push(angle && isPhotoAngle(angle) ? { url, angle } : { url });
  });
  return photos;
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
  lotNumber: v.optional(v.number()),
  province: v.optional(provinceValidator),
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
 * @param preloaded - Optional preloaded lookups for batch processing
 * @param preloaded.categories - Map of category id to category document
 * @param preloaded.auctions - Map of auction id to auction document
 * @returns An object with selected lot fields, the parent auction's window, and an `images` object whose entries are resolved URLs for `front`, `engine`, `cabin`, `rear` and an `additional` array of resolved URLs
 */
export async function toLotSummary(
  ctx: QueryCtx,
  lot: Doc<"lots">,
  preloaded?: {
    categories: Map<
      Id<"equipmentCategories">,
      Doc<"equipmentCategories"> | null
    >;
    auctions: Map<Id<"auctions">, Doc<"auctions"> | null>;
  }
) {
  const [category, auction] = await Promise.all([
    lot.categoryId
      ? (preloaded?.categories.get(lot.categoryId) ??
        ctx.db.get("equipmentCategories", lot.categoryId))
      : null,
    lot.auctionId
      ? (preloaded?.auctions.get(lot.auctionId) ??
        ctx.db.get("auctions", lot.auctionId))
      : null,
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
    lotNumber: lot.lotNumber,
    province: lot.province,
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
 * Batch-convert lots to summaries with preloaded lookups.
 *
 * Loads all unique category and auction IDs once using `Promise.all`,
 * then converts each lot using the preloaded maps. This avoids N+1 reads
 * when converting a list of lots.
 *
 * @param ctx - Query context
 * @param lots - Array of lot documents to convert
 * @returns Array of lot summaries in the same order as input
 */
export async function toLotSummaries(
  ctx: QueryCtx,
  lots: Doc<"lots">[]
): Promise<Awaited<ReturnType<typeof toLotSummary>>[]> {
  const categoryIds = new Set<Id<"equipmentCategories">>();
  const auctionIds = new Set<Id<"auctions">>();

  for (const lot of lots) {
    if (lot.categoryId) categoryIds.add(lot.categoryId);
    if (lot.auctionId) auctionIds.add(lot.auctionId);
  }

  const [categoryDocs, auctionDocs] = await Promise.all([
    Promise.all(
      Array.from(categoryIds, (id) => ctx.db.get("equipmentCategories", id))
    ),
    Promise.all(Array.from(auctionIds, (id) => ctx.db.get("auctions", id))),
  ]);

  const categories = new Map<
    Id<"equipmentCategories">,
    Doc<"equipmentCategories"> | null
  >();
  const auctions = new Map<Id<"auctions">, Doc<"auctions"> | null>();

  const categoryIdArray = Array.from(categoryIds);
  for (let i = 0; i < categoryIdArray.length; i++) {
    categories.set(categoryIdArray[i], categoryDocs[i] ?? null);
  }

  const auctionIdArray = Array.from(auctionIds);
  for (let i = 0; i < auctionIdArray.length; i++) {
    auctions.set(auctionIdArray[i], auctionDocs[i] ?? null);
  }

  return Promise.all(
    lots.map((lot) => toLotSummary(ctx, lot, { categories, auctions }))
  );
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
  /** Only for the seller and admins; buyers see `reserveState`. */
  reservePrice: v.optional(v.number()),
  reserveState: v.union(
    v.literal("none"),
    v.literal("applies"),
    v.literal("met"),
    v.literal("not_met")
  ),
  bidCount: v.number(),
  /** Buyer's premium for this lot as a fraction (0.12 = 12%). */
  buyerPremiumFraction: v.number(),
  isSeller: v.boolean(),
  isWinner: v.boolean(),
  durationDays: v.optional(v.number()),
  images: v.object({
    front: v.optional(v.string()),
    engine: v.optional(v.string()),
    cabin: v.optional(v.string()),
    rear: v.optional(v.string()),
    additional: v.array(v.string()),
  }),
  conditionChecklist: v.optional(ConditionChecklistValidator),
  status: v.string(),
  currentPrice: v.number(),
  minIncrement: v.number(),
  auctionId: v.optional(v.id("auctions")),
  lotNumber: v.optional(v.number()),
  province: v.optional(provinceValidator),
  watcherCount: v.number(),
  auctionStartTime: v.optional(v.number()),
  auctionEndTime: v.optional(v.number()),
  auctionStatus: v.optional(
    v.union(v.literal("draft"), v.literal("published"), v.literal("closed"))
  ),
  extendedEndTime: v.optional(v.number()),
  isExtended: v.optional(v.boolean()),
  seedId: v.optional(v.string()),
  conditionReportUrl: v.optional(v.string()),
  powerKw: v.optional(v.number()),
  drive: v.optional(driveValidator),
  transmission: v.optional(v.string()),
  frontTyrePct: v.optional(v.number()),
  rearTyrePct: v.optional(v.number()),
  serialNumber: v.optional(v.string()),
  imageAngles: v.optional(imageAnglesValidator),
  photos: v.array(LotPhotoValidator),
  coldStartVideoUrl: v.optional(v.string()),
  sellerVatKind: v.union(v.literal("vat"), v.literal("private")),
  sellerTypeLabel: v.optional(v.string()),
});

/**
 * The buyer premium (as a fraction) that settlement charges when it comes from
 * the active buyer percentage fee rows: their sum. Falls back to the platform
 * default when no such row is active.
 *
 * @param ctx - Query context
 * @returns The premium as a fraction (0.12 = 12%)
 */
async function activeBuyerPremiumFraction(ctx: QueryCtx): Promise<number> {
  const fees = await ctx.db
    .query("platformFees")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();
  const rows = fees.filter(isBuyerPercentageFee);
  if (rows.length === 0) {
    return percentToFraction(await getBuyerPremiumPct(ctx));
  }
  return percentToFraction(rows.reduce((sum, fee) => sum + fee.value, 0));
}

/**
 * Create a full lot object with image references resolved to accessible URLs.
 * Seller and winner ids are never returned: the caller gets `isSeller` and
 * `isWinner` booleans, and `reservePrice` only when they are the seller or an
 * admin (everyone else gets `reserveState`). The parent auction's window is
 * included alongside the resolved image URLs.
 *
 * @param ctx - Query context providing storage used to resolve image references
 * @param lot - Lot document to convert
 * @returns The same lot object with resolved images, seller details, and parent auction window.
 */
export async function toLotDetail(ctx: QueryCtx, lot: Doc<"lots">) {
  const [sellerProfile, category, viewer, auction, watcherCount, bidCount] =
    await Promise.all([
      ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", lot.sellerId))
        .unique(),
      lot.categoryId
        ? ctx.db.get("equipmentCategories", lot.categoryId)
        : Promise.resolve(null),
      getAuthWithProfile(ctx),
      lot.auctionId
        ? ctx.db.get("auctions", lot.auctionId)
        : Promise.resolve(null),
      getWatcherCount(ctx, lot._id),
      getBidCount(ctx, lot._id),
    ]);
  // Ids are stored under either the profile user id or the auth user id.
  const viewerIds = viewer ? [viewer.userId, viewer.authUser._id] : [];
  const isSeller = viewerIds.includes(lot.sellerId);
  const isWinner = lot.winnerId != null && viewerIds.includes(lot.winnerId);
  const canSeeReserve = isSeller || viewer?.profile?.role === "admin";
  const premium = await resolveBuyerPremium(ctx, lot);
  const buyerPremiumFraction =
    premium.rate ?? (await activeBuyerPremiumFraction(ctx));
  const sellerVat = resolveLotSellerVat(lot, sellerProfile);
  const coldStartVideoUrl = lot.coldStartVideo
    ? ((await ctx.storage.getUrl(lot.coldStartVideo)) ?? undefined)
    : undefined;

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
    reservePrice: canSeeReserve ? lot.reservePrice : undefined,
    reserveState: reserveStateOf(lot, bidCount),
    bidCount,
    buyerPremiumFraction,
    isSeller,
    isWinner,
    durationDays: lot.durationDays,
    currentPrice: lot.currentPrice,
    minIncrement: lot.minIncrement,
    auctionId: lot.auctionId,
    lotNumber: lot.lotNumber,
    province: lot.province,
    watcherCount,
    auctionStartTime: auction?.startTime,
    auctionEndTime: auction?.endTime,
    auctionStatus: auction?.status,
    extendedEndTime: lot.extendedEndTime,
    status: lot.status,
    isExtended: lot.isExtended,
    seedId: lot.seedId,
    conditionReportUrl: lot.conditionReportUrl,
    conditionChecklist: lot.conditionChecklist,
    powerKw: lot.powerKw,
    drive: lot.drive,
    transmission: lot.transmission,
    frontTyrePct: lot.frontTyrePct,
    rearTyrePct: lot.rearTyrePct,
    serialNumber: lot.serialNumber,
    imageAngles: lot.imageAngles,
    coldStartVideoUrl,
    sellerVatKind: sellerVat.vatKind,
    sellerTypeLabel: sellerVat.sellerType
      ? SELLER_TYPE_LABELS[sellerVat.sellerType]
      : undefined,
    images: await resolveImageUrls(ctx.storage, lot.images),
    photos: await resolveLotPhotos(ctx.storage, lot.images, lot.imageAngles),
  };
}
