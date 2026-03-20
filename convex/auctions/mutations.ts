import { v, ConvexError } from "convex/values";

import { mutation } from "../_generated/server";
import {
  requireAdmin,
  requireAuth,
  requireVerified,
  getCallerRole,
  getAuthenticatedUserId,
  getAuthUser,
  resolveUserId,
  UnauthorizedError,
} from "../lib/auth";
import { normalizeImages, deleteAuctionImages } from "../lib/storage";
import { logAudit, updateCounter } from "../admin_utils";
import { validateAuctionStatus } from "./helpers";
import {
  MAX_ADDITIONAL_IMAGES,
  AUCTION_MIN_DURATION_DAYS,
  AUCTION_MAX_DURATION_DAYS,
  PRICE_THRESHOLD_FOR_INCREMENT,
  SMALL_INCREMENT_AMOUNT,
  LARGE_INCREMENT_AMOUNT,
  AUCTION_FLAG_AUTO_HIDE_THRESHOLD,
  MAX_BULK_UPDATE_SIZE,
  AUCTION_DEFAULT_DURATION_DAYS,
  MS_PER_DAY,
} from "../constants";
import type { Id, Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const EDITABLE_STATUSES = ["draft", "pending_review"] as const;
type EditableStatus = (typeof EDITABLE_STATUSES)[number];

/**
 * Result type for closeAuctionEarly mutation.
 */
interface EarlyClosureResult {
  success: boolean;
  finalStatus: string;
  winnerId?: string;
  winningAmount?: number;
  error?: string;
}

/**
 * Interface for auction update data to ensure type safety.
 */
interface AuctionUpdates {
  title?: string;
  categoryId?: Id<"equipmentCategories">;
  make?: string;
  model?: string;
  year?: number;
  operatingHours?: number;
  location?: string;
  description?: string;
  startingPrice?: number;
  reservePrice?: number;
  durationDays?: number;
  images?: {
    front?: string;
    engine?: string;
    cabin?: string;
    rear?: string;
    additional?: string[];
  };
  conditionChecklist?: {
    engine: boolean;
    hydraulics: boolean;
    tires: boolean;
    serviceHistory: boolean;
    notes?: string;
  };
  // Derived or internal fields that might be updated internally
  currentPrice?: number;
  minIncrement?: number;
}

/**
 * Ensures an auction can be edited (must be in draft or pending_review).
 * @param auction - The auction document to check.
 */
function assertEditable(auction: Doc<"auctions">): void {
  if (!EDITABLE_STATUSES.includes(auction.status as EditableStatus)) {
    throw new ConvexError(
      `Only ${EDITABLE_STATUSES.join(" or ")} auctions can be edited`
    );
  }
}

/**
 * Ensures the caller owns the auction.
 * @param auction - The auction document to check.
 * @param userId - The ID of the user to check ownership against.
 */
function assertOwnership(auction: Doc<"auctions">, userId: string): void {
  if (auction.sellerId !== userId) {
    throw new ConvexError("You can only modify your own auctions");
  }
}

/**
 * Checks if a string or array exists and is not empty.
 * @param value - The value to check.
 * @returns True if the value exists and is non-empty.
 */
function isNonEmpty(value: string | string[] | undefined): boolean {
  if (value === undefined) return false;
  return value.length > 0;
}

/**
 * Validates that an auction has all required fields before it can be published.
 *
 * @param auction - The auction document to validate
 * @throws ConvexError if any required field is missing or invalid
 */
function validateAuctionBeforePublish(auction: Doc<"auctions">): void {
  if (!auction.title || auction.title.trim().length === 0) {
    throw new ConvexError("Title is required before publishing");
  }
  if (!auction.description || auction.description.trim().length === 0) {
    throw new ConvexError("Description is required before publishing");
  }
  if (auction.startingPrice <= 0) {
    throw new ConvexError("Starting price must be greater than zero");
  }
  if (auction.reservePrice <= 0) {
    throw new ConvexError("Reserve price must be greater than zero");
  }

  const hasImages = Array.isArray(auction.images)
    ? auction.images.length > 0
    : isNonEmpty(auction.images.front) ||
      isNonEmpty(auction.images.engine) ||
      isNonEmpty(auction.images.cabin) ||
      isNonEmpty(auction.images.rear) ||
      isNonEmpty(auction.images.additional);

  if (!hasImages) {
    throw new ConvexError("At least one image is required before submitting");
  }
}

/**
 * Helper to map auction status to its corresponding counter field.
 * @param status - The auction status.
 * @returns The counter field name or undefined.
 */
function getCounterKey(
  status: string
): "active" | "pending" | "draft" | undefined {
  switch (status) {
    case "active":
      return "active";
    case "pending_review":
      return "pending";
    case "draft":
      return "draft";
    default:
      return undefined;
  }
}

/**
 * Update global auction counters when an auction changes status.
 * @param ctx - The mutation context.
 * @param oldStatus - The previous status of the auction.
 * @param newStatus - The new status of the auction.
 */
async function adjustStatusCounters(
  ctx: MutationCtx,
  oldStatus: string,
  newStatus: string
) {
  const oldKey = getCounterKey(oldStatus);
  const newKey = getCounterKey(newStatus);

  if (oldKey) await updateCounter(ctx, "auctions", oldKey, -1);
  if (newKey) await updateCounter(ctx, "auctions", newKey, 1);
}

/**
 * Handler for generating a storage upload URL.
 * @param ctx - The mutation context.
 * @returns Promise<string>
 */
export const generateUploadUrlHandler = async (ctx: MutationCtx) => {
  await requireAuth(ctx);
  return await ctx.storage.generateUploadUrl();
};

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: generateUploadUrlHandler,
});

