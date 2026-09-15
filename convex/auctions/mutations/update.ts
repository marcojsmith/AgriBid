import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import { requireAdmin, getAuthenticatedUserId } from "../../lib/auth";
import { safeDelete } from "../../lib/storage";
import { logAudit } from "../../admin_utils";
import {
  MAX_ADDITIONAL_IMAGES,
  PRICE_THRESHOLD_FOR_INCREMENT,
  SMALL_INCREMENT_AMOUNT,
  LARGE_INCREMENT_AMOUNT,
  MAX_BULK_UPDATE_SIZE,
} from "../../constants";
import {
  assertLotOwnership,
  assertLotEditable,
  validateLotBeforeSubmit,
  adjustLotStatusCounters,
} from "../../lots/mutations/helpers";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/**
 * Lot statuses an admin may set through the legacy bulk/update mutations.
 */
type AdminLotStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "assigned"
  | "sold"
  | "unsold"
  | "rejected";

const ADMIN_LOT_STATUS_UNION = v.union(
  v.literal("draft"),
  v.literal("pending_review"),
  v.literal("approved"),
  v.literal("assigned"),
  v.literal("sold"),
  v.literal("unsold"),
  v.literal("rejected")
);

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
 * Handler for updating an existing lot.
 * Performs validation, ownership checks, and recomputes derived fields.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including the lot id and updates
 * @param args.auctionId - The ID of the lot to update (legacy arg name, lot id)
 * @param args.updates - The updates to apply to the lot
 * @returns Object with success boolean
 */
