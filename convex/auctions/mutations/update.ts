import { v, ConvexError, type ObjectType } from "convex/values";

import { mutation } from "../../_generated/server";
import { requireAdmin, getAuthenticatedUserId } from "../../lib/auth";
import { safeDelete } from "../../lib/storage";
import { provinceValidator, type Province } from "../../lib/provinces";
import { logAudit } from "../../admin_utils";
import { syncAuctionLotCount } from "../../lib/lotCounters";
import { getLotPaymentByLot } from "../../lib/lotPayments";
import {
  assertImageAnglesMatchImages,
  assertValidColdStartVideo,
  assertValidLotSpecs,
  deleteReplacedColdStartVideo,
  lotSpecEditFields,
  sellerTypeValidator,
  type SellerType,
} from "../../lib/lotSpecs";
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
  assertMinPhotosOnEdit,
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
  province?: Province;
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
 * @param args.lotId - The ID of the lot to update
 * @param args.updates - The updates to apply to the lot
 * @returns Object with success boolean
 */
export const updateLotHandler = async (
  ctx: MutationCtx,
  args: {
    lotId: Id<"lots">;
    updates: AuctionUpdates;
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const lot = await ctx.db.get("lots", args.lotId);
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
      existingImages = lot.images;
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
    if (updates.images) {
      await assertMinPhotosOnEdit(ctx, lot.images, updates.images);
    }
  }

  await ctx.db.patch("lots", args.lotId, updates);

  await logAudit(ctx, {
    action: "SELLER_UPDATE_AUCTION",
    targetId: args.lotId,
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
export const updateLot = mutation({
  args: {
    lotId: v.id("lots"),
    updates: v.object({
      title: v.optional(v.string()),
      categoryId: v.optional(v.id("equipmentCategories")),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      year: v.optional(v.number()),
      operatingHours: v.optional(v.number()),
      location: v.optional(v.string()),
      province: v.optional(provinceValidator),
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
  handler: updateLotHandler,
});

/**
 * Handler for admin-initiated lot updates.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including the lot id and updates
 * @param args.lotId - The ID of the lot to update
 * @param args.updates - The updates to apply
 * @param args.updates.title - New title for the lot
 * @param args.updates.categoryId - New category ID
 * @param args.updates.make - New make
 * @param args.updates.model - New model
 * @param args.updates.year - New year
 * @param args.updates.operatingHours - New operating hours
 * @param args.updates.location - New location
 * @param args.updates.province - New province
 * @param args.updates.clearProvince - Remove the lot's province (cannot be combined with `province`)
 * @param args.updates.description - New description
 * @param args.updates.startingPrice - New starting price
 * @param args.updates.reservePrice - New reserve price
 * @param args.updates.status - New status
 * @param args.updates.currentPrice - New current price
 * @returns Object with success boolean
 */
export const adminUpdateLotHandler = async (
  ctx: MutationCtx,
  args: {
    lotId: Id<"lots">;
    updates: {
      title?: string;
      categoryId?: Id<"equipmentCategories">;
      make?: string;
      model?: string;
      year?: number;
      operatingHours?: number;
      location?: string;
      province?: Province;
      clearProvince?: boolean;
      description?: string;
      startingPrice?: number;
      reservePrice?: number;
      status?: AdminLotStatus;
      currentPrice?: number;
    } & ObjectType<typeof lotSpecEditFields>;
  }
) => {
  await requireAdmin(ctx);

  if (args.updates.clearProvince && args.updates.province) {
    throw new ConvexError("Cannot set and clear the province in one update");
  }

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) throw new ConvexError("Lot not found");

  assertValidLotSpecs(args.updates);
  assertImageAnglesMatchImages(args.updates.imageAngles, lot.images);
  // Re-attaching the video the lot already has is a no-op, not re-validated.
  if (args.updates.coldStartVideo !== lot.coldStartVideo) {
    await assertValidColdStartVideo(ctx, args.updates.coldStartVideo);
  }

  const oldStatus = lot.status;
  const newStatus = args.updates.status;

  // A lot under consideration only leaves it through Accept / Decline / expiry,
  // which settle fees, counters and notifications exactly once.
  if (oldStatus === "under_consideration" && newStatus !== undefined) {
    throw new ConvexError(
      "This lot is under consideration. Accept or decline the top bid instead."
    );
  }

  // A sold lot with a payment record keeps its sale: moving it back would leave
  // the buyer owing money (and a credited deposit) for a lot that isn't sold.
  if (
    oldStatus === "sold" &&
    newStatus !== undefined &&
    newStatus !== "sold" &&
    (await getLotPaymentByLot(ctx, lot._id))
  ) {
    throw new ConvexError(
      "This lot has a payment record. Its status can't be changed after sale."
    );
  }

  const { clearProvince, coldStartVideo, ...fieldUpdates } = args.updates;
  const patchData: typeof fieldUpdates & {
    coldStartVideo?: Id<"_storage">;
    hiddenByFlags?: boolean;
    currentPrice?: number;
    minIncrement?: number;
  } = {
    ...fieldUpdates,
  };
  // `null` removes the video (patching with `undefined` unsets the field).
  if (coldStartVideo !== undefined) {
    patchData.coldStartVideo = coldStartVideo ?? undefined;
  }
  // Patching a field with `undefined` removes it from the document.
  if (clearProvince) {
    patchData.province = undefined;
  }
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

  await ctx.db.patch("lots", args.lotId, patchData);
  await deleteReplacedColdStartVideo(ctx, lot.coldStartVideo, coldStartVideo);

  if (newStatus && oldStatus !== newStatus) {
    await adjustLotStatusCounters(ctx, oldStatus, newStatus);
  }
  await syncAuctionLotCount(ctx, lot, {
    status: newStatus ?? oldStatus,
    auctionId: lot.auctionId,
    hiddenByFlags: patchData.hiddenByFlags ?? lot.hiddenByFlags,
  });

  await logAudit(ctx, {
    action: "UPDATE_AUCTION",
    targetId: args.lotId,
    targetType: "lot",
    details: JSON.stringify(args.updates),
  });

  return { success: true };
};

export const adminUpdateLot = mutation({
  args: {
    lotId: v.id("lots"),
    updates: v.object({
      title: v.optional(v.string()),
      categoryId: v.optional(v.id("equipmentCategories")),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      year: v.optional(v.number()),
      operatingHours: v.optional(v.number()),
      location: v.optional(v.string()),
      province: v.optional(provinceValidator),
      clearProvince: v.optional(v.boolean()),
      description: v.optional(v.string()),
      startingPrice: v.optional(v.number()),
      reservePrice: v.optional(v.number()),
      status: v.optional(ADMIN_LOT_STATUS_UNION),
      currentPrice: v.optional(v.number()),
      ...lotSpecEditFields,
    }),
  },
  returns: v.object({ success: v.boolean() }),
  handler: adminUpdateLotHandler,
});

/**
 * Handler for the admin correction of a lot's snapshotted seller VAT status and
 * type. Omitted fields are left unchanged. Profile edits never touch assigned
 * lots, so this is how an admin fixes a single lot.
 *
 * @param ctx - Mutation context
 * @param args - Arguments
 * @param args.lotId - The lot to correct
 * @param args.sellerVatRegistered - New VAT-registration snapshot
 * @param args.sellerType - New seller-type snapshot
 * @returns Object with success boolean
 */
export const adminSetLotSellerVatHandler = async (
  ctx: MutationCtx,
  args: {
    lotId: Id<"lots">;
    sellerVatRegistered?: boolean;
    sellerType?: SellerType;
  }
): Promise<{ success: boolean }> => {
  await requireAdmin(ctx);

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) throw new ConvexError("Lot not found");

  const patch = {
    ...(args.sellerVatRegistered !== undefined && {
      sellerVatRegistered: args.sellerVatRegistered,
    }),
    ...(args.sellerType !== undefined && { sellerType: args.sellerType }),
  };
  if (Object.keys(patch).length === 0) {
    throw new ConvexError("Provide a VAT status or seller type to set");
  }

  await ctx.db.patch("lots", args.lotId, patch);

  await logAudit(ctx, {
    action: "UPDATE_LOT_SELLER_VAT",
    targetId: args.lotId,
    targetType: "lot",
    details: JSON.stringify({
      before: {
        sellerVatRegistered: lot.sellerVatRegistered,
        sellerType: lot.sellerType,
      },
      after: {
        sellerVatRegistered:
          args.sellerVatRegistered ?? lot.sellerVatRegistered,
        sellerType: args.sellerType ?? lot.sellerType,
      },
    }),
  });

  return { success: true };
};

/**
 * Admin: set a lot's snapshotted seller VAT status and seller type.
 */
export const adminSetLotSellerVat = mutation({
  args: {
    lotId: v.id("lots"),
    sellerVatRegistered: v.optional(v.boolean()),
    sellerType: v.optional(sellerTypeValidator),
  },
  returns: v.object({ success: v.boolean() }),
  handler: adminSetLotSellerVatHandler,
});

/**
 * Bulk update multiple lots (admin only).
 * @param ctx - The mutation context.
 * @param args - The arguments for bulk update.
 * @param args.lotIds - The IDs of the lots to update
 * @param args.updates - The updates to apply
 * @param args.updates.status - New status
 * @param args.updates.startingPrice - New starting price
 * @returns Promise<{ success: boolean; updated: Id<"lots">[]; skipped: Id<"lots">[] }>
 */
export const bulkUpdateLotsHandler = async (
  ctx: MutationCtx,
  args: {
    lotIds: Id<"lots">[];
    updates: {
      status?: AdminLotStatus;
      startingPrice?: number;
    };
  }
) => {
  await requireAdmin(ctx);

  if (args.lotIds.length > MAX_BULK_UPDATE_SIZE) {
    throw new ConvexError(
      `Bulk update exceeds limit of ${MAX_BULK_UPDATE_SIZE.toString()} lots`
    );
  }

  const updated: Id<"lots">[] = [];
  const skipped: Id<"lots">[] = [];
  for (const id of args.lotIds) {
    const lot = await ctx.db.get("lots", id);
    if (lot) {
      const oldStatus = lot.status;
      const newStatus = args.updates.status;

      // Lots under consideration only settle through Accept / Decline / expiry.
      if (oldStatus === "under_consideration" && newStatus !== undefined) {
        skipped.push(id);
        continue;
      }

      // Sold lots with a payment record keep their sale (see adminUpdateLot).
      if (
        oldStatus === "sold" &&
        newStatus !== undefined &&
        newStatus !== "sold" &&
        (await getLotPaymentByLot(ctx, id))
      ) {
        skipped.push(id);
        continue;
      }

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
      await syncAuctionLotCount(ctx, lot, {
        status: newStatus ?? oldStatus,
        auctionId: lot.auctionId,
        hiddenByFlags: patchData.hiddenByFlags ?? lot.hiddenByFlags,
      });
    } else {
      skipped.push(id);
    }
  }

  await logAudit(ctx, {
    action: "BULK_UPDATE_AUCTIONS",
    targetId: args.lotIds.join(","),
    targetType: "lot",
    targetCount: updated.length,
    details: JSON.stringify({
      requestedCount: args.lotIds.length,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      updates: Object.keys(args.updates),
      preview: updated.slice(0, 3),
    }),
  });

  return { success: true, updated, skipped };
};

export const bulkUpdateLots = mutation({
  args: {
    lotIds: v.array(v.id("lots")),
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
  handler: bulkUpdateLotsHandler,
});

/**
 * Handler for updating a lot's condition report.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including the lot id and typed storageId
 * @param args.lotId - The ID of the lot
 * @param args.storageId - The storage ID of the report
 * @returns Object with success boolean
 */
export const updateConditionReportHandler = async (
  ctx: MutationCtx,
  args: { lotId: Id<"lots">; storageId: Id<"_storage"> }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) {
    throw new ConvexError("Lot not found");
  }

  assertLotOwnership(lot, userId);
  assertLotEditable(lot);

  if (lot.conditionReportUrl) {
    await safeDelete(ctx, lot.conditionReportUrl, "old condition report");
  }

  await ctx.db.patch("lots", args.lotId, {
    conditionReportUrl: args.storageId,
  });

  return { success: true };
};

/**
 * Upload a condition report PDF for a lot.
 */
export const uploadConditionReport = mutation({
  args: {
    lotId: v.id("lots"),
    storageId: v.id("_storage"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: updateConditionReportHandler,
});