/**
 * Handler for deleting a storage item.
 * @param ctx - The mutation context.
 * @param args - The arguments for the deletion.
 * @param args.storageId - The ID of the storage item to delete.
 * @returns Promise<null>
 */
export const deleteUploadHandler = async (
  ctx: MutationCtx,
  args: { storageId: Id<"_storage"> }
) => {
  await requireAdmin(ctx);

  const url = await ctx.storage.getUrl(args.storageId);
  if (!url) {
    console.warn(
      `Attempted to delete non-existent storage item: ${args.storageId}`
    );
    return null;
  }

  await ctx.storage.delete(args.storageId);
  return null;
};

export const deleteUpload = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: deleteUploadHandler,
});

/**
 * Handler for creating a new auction.
 * @param ctx - The mutation context.
 * @param args - The arguments for creating an auction.
 * @param args.title - The title of the auction.
 * @param args.categoryId - The ID of the category.
 * @param args.make - The make of the equipment.
 * @param args.model - The model of the equipment.
 * @param args.year - The year of the equipment.
 * @param args.operatingHours - The operating hours.
 * @param args.location - The location of the equipment.
 * @param args.description - The description of the auction.
 * @param args.startingPrice - The starting price.
 * @param args.reservePrice - The reserve price.
 * @param args.durationDays - The duration of the auction in days.
 * @param args.images - The images for the auction.
 * @param args.images.front - The front image.
 * @param args.images.engine - The engine image.
 * @param args.images.cabin - The cabin image.
 * @param args.images.rear - The rear image.
 * @param args.images.additional - Additional images.
 * @param args.conditionChecklist - The condition checklist.
 * @param args.conditionChecklist.engine - Engine condition.
 * @param args.conditionChecklist.hydraulics - Hydraulics condition.
 * @param args.conditionChecklist.tires - Tires condition.
 * @param args.conditionChecklist.serviceHistory - Service history.
 * @param args.conditionChecklist.notes - Additional notes.
 * @param args.isDraft - Whether to create as a draft.
 * @returns Promise<Id<"auctions">>
 */