export const updateAuctionHandler = async (
  ctx: MutationCtx,
  args: {
    auctionId: Id<"lots">;
    updates: AuctionUpdates;
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const lot = await ctx.db.get("lots", args.auctionId);
  if (!lot) {
    throw new ConvexError("Lot not found");
  }

  assertLotOwnership(lot, userId);
  assertLotEditable(lot);

  const updates: AuctionUpdates = { ...args.updates };
  // A lot does not own its schedule; drop the legacy field rather than patch it.
  delete updates.durationDays;

  // If startingPrice is updated, recompute derived fields
  if (updates.startingPrice !== undefined) {
    updates.currentPrice = updates.startingPrice;
    updates.minIncrement =
      updates.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
        ? SMALL_INCREMENT_AMOUNT
        : LARGE_INCREMENT_AMOUNT;
  }

  // Merge images if provided to prevent overwriting other slots
  if (updates.images) {
    let existingImages: Record<string, string | string[] | undefined> = {};
    if (Array.isArray(lot.images)) {
      if (lot.images.length > 0) {
        existingImages.front = lot.images[0];
        if (lot.images.length > 1) {
          existingImages.additional = lot.images.slice(1);
        }
      }
    } else {
      existingImages = lot.images as Record<
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

  if (lot.status === "pending_review") {
    validateLotBeforeSubmit({
      title: updates.title ?? lot.title,
      description: updates.description ?? lot.description,
      startingPrice: updates.startingPrice ?? lot.startingPrice,
      reservePrice: updates.reservePrice ?? lot.reservePrice,
      images: updates.images ?? lot.images,
    });
  }

  await ctx.db.patch("lots", args.auctionId, updates);

  await logAudit(ctx, {
    action: "SELLER_UPDATE_AUCTION",
    targetId: args.auctionId,
    targetType: "lot",
    details: JSON.stringify({
      sellerId: userId,
      previousStatus: lot.status,
      updates: Object.keys(updates),
    }),
  });

  return { success: true };
};

/**
 * Update a lot. Only allowed for draft or pending_review status.
 * Once approved, assigned, sold, or unsold - the lot is locked from seller edits.
 */
export const updateAuction = mutation({
  args: {
    auctionId: v.id("lots"),
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
 * Handler for admin-initiated lot updates.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including the lot id and updates
 * @param args.auctionId - The ID of the lot to update (legacy arg name, lot id)
 * @param args.updates - The updates to apply
 * @param args.updates.title - New title for the lot
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
 * @param args.updates.currentPrice - New current price
 * @returns Object with success boolean
 */
export const adminUpdateAuctionHandler = async (
  ctx: MutationCtx,
  args: {
    auctionId: Id<"lots">;
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
      status?: AdminLotStatus;
      currentPrice?: number;
    };
  }
) => {
  await requireAdmin(ctx);

  const lot = await ctx.db.get("lots", args.auctionId);
  if (!lot) throw new ConvexError("Lot not found");

  const oldStatus = lot.status;
  const newStatus = args.updates.status;

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

  // If admin updates startingPrice for pre-live lots, recompute derived fields
  if (
    args.updates.startingPrice !== undefined &&
    (lot.status === "draft" || lot.status === "pending_review")
  ) {
    patchData.currentPrice = args.updates.startingPrice;
    patchData.minIncrement =
      args.updates.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
        ? SMALL_INCREMENT_AMOUNT
        : LARGE_INCREMENT_AMOUNT;
  }

  await ctx.db.patch("lots", args.auctionId, patchData);

  if (newStatus && oldStatus !== newStatus) {
    await adjustLotStatusCounters(ctx, oldStatus, newStatus);
  }

  await logAudit(ctx, {
    action: "UPDATE_AUCTION",
    targetId: args.auctionId,
    targetType: "lot",
    details: JSON.stringify(args.updates),
  });

  return { success: true };
};

export const adminUpdateAuction = mutation({
  args: {
    auctionId: v.id("lots"),
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
      status: v.optional(ADMIN_LOT_STATUS_UNION),
      currentPrice: v.optional(v.number()),
    }),
  },
  returns: v.object({ success: v.boolean() }),
  handler: adminUpdateAuctionHandler,
});

/**
 * Bulk update multiple lots (admin only).
 * @param ctx - The mutation context.
 * @param args - The arguments for bulk update.
 * @param args.auctionIds - The IDs of the lots to update (legacy arg name, lot ids)
 * @param args.updates - The updates to apply
 * @param args.updates.status - New status
 * @param args.updates.startingPrice - New starting price
 * @returns Promise<{ success: boolean; updated: Id<"lots">[]; skipped: Id<"lots">[] }>
 */
export const bulkUpdateAuctionsHandler = async (
  ctx: MutationCtx,
  args: {
    auctionIds: Id<"lots">[];
    updates: {
      status?: AdminLotStatus;
      startingPrice?: number;
    };
  }
) => {
  await requireAdmin(ctx);

  if (args.auctionIds.length > MAX_BULK_UPDATE_SIZE) {
    throw new ConvexError(
      `Bulk update exceeds limit of ${MAX_BULK_UPDATE_SIZE.toString()} lots`
    );
  }

  const updated: Id<"lots">[] = [];
  const skipped: Id<"lots">[] = [];
  for (const id of args.auctionIds) {
    const lot = await ctx.db.get("lots", id);
    if (lot) {
      const oldStatus = lot.status;
      const newStatus = args.updates.status;

      const patchData: typeof args.updates & {
        currentPrice?: number;
        minIncrement?: number;
        hiddenByFlags?: boolean;
      } = { ...args.updates };
      if (
        args.updates.startingPrice !== undefined &&
        (lot.status === "draft" || lot.status === "pending_review")
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

      await ctx.db.patch("lots", id, patchData);
      updated.push(id);

      if (newStatus && oldStatus !== newStatus) {
        await adjustLotStatusCounters(ctx, oldStatus, newStatus);
      }
    } else {
      skipped.push(id);
    }
  }

  await logAudit(ctx, {
    action: "BULK_UPDATE_AUCTIONS",
    targetId: args.auctionIds.join(","),
    targetType: "lot",
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
    auctionIds: v.array(v.id("lots")),
    updates: v.object({
      status: v.optional(ADMIN_LOT_STATUS_UNION),
      startingPrice: v.optional(v.number()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    updated: v.array(v.id("lots")),
    skipped: v.array(v.id("lots")),
  }),
  handler: bulkUpdateAuctionsHandler,
});

/**
 * Handler for updating a lot's condition report.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including the lot id and typed storageId
 * @param args.auctionId - The ID of the lot (legacy arg name, lot id)
 * @param args.storageId - The storage ID of the report
 * @returns Object with success boolean
 */
export const updateConditionReportHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"lots">; storageId: Id<"_storage"> }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const lot = await ctx.db.get("lots", args.auctionId);
  if (!lot) {
    throw new ConvexError("Lot not found");
  }

  assertLotOwnership(lot, userId);
  assertLotEditable(lot);

  if (lot.conditionReportUrl) {
    await safeDelete(ctx, lot.conditionReportUrl, "old condition report");
  }

  await ctx.db.patch("lots", args.auctionId, {
    conditionReportUrl: args.storageId,
  });

  return { success: true };
};

/**
 * Upload a condition report PDF for a lot.
 */
export const uploadConditionReport = mutation({
  args: {
    auctionId: v.id("lots"),
    storageId: v.id("_storage"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: updateConditionReportHandler,
});
