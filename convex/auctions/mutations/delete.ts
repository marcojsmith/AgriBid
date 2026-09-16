import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import { requireAdmin, getAuthenticatedUserId } from "../../lib/auth";
import { deleteAuctionImages, safeDelete } from "../../lib/storage";
import { logAudit, updateCounter } from "../../admin_utils";
import {
  assertLotOwnership,
  assertLotEditable,
} from "../../lots/mutations/helpers";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/**
 * Handler for deleting a storage item.
 * @param ctx - The mutation context.
 * @param args - The arguments for the deletion.
 * @param args.storageId - The storage ID of the item to delete
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
 * Handler for deleting a draft lot.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including the lot id
 * @param args.lotId - The ID of the lot to delete
 * @returns Object with success boolean
 */
export const deleteDraftHandler = async (
  ctx: MutationCtx,
  args: { lotId: Id<"lots"> }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) {
    throw new ConvexError("Lot not found");
  }

  assertLotOwnership(lot, userId);

  if (lot.status !== "draft") {
    throw new ConvexError("Only draft lots can be deleted");
  }

  await deleteAuctionImages(ctx, lot.images);

  if (lot.conditionReportUrl) {
    await safeDelete(ctx, lot.conditionReportUrl, "condition report");
  }

  await ctx.db.delete("lots", args.lotId);
  await updateCounter(ctx, "lots", "draft", -1);
  await updateCounter(ctx, "lots", "total", -1);

  await logAudit(ctx, {
    action: "DELETE_DRAFT",
    targetId: args.lotId,
    targetType: "lot",
    details: JSON.stringify({
      sellerId: userId,
      title: lot.title,
    }),
  });

  return { success: true };
};

/**
 * Delete a draft lot.
 */
export const deleteDraft = mutation({
  args: { lotId: v.id("lots") },
  returns: v.object({ success: v.boolean() }),
  handler: deleteDraftHandler,
});

/**
 * Delete a condition report from a lot.
 * @param ctx - The mutation context.
 * @param args - The arguments for the deletion.
 * @param args.lotId - The ID of the lot
 * @returns Promise<{ success: boolean }>
 */
export const deleteConditionReportHandler = async (
  ctx: MutationCtx,
  args: { lotId: Id<"lots"> }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) {
    throw new ConvexError("Lot not found");
  }

  assertLotOwnership(lot, userId);
  assertLotEditable(lot);

  if (lot.conditionReportUrl) {
    await safeDelete(ctx, lot.conditionReportUrl, "condition report");
  }

  await ctx.db.patch("lots", args.lotId, {
    conditionReportUrl: undefined,
  });

  return { success: true };
};

export const deleteConditionReport = mutation({
  args: { lotId: v.id("lots") },
  returns: v.object({ success: v.boolean() }),
  handler: deleteConditionReportHandler,
});