export const createAuctionHandler = async (
  ctx: MutationCtx,
  args: {
    title: string;
    categoryId: Id<"equipmentCategories">;
    make: string;
    model: string;
    year: number;
    operatingHours: number;
    location: string;
    description: string;
    startingPrice: number;
    reservePrice: number;
    durationDays: number;
    images: {
      front?: string;
      engine?: string;
      cabin?: string;
      rear?: string;
      additional?: string[];
    };
    conditionChecklist: {
      engine: boolean;
      hydraulics: boolean;
      tires: boolean;
      serviceHistory: boolean;
      notes?: string;
    };
    isDraft?: boolean;
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const { durationDays, isDraft, ...restArgs } = args;

  if (
    durationDays < AUCTION_MIN_DURATION_DAYS ||
    durationDays > AUCTION_MAX_DURATION_DAYS
  ) {
    throw new ConvexError(
      `Invalid duration: must be between ${AUCTION_MIN_DURATION_DAYS.toString()} and ${AUCTION_MAX_DURATION_DAYS.toString()} days`
    );
  }

  if (
    restArgs.images.additional &&
    restArgs.images.additional.length > MAX_ADDITIONAL_IMAGES
  ) {
    throw new ConvexError(
      `Additional images limit exceeded (max ${MAX_ADDITIONAL_IMAGES.toString()})`
    );
  }

  // Validate categoryId exists
  const category = await ctx.db.get(args.categoryId);
  if (!category) {
    throw new ConvexError("Invalid categoryId: Category not found");
  }

  const images = normalizeImages(restArgs.images);
  const status = isDraft ? "draft" : "pending_review";

  if (!isDraft) {
    validateAuctionBeforePublish({
      ...restArgs,
      images,
      sellerId: userId,
      status,
      currentPrice: args.startingPrice,
      minIncrement:
        args.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
          ? SMALL_INCREMENT_AMOUNT
          : LARGE_INCREMENT_AMOUNT,
      durationDays: durationDays,
    } as unknown as Doc<"auctions">);
  }

  const auctionId = await ctx.db.insert("auctions", {
    ...restArgs,
    images,
    sellerId: userId,
    status,
    currentPrice: args.startingPrice,
    minIncrement:
      args.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
        ? SMALL_INCREMENT_AMOUNT
        : LARGE_INCREMENT_AMOUNT,
    durationDays: durationDays,
  });

  await updateCounter(ctx, "auctions", "total", 1);
  if (status === "pending_review") {
    await updateCounter(ctx, "auctions", "pending", 1);
  } else {
    await updateCounter(ctx, "auctions", "draft", 1);
  }

  return auctionId;
};

/**
 * Generic auction creation mutation.
 * Supports creating either a draft or a pending_review auction.
 */
export const createAuction = mutation({
  args: {
    title: v.string(),
    categoryId: v.id("equipmentCategories"),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    operatingHours: v.number(),
    location: v.string(),
    description: v.string(),
    startingPrice: v.number(),
    reservePrice: v.number(),
    durationDays: v.number(),
    images: v.object({
      front: v.optional(v.string()),
      engine: v.optional(v.string()),
      cabin: v.optional(v.string()),
      rear: v.optional(v.string()),
      additional: v.optional(v.array(v.string())),
    }),
    conditionChecklist: v.object({
      engine: v.boolean(),
      hydraulics: v.boolean(),
      tires: v.boolean(),
      serviceHistory: v.boolean(),
      notes: v.optional(v.string()),
    }),
    isDraft: v.optional(v.boolean()),
  },
  returns: v.id("auctions"),
  handler: createAuctionHandler,
});

/**
 * Handler for saving a draft auction.
 * @param ctx - The mutation context.
 * @param args - The arguments for saving a draft.
 * @param args.auctionId - The optional ID of the auction to update.
 * @param args.title - The title of the auction.
 * @param args.categoryId - The ID of the category.
 * @param args.make - The make of the equipment.
 * @param args.model - The model of the equipment.
 * @param args.year - The year of the equipment.
 * @param args.operatingHours - The operating hours.
 * @param args.location - The location of the equipment.
 * @param args.description - The description of the auction.
 * @param args.startingPrice - The starting price.
 * @param args.reservePrice - The reserve price.
 * @param args.durationDays - The duration of the auction in days.
 * @param args.images - The images for the auction.
 * @param args.images.front - The front image.
 * @param args.images.engine - The engine image.
 * @param args.images.cabin - The cabin image.
 * @param args.images.rear - The rear image.
 * @param args.images.additional - Additional images.
 * @param args.conditionChecklist - The condition checklist.
 * @param args.conditionChecklist.engine - Engine condition.
 * @param args.conditionChecklist.hydraulics - Hydraulics condition.
 * @param args.conditionChecklist.tires - Tires condition.
 * @param args.conditionChecklist.serviceHistory - Service history.
 * @param args.conditionChecklist.notes - Additional notes.
 * @returns Promise<Id<"auctions">>
 */
export const saveDraftHandler = async (
  ctx: MutationCtx,
  args: {
    auctionId?: string;
    title: string;
    categoryId: Id<"equipmentCategories">;
    make: string;
    model: string;
    year: number;
    operatingHours: number;
    location: string;
    description: string;
    startingPrice: number;
    reservePrice: number;
    durationDays: number;
    images: {
      front?: string;
      engine?: string;
      cabin?: string;
      rear?: string;
      additional?: string[];
    };
    conditionChecklist: {
      engine: boolean;
      hydraulics: boolean;
      tires: boolean;
      serviceHistory: boolean;
      notes?: string;
    };
  }
) => {
  const { userId } = await requireVerified(ctx);

  const { auctionId, durationDays, ...restArgs } = args;

  if (
    durationDays < AUCTION_MIN_DURATION_DAYS ||
    durationDays > AUCTION_MAX_DURATION_DAYS
  ) {
    throw new ConvexError(
      `Invalid duration: must be between ${AUCTION_MIN_DURATION_DAYS.toString()} and ${AUCTION_MAX_DURATION_DAYS.toString()} days`
    );
  }

  // Enforce image cap for additional images
  if (
    restArgs.images.additional &&
    restArgs.images.additional.length > MAX_ADDITIONAL_IMAGES
  ) {
    throw new ConvexError(
      `Additional images limit exceeded (max ${MAX_ADDITIONAL_IMAGES.toString()})`
    );
  }

  const images = normalizeImages(restArgs.images);

  let validAuctionId: Id<"auctions"> | null = null;
  if (auctionId) {
    validAuctionId = ctx.db.normalizeId("auctions", auctionId);
    if (!validAuctionId) {
      throw new ConvexError("Invalid auctionId provided");
    }
  }

  if (validAuctionId) {
    const existing = await ctx.db.get(validAuctionId);
    if (!existing) {
      throw new ConvexError("Auction not found");
    }
    assertOwnership(existing, userId);
    assertEditable(existing);

    if (existing.status === "pending_review") {
      const mergedState = {
        ...existing,
        ...restArgs,
        images,
      } as Doc<"auctions">;
      validateAuctionBeforePublish(mergedState);
    }

    await ctx.db.patch(validAuctionId, {
      ...restArgs,
      images,
      durationDays,
      currentPrice: restArgs.startingPrice,
      minIncrement:
        restArgs.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
          ? SMALL_INCREMENT_AMOUNT
          : LARGE_INCREMENT_AMOUNT,
    });

    return validAuctionId;
  }

  const newAuctionId = await ctx.db.insert("auctions", {
    ...restArgs,
    images,
    sellerId: userId,
    status: "draft",
    currentPrice: args.startingPrice,
    minIncrement:
      args.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
        ? SMALL_INCREMENT_AMOUNT
        : LARGE_INCREMENT_AMOUNT,
    durationDays,
  });

  await updateCounter(ctx, "auctions", "total", 1);
  await updateCounter(ctx, "auctions", "draft", 1);

  return newAuctionId;
};

/**
 * Save or update a draft auction.
 * Creates new draft if no auctionId provided, otherwise updates existing draft.
 */
export const saveDraft = mutation({
  args: {
    auctionId: v.optional(v.string()),
    title: v.string(),
    categoryId: v.id("equipmentCategories"),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    operatingHours: v.number(),
    location: v.string(),
    description: v.string(),
    startingPrice: v.number(),
    reservePrice: v.number(),
    durationDays: v.number(),
    images: v.object({
      front: v.optional(v.string()),
      engine: v.optional(v.string()),
      cabin: v.optional(v.string()),
      rear: v.optional(v.string()),
      additional: v.optional(v.array(v.string())),
    }),
    conditionChecklist: v.object({
      engine: v.boolean(),
      hydraulics: v.boolean(),
      tires: v.boolean(),
      serviceHistory: v.boolean(),
      notes: v.optional(v.string()),
    }),
  },
  returns: v.id("auctions"),
  handler: saveDraftHandler,
});

/**
 * Handler for updating an existing auction.
 * Performs validation, ownership checks, and recomputes derived fields.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including auctionId and updates
 * @param args.auctionId - The unique identifier of the auction to update
 * @param args.updates - Object containing the fields to update
 * @returns Object with success boolean
 */
export const updateAuctionHandler = async (
  ctx: MutationCtx,
  args: {
    auctionId: Id<"auctions">;
    updates: AuctionUpdates;
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  assertOwnership(auction, userId);
  assertEditable(auction);

  const updates: AuctionUpdates = { ...args.updates };

  // If startingPrice is updated, recompute derived fields
  if (updates.startingPrice !== undefined) {
    updates.currentPrice = updates.startingPrice;
    updates.minIncrement =
      updates.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
        ? SMALL_INCREMENT_AMOUNT
        : LARGE_INCREMENT_AMOUNT;
  }

  if (
    updates.durationDays !== undefined &&
    (updates.durationDays < AUCTION_MIN_DURATION_DAYS ||
      updates.durationDays > AUCTION_MAX_DURATION_DAYS)
  ) {
    throw new ConvexError(
      `Invalid duration: must be between ${AUCTION_MIN_DURATION_DAYS.toString()} and ${AUCTION_MAX_DURATION_DAYS.toString()} days`
    );
  }

  // Merge images if provided to prevent overwriting other slots
  if (updates.images) {
    let existingImages: Record<string, string | string[] | undefined> = {};
    if (Array.isArray(auction.images)) {
      if (auction.images.length > 0) {
        existingImages.front = auction.images[0];
        if (auction.images.length > 1) {
          existingImages.additional = auction.images.slice(1);
        }
      }
    } else {
      existingImages = auction.images as Record<
        string,
        string | string[] | undefined
      >;
    }
    const mergedImages = {
      ...existingImages,
      ...updates.images,
    };

    if (
      mergedImages.additional &&
      mergedImages.additional.length > MAX_ADDITIONAL_IMAGES
    ) {
      throw new ConvexError(
        `Additional images limit exceeded (max ${MAX_ADDITIONAL_IMAGES.toString()})`
      );
    }
    updates.images = mergedImages;
  }

  if (auction.status === "pending_review") {
    const mergedState = { ...auction, ...updates } as Doc<"auctions">;
    validateAuctionBeforePublish(mergedState);
  }

  await ctx.db.patch(args.auctionId, updates);

  await logAudit(ctx, {
    action: "SELLER_UPDATE_AUCTION",
    targetId: args.auctionId,
    targetType: "auction",
    details: JSON.stringify({
      sellerId: userId,
      previousStatus: auction.status,
      updates: Object.keys(updates),
    }),
  });

  return { success: true };
};

/**
 * Update an auction. Only allowed for draft or pending_review status.
 * Once active, sold, or unsold - auction is locked from seller edits.
 */
export const updateAuction = mutation({
  args: {
    auctionId: v.id("auctions"),
    updates: v.object({
      title: v.optional(v.string()),
      categoryId: v.optional(v.id("equipmentCategories")),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      year: v.optional(v.number()),
      operatingHours: v.optional(v.number()),
      location: v.optional(v.string()),
      description: v.optional(v.string()),
      startingPrice: v.optional(v.number()),
      reservePrice: v.optional(v.number()),
      durationDays: v.optional(v.number()),
      images: v.optional(
        v.object({
          front: v.optional(v.string()),
          engine: v.optional(v.string()),
          cabin: v.optional(v.string()),
          rear: v.optional(v.string()),
          additional: v.optional(v.array(v.string())),
        })
      ),
      conditionChecklist: v.optional(
        v.object({
          engine: v.boolean(),
          hydraulics: v.boolean(),
          tires: v.boolean(),
          serviceHistory: v.boolean(),
          notes: v.optional(v.string()),
        })
      ),
    }),
  },
  returns: v.object({ success: v.boolean() }),
  handler: updateAuctionHandler,
});

/**
 * Handler for publishing a draft auction.
 * Validates required content before transitioning to review.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including auctionId
 * @param args.auctionId - The ID of the draft auction to publish
 * @returns Object with success boolean
 */
export const publishAuctionHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  assertOwnership(auction, userId);

  if (auction.status !== "draft") {
    throw new ConvexError("Only draft auctions can be published");
  }

  // Validate required fields before allowing publish
  validateAuctionBeforePublish(auction);

  await ctx.db.patch(args.auctionId, { status: "pending_review" });

  await adjustStatusCounters(ctx, "draft", "pending_review");

  return { success: true };
};

/**
 * Submit a draft auction for admin review.
 * Transitions draft -> pending_review
 */
export const submitForReview = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: publishAuctionHandler,
});

