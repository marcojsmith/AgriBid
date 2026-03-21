import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import { requireAdmin, getAuthenticatedUserId } from "../../lib/auth";
import { deleteAuctionImages } from "../../lib/storage";
import { logAudit, updateCounter } from "../../admin_utils";
import { assertOwnership, assertEditable } from "./helpers";
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
 * Handler for deleting a draft auction.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including auctionId
 * @param args.auctionId - The ID of the auction to delete
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
 * Delete a condition report from an auction.
 * @param ctx - The mutation context.
 * @param args - The arguments for the deletion.
 * @param args.auctionId - The ID of the auction
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
