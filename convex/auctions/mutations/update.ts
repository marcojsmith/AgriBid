import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import { requireAdmin, getAuthenticatedUserId } from "../../lib/auth";
import { logAudit } from "../../admin_utils";
import { validateAuctionStatus, validateStartTimeBounds } from "../helpers";
import {
  MAX_ADDITIONAL_IMAGES,
  AUCTION_MIN_DURATION_DAYS,
  AUCTION_MAX_DURATION_DAYS,
  PRICE_THRESHOLD_FOR_INCREMENT,
  SMALL_INCREMENT_AMOUNT,
  LARGE_INCREMENT_AMOUNT,
  MAX_BULK_UPDATE_SIZE,
} from "../../constants";
import {
  assertOwnership,
  assertEditable,
  validateAuctionBeforePublish,
  adjustStatusCounters,
} from "./helpers";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/**
 * Interface for auction update data to ensure type safety.
 */
export interface AuctionUpdates {
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
 * Handler for updating an existing auction.
 * Performs validation, ownership checks, and recomputes derived fields.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including auctionId and updates
 * @param args.auctionId - The ID of the auction to update
 * @param args.updates - The updates to apply to the auction
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
    const mergedState = {
      ...auction,
      title: updates.title ?? auction.title,
      description: updates.description ?? auction.description,
      startingPrice: updates.startingPrice ?? auction.startingPrice,
      reservePrice: updates.reservePrice ?? auction.reservePrice,
      images: updates.images ?? auction.images,
    };
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
 * Handler for admin-initiated auction updates.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including auctionId and updates
 * @param args.auctionId - The ID of the auction to update
 * @param args.updates - The updates to apply
 * @param args.updates.title - New title for the auction
 * @param args.updates.categoryId - New category ID
 * @param args.updates.make - New make
 * @param args.updates.model - New model
 * @param args.updates.year - New year
 * @param args.updates.operatingHours - New operating hours
 * @param args.updates.location - New location
 * @param args.updates.description - New description
 * @param args.updates.startingPrice - New starting price
 * @param args.updates.reservePrice - New reserve price
 * @param args.updates.status - New status
 * @param args.updates.startTime - New start time
 * @param args.updates.endTime - New end time
 * @param args.updates.currentPrice - New current price
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
  if (!auction) throw new ConvexError("Auction not found");

  const oldStatus = auction.status;
  const newStatus = args.updates.status;

  if (newStatus === "active") {
    const patched = { ...auction, ...args.updates };
    try {
      validateAuctionStatus(patched, newStatus);
    } catch (error) {
      if (error instanceof Error) {
        throw new ConvexError(`Cannot activate auction: ${error.message}`);
      }
      throw error;
    }
  }

  const patchData: typeof args.updates & {
    hiddenByFlags?: boolean;
    currentPrice?: number;
    minIncrement?: number;
  } = {
    ...args.updates,
  };
  if (
    oldStatus === "pending_review" &&
    newStatus &&
    newStatus !== "pending_review"
  ) {
    patchData.hiddenByFlags = false;
  }

  // If admin updates startingPrice for pre-live auctions, recompute derived fields
  if (
    args.updates.startingPrice !== undefined &&
    (auction.status === "draft" || auction.status === "pending_review")
  ) {
    patchData.currentPrice = args.updates.startingPrice;
    patchData.minIncrement =
      args.updates.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
        ? SMALL_INCREMENT_AMOUNT
        : LARGE_INCREMENT_AMOUNT;
  }

  if (args.updates.startTime !== undefined && auction.status !== "draft") {
    validateStartTimeBounds(args.updates.startTime, true);
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
 * @param args.auctionIds - The IDs of the auctions to update
 * @param args.updates - The updates to apply
 * @param args.updates.status - New status
 * @param args.updates.startTime - New start time
 * @param args.updates.endTime - New end time
 * @param args.updates.startingPrice - New starting price
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
    throw new ConvexError(
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

      const patchData: typeof args.updates & {
        currentPrice?: number;
        minIncrement?: number;
        hiddenByFlags?: boolean;
      } = { ...args.updates };
      if (
        args.updates.startingPrice !== undefined &&
        (auction.status === "draft" || auction.status === "pending_review")
      ) {
        patchData.currentPrice = args.updates.startingPrice;
        patchData.minIncrement =
          args.updates.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
            ? SMALL_INCREMENT_AMOUNT
            : LARGE_INCREMENT_AMOUNT;
      }
      if (
        oldStatus === "pending_review" &&
        newStatus &&
        newStatus !== "pending_review"
      ) {
        patchData.hiddenByFlags = false;
      }

      if (args.updates.startTime !== undefined && auction.status !== "draft") {
        try {
          validateStartTimeBounds(args.updates.startTime, true);
        } catch {
          skipped.push(id);
          continue;
        }
      }

      await ctx.db.patch(id, patchData);
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
 * Handler for updating an auction's condition report.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including auctionId and typed storageId
 * @param args.auctionId - The ID of the auction
 * @param args.storageId - The storage ID of the report
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