/**
 * Alias for submitForReview.
 */
export const publishAuction = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: publishAuctionHandler,
});

/**
 * Handler for deleting a draft auction.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including auctionId
 * @param args.auctionId - The ID of the draft auction to delete.
 * @returns Object with success boolean
 */
export const deleteDraftHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  assertOwnership(auction, userId);

  if (auction.status !== "draft") {
    throw new ConvexError("Only draft auctions can be deleted");
  }

  await deleteAuctionImages(ctx, auction.images);

  if (auction.conditionReportUrl) {
    try {
      await ctx.storage.delete(auction.conditionReportUrl as Id<"_storage">);
    } catch (e) {
      console.warn(
        `Failed to delete condition report: ${auction.conditionReportUrl}`,
        e
      );
    }
  }

  await ctx.db.delete(args.auctionId);
  await updateCounter(ctx, "auctions", "draft", -1);
  await updateCounter(ctx, "auctions", "total", -1);

  await logAudit(ctx, {
    action: "DELETE_DRAFT",
    targetId: args.auctionId,
    targetType: "auction",
    details: JSON.stringify({
      sellerId: userId,
      title: auction.title,
    }),
  });

  return { success: true };
};

/**
 * Delete a draft auction.
 */
export const deleteDraft = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: deleteDraftHandler,
});

/**
 * Handler for updating an auction's condition report.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including auctionId and typed storageId
 * @param args.auctionId - The unique identifier of the auction to update
 * @param args.storageId - The storage ID of the condition report file
 * @returns Object with success boolean
 */
export const updateConditionReportHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions">; storageId: Id<"_storage"> }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  assertOwnership(auction, userId);
  assertEditable(auction);

  if (auction.conditionReportUrl) {
    try {
      await ctx.storage.delete(auction.conditionReportUrl);
    } catch (e) {
      console.warn("Failed to delete old condition report", e);
    }
  }

  await ctx.db.patch(args.auctionId, {
    conditionReportUrl: args.storageId,
  });

  return { success: true };
};

/**
 * Upload a condition report PDF for an auction.
 */
export const uploadConditionReport = mutation({
  args: {
    auctionId: v.id("auctions"),
    storageId: v.id("_storage"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: updateConditionReportHandler,
});

/**
 * Delete a condition report from an auction.
 * @param ctx - The mutation context.
 * @param args - The arguments for the deletion.
 * @param args.auctionId - The ID of the auction to remove the report from.
 * @returns Promise<{ success: boolean }>
 */
export const deleteConditionReportHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  assertOwnership(auction, userId);
  assertEditable(auction);

  if (auction.conditionReportUrl) {
    try {
      await ctx.storage.delete(auction.conditionReportUrl);
    } catch (e) {
      console.warn("Failed to delete condition report", e);
    }
  }

  await ctx.db.patch(args.auctionId, {
    conditionReportUrl: undefined,
  });

  return { success: true };
};

export const deleteConditionReport = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: deleteConditionReportHandler,
});

/**
 * Flag an auction for review.
 * Auto-hides auction if it receives enough flags.
 * @param ctx - The mutation context.
 * @param args - The arguments for flagging an auction.
 * @param args.auctionId - The ID of the auction to flag.
 * @param args.reason - The reason for flagging.
 * @param args.details - Optional details about the flag.
 * @returns Promise<{ success: boolean; hideTriggered: boolean }>
 */
export const flagAuctionHandler = async (
  ctx: MutationCtx,
  args: {
    auctionId: Id<"auctions">;
    reason: "misleading" | "inappropriate" | "suspicious" | "other";
    details?: string;
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  if (auction.sellerId === userId) {
    throw new ConvexError("You cannot flag your own auction");
  }

  const existingFlags = await ctx.db
    .query("auctionFlags")
    .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
    .collect();

  const userHasFlagged = existingFlags.some(
    (flag) => flag.reporterId === userId && flag.status === "pending"
  );

  if (userHasFlagged) {
    throw new ConvexError("You have already flagged this auction");
  }

  await ctx.db.insert("auctionFlags", {
    auctionId: args.auctionId,
    reporterId: userId,
    reason: args.reason,
    details: args.details,
    status: "pending",
    createdAt: Date.now(),
  });

  let hideTriggered = false;

  const pendingFlags = existingFlags.filter((f) => f.status === "pending");
  if (pendingFlags.length + 1 >= AUCTION_FLAG_AUTO_HIDE_THRESHOLD) {
    if (auction.status === "active") {
      await ctx.db.patch(args.auctionId, {
        status: "pending_review",
        hiddenByFlags: true,
      });

      await updateCounter(ctx, "auctions", "active", -1);
      await updateCounter(ctx, "auctions", "pending", 1);

      hideTriggered = true;
    }

    await logAudit(ctx, {
      action: "AUTO_HIDE_AUCTION_FLAGS",
      targetId: args.auctionId,
      targetType: "auction",
      details: JSON.stringify({
        flagCount: pendingFlags.length + 1,
        threshold: AUCTION_FLAG_AUTO_HIDE_THRESHOLD,
        hideTriggered,
        reason: args.reason,
      }),
    });
  }

  return { success: true, hideTriggered };
};

export const flagAuction = mutation({
  args: {
    auctionId: v.id("auctions"),
    reason: v.union(
      v.literal("misleading"),
      v.literal("inappropriate"),
      v.literal("suspicious"),
      v.literal("other")
    ),
    details: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), hideTriggered: v.boolean() }),
  handler: flagAuctionHandler,
});

/**
 * Dismiss a flag (admin only).
 * @param ctx - The mutation context.
 * @param args - The arguments for dismissing a flag.
 * @param args.flagId - The ID of the flag to dismiss.
 * @param args.dismissalReason - Optional reason for dismissal.
 * @returns Promise<{ success: boolean; auctionRestored: boolean }>
 */
export const dismissFlagHandler = async (
  ctx: MutationCtx,
  args: {
    flagId: Id<"auctionFlags">;
    dismissalReason?: string;
  }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new Error("Not authorized: Admin privileges required");
  }

  const flag = await ctx.db.get(args.flagId);
  if (!flag) {
    throw new ConvexError("Flag not found");
  }

  if (flag.status !== "pending") {
    throw new ConvexError("Flag has already been reviewed");
  }

  await ctx.db.patch(args.flagId, {
    status: "dismissed",
  });

  let auctionRestored = false;

  const auction = await ctx.db.get(flag.auctionId);
  if (auction?.status === "pending_review" && auction.hiddenByFlags === true) {
    const remainingFlags = await ctx.db
      .query("auctionFlags")
      .withIndex("by_auction_status", (q) =>
        q.eq("auctionId", flag.auctionId).eq("status", "pending")
      )
      .collect();

    if (remainingFlags.length < AUCTION_FLAG_AUTO_HIDE_THRESHOLD) {
      await ctx.db.patch(flag.auctionId, {
        status: "active",
        hiddenByFlags: false,
      });

      await updateCounter(ctx, "auctions", "pending", -1);
      await updateCounter(ctx, "auctions", "active", 1);

      auctionRestored = true;
    }
  }

  const authUser = await getAuthUser(ctx);
  const adminId = authUser ? resolveUserId(authUser) : "unknown";

  await logAudit(ctx, {
    action: "DISMISS_FLAG",
    targetId: args.flagId,
    targetType: "auctionFlag",
    details: JSON.stringify({
      adminId,
      auctionId: flag.auctionId,
      reason: flag.reason,
      dismissalReason: args.dismissalReason,
      auctionRestored,
    }),
  });

  return { success: true, auctionRestored };
};

export const dismissFlag = mutation({
  args: {
    flagId: v.id("auctionFlags"),
    dismissalReason: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), auctionRestored: v.boolean() }),
  handler: dismissFlagHandler,
});

/**
 * Approve an auction for publication.
 * @param ctx - The mutation context.
 * @param args - The arguments for approving an auction.
 * @param args.auctionId - The ID of the auction to approve.
 * @param args.durationDays - Optional override for auction duration.
 * @returns Promise<{ success: boolean }>
 */
export const approveAuctionHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions">; durationDays?: number }
) => {
  await requireAdmin(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) throw new ConvexError("Auction not found");
  if (auction.status !== "pending_review") {
    throw new ConvexError("Only auctions in pending_review can be approved");
  }

  const durationDays =
    args.durationDays ?? auction.durationDays ?? AUCTION_DEFAULT_DURATION_DAYS;
  if (
    durationDays < AUCTION_MIN_DURATION_DAYS ||
    durationDays > AUCTION_MAX_DURATION_DAYS
  ) {
    throw new ConvexError(
      `Invalid duration: must be between ${AUCTION_MIN_DURATION_DAYS.toString()} and ${AUCTION_MAX_DURATION_DAYS.toString()} days`
    );
  }

  const startTime = Date.now();
  const durationMs = durationDays * MS_PER_DAY;
  const endTime = startTime + durationMs;

  await ctx.db.patch(args.auctionId, {
    status: "active",
    startTime,
    endTime,
    hiddenByFlags: false,
  });

  await updateCounter(ctx, "auctions", "pending", -1);
  await updateCounter(ctx, "auctions", "active", 1);

  return { success: true };
};

export const approveAuction = mutation({
  args: { auctionId: v.id("auctions"), durationDays: v.optional(v.number()) },
  returns: v.object({ success: v.boolean() }),
  handler: approveAuctionHandler,
});

/**
 * Reject an auction during review.
 * @param ctx - The mutation context.
 * @param args - The arguments for rejecting an auction.
 * @param args.auctionId - The ID of the auction to reject.
 * @returns Promise<{ success: boolean }>
 */
export const rejectAuctionHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  await requireAdmin(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) throw new ConvexError("Auction not found");
  if (auction.status !== "pending_review") {
    throw new ConvexError("Only auctions in pending_review can be rejected");
  }

  await ctx.db.patch(args.auctionId, {
    status: "rejected",
    startTime: undefined,
    endTime: undefined,
    hiddenByFlags: false,
  });

  await updateCounter(ctx, "auctions", "pending", -1);

  return { success: true };
};

export const rejectAuction = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: rejectAuctionHandler,
});

/**
 * Handler for admin-initiated auction updates.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including auctionId and updates
 * @param args.auctionId - The ID of the auction to update.
 * @param args.updates - The fields to update.
 * @param args.updates.title - The new title.
 * @param args.updates.categoryId - The new category ID.
 * @param args.updates.make - The new make.
 * @param args.updates.model - The new model.
 * @param args.updates.year - The new year.
 * @param args.updates.operatingHours - The new operating hours.
 * @param args.updates.location - The new location.
 * @param args.updates.description - The new description.
 * @param args.updates.startingPrice - The new starting price.
 * @param args.updates.reservePrice - The new reserve price.
 * @param args.updates.status - The new status.
 * @param args.updates.startTime - The new start time.
 * @param args.updates.endTime - The new end time.
 * @param args.updates.currentPrice - The new current price.
 * @returns Object with success boolean
 */
export const adminUpdateAuctionHandler = async (
  ctx: MutationCtx,
  args: {
    auctionId: Id<"auctions">;
    updates: {
      title?: string;
      categoryId?: Id<"equipmentCategories">;
      make?: string;
      model?: string;
      year?: number;
      operatingHours?: number;
      location?: string;
      description?: string;
      startingPrice?: number;
      reservePrice?: number;
      status?:
        | "draft"
        | "pending_review"
        | "active"
        | "sold"
        | "unsold"
        | "rejected";
      startTime?: number;
      endTime?: number;
      currentPrice?: number;
    };
  }
) => {
  await requireAdmin(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) throw new Error("Auction not found");

  const oldStatus = auction.status;
  const newStatus = args.updates.status;

  if (newStatus === "active") {
    const patched = { ...auction, ...args.updates };
    validateAuctionStatus(patched, newStatus);
  }

  const patchData: typeof args.updates & { hiddenByFlags?: boolean } = {
    ...args.updates,
  };
  if (
    oldStatus === "pending_review" &&
    newStatus &&
    newStatus !== "pending_review"
  ) {
    patchData.hiddenByFlags = false;
  }

  await ctx.db.patch(args.auctionId, patchData);

  if (newStatus && oldStatus !== newStatus) {
    await adjustStatusCounters(ctx, oldStatus, newStatus);
  }

  await logAudit(ctx, {
    action: "UPDATE_AUCTION",
    targetId: args.auctionId,
    targetType: "auction",
    details: JSON.stringify(args.updates),
  });

  return { success: true };
};

export const adminUpdateAuction = mutation({
  args: {
    auctionId: v.id("auctions"),
    updates: v.object({
      title: v.optional(v.string()),
      categoryId: v.optional(v.id("equipmentCategories")),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      year: v.optional(v.number()),
      operatingHours: v.optional(v.number()),
      location: v.optional(v.string()),
      description: v.optional(v.string()),
      startingPrice: v.optional(v.number()),
      reservePrice: v.optional(v.number()),
      status: v.optional(
        v.union(
          v.literal("draft"),
          v.literal("pending_review"),
          v.literal("active"),
          v.literal("sold"),
          v.literal("unsold"),
          v.literal("rejected")
        )
      ),
      startTime: v.optional(v.number()),
      endTime: v.optional(v.number()),
      currentPrice: v.optional(v.number()),
    }),
  },
  returns: v.object({ success: v.boolean() }),
  handler: adminUpdateAuctionHandler,
});

/**
 * Bulk update multiple auctions (admin only).
 * @param ctx - The mutation context.
 * @param args - The arguments for bulk update.
 * @param args.auctionIds - The IDs of the auctions to update.
 * @param args.updates - The fields to update.
 * @param args.updates.status - The new status.
 * @param args.updates.startTime - The new start time.
 * @param args.updates.endTime - The new end time.
 * @param args.updates.startingPrice - The new starting price.
 * @returns Promise<{ success: boolean; updated: Id<"auctions">[]; skipped: Id<"auctions">[] }>
 */
export const bulkUpdateAuctionsHandler = async (
  ctx: MutationCtx,
  args: {
    auctionIds: Id<"auctions">[];
    updates: {
      status?:
        | "draft"
        | "pending_review"
        | "active"
        | "sold"
        | "unsold"
        | "rejected";
      startTime?: number;
      endTime?: number;
      startingPrice?: number;
    };
  }
) => {
  await requireAdmin(ctx);

  if (args.auctionIds.length > MAX_BULK_UPDATE_SIZE) {
    throw new Error(
      `Bulk update exceeds limit of ${MAX_BULK_UPDATE_SIZE.toString()} auctions`
    );
  }

  const updated: Id<"auctions">[] = [];
  const skipped: Id<"auctions">[] = [];
  for (const id of args.auctionIds) {
    const auction = await ctx.db.get(id);
    if (auction) {
      const oldStatus = auction.status;
      const newStatus = args.updates.status;

      if (newStatus === "active") {
        const patched = { ...auction, ...args.updates };
        try {
          validateAuctionStatus(patched, newStatus);
        } catch {
          skipped.push(id);
          continue;
        }
      }

      await ctx.db.patch(id, args.updates);
      updated.push(id);

      if (newStatus && oldStatus !== newStatus) {
        await adjustStatusCounters(ctx, oldStatus, newStatus);
      }
    } else {
      skipped.push(id);
    }
  }

  await logAudit(ctx, {
    action: "BULK_UPDATE_AUCTIONS",
    targetId: args.auctionIds.join(","),
    targetType: "auction",
    targetCount: updated.length,
    details: JSON.stringify({
      requestedCount: args.auctionIds.length,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      updates: Object.keys(args.updates),
      preview: updated.slice(0, 3),
    }),
  });

  return { success: true, updated, skipped };
};

export const bulkUpdateAuctions = mutation({
  args: {
    auctionIds: v.array(v.id("auctions")),
    updates: v.object({
      status: v.optional(
        v.union(
          v.literal("draft"),
          v.literal("pending_review"),
          v.literal("active"),
          v.literal("sold"),
          v.literal("unsold"),
          v.literal("rejected")
        )
      ),
      startTime: v.optional(v.number()),
      endTime: v.optional(v.number()),
      startingPrice: v.optional(v.number()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    updated: v.array(v.id("auctions")),
    skipped: v.array(v.id("auctions")),
  }),
  handler: bulkUpdateAuctionsHandler,
});

/**
 * Admin mutation to manually close an active auction early.
 * @param ctx - The mutation context.
 * @param args - The arguments for closing an auction.
 * @param args.auctionId - The ID of the auction to close.
 * @returns Promise<EarlyClosureResult>
 */
export const closeAuctionEarlyHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
): Promise<EarlyClosureResult> => {
  try {
    await requireAdmin(ctx);
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      (error instanceof Error &&
        (error.name === "UnauthorizedError" ||
          error.message.includes("Unauthenticated") ||
          error.message.includes("Unauthorized") ||
          error.message.includes("Not authenticated") ||
          error.message.includes("Not authorized")))
    ) {
      return {
        success: false,
        finalStatus: "",
        error: error instanceof Error ? error.message : "Not authorized",
      };
    }
    throw error;
  }

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    return {
      success: false,
      finalStatus: "",
      error: "Auction not found",
    };
  }

  if (auction.status !== "active") {
    return {
      success: false,
      finalStatus: "",
      error: "Auction has already been settled",
    };
  }

  const bids = await ctx.db
    .query("bids")
    .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
    .collect();

  const validBids = bids.filter((b: Doc<"bids">) => b.status !== "voided");
  const hasBids = validBids.length > 0;

  type AuctionStatus = "sold" | "unsold";
  let finalStatus: AuctionStatus;
  let winnerId: string | undefined;
  let winningAmount: number | undefined;

  let highestBid: Doc<"bids"> | undefined;
  if (hasBids) {
    highestBid = validBids.reduce((prev: Doc<"bids">, current: Doc<"bids">) => {
      if (current.amount > prev.amount) return current;
      if (current.amount === prev.amount) {
        return current.timestamp < prev.timestamp ? current : prev;
      }
      return prev;
    });
  }

  const reserveMet =
    hasBids &&
    highestBid !== undefined &&
    highestBid.amount >= auction.reservePrice;

  if (hasBids && reserveMet && highestBid) {
    finalStatus = "sold";
    winnerId = highestBid.bidderId;
    winningAmount = highestBid.amount;
  } else {
    finalStatus = "unsold";
  }

  await ctx.db.patch(auction._id, {
    status: finalStatus,
    winnerId,
  });

  await updateCounter(ctx, "auctions", "active", -1);

  const authUser = await getAuthUser(ctx);
  const adminId = authUser ? resolveUserId(authUser) : "unknown";

  await logAudit(ctx, {
    action: "auction_early_closure",
    targetId: args.auctionId,
    targetType: "auction",
    details: JSON.stringify({
      adminId,
      title: auction.title,
      finalStatus,
      winnerId,
      winningAmount,
      reserveMet,
      bidCount: validBids.length,
    }),
  });

  return {
    success: true,
    finalStatus,
    winnerId,
    winningAmount,
  };
};

export const closeAuctionEarly = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({
    success: v.boolean(),
    finalStatus: v.string(),
    winnerId: v.optional(v.string()),
    winningAmount: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: closeAuctionEarlyHandler,
});
