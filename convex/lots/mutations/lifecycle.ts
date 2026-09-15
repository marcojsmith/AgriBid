import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import { getAuthenticatedUserId, requireAdmin } from "../../lib/auth";
import { logActivity } from "../../userActivity";
import {
  adjustLotStatusCounters,
  assertLotOwnership,
  validateLotBeforeSubmit,
} from "./helpers";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/**
 * Seller submits a draft lot for admin review.
 * Transitions `draft -> pending_review`.
 *
 * @param ctx - Mutation context.
 * @param args - Arguments including the lot id.
 * @param args.lotId - The lot being submitted.
 * @returns `{ success: true }` once the lot is in review.
 */
export const submitLotForReviewHandler = async (
  ctx: MutationCtx,
  args: { lotId: Id<"lots"> }
): Promise<{ success: boolean }> => {
  const userId = await getAuthenticatedUserId(ctx);

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) {
    throw new ConvexError("Lot not found");
  }

  assertLotOwnership(lot, userId);

  if (lot.status !== "draft") {
    throw new ConvexError("Only draft lots can be submitted for review");
  }

  validateLotBeforeSubmit(lot);

  await ctx.db.patch("lots", args.lotId, { status: "pending_review" });
  await adjustLotStatusCounters(ctx, "draft", "pending_review");

  await logActivity(ctx, {
    userId,
    type: "listing_created",
    description: `Listing created: ${lot.title}`,
    relatedId: args.lotId,
  });

  return { success: true };
};

/**
 * Submit a draft lot for admin review.
 */
export const submitLotForReview = mutation({
  args: { lotId: v.id("lots") },
  returns: v.object({ success: v.boolean() }),
  handler: submitLotForReviewHandler,
});

/**
 * Admin approves a lot under review.
 * Transitions `pending_review -> approved` and clears any flag hiding. The lot
 * has no independent time window; the window comes from the auction it is
 * later assigned to.
 *
 * @param ctx - Mutation context.
 * @param args - Arguments including the lot id.
 * @param args.lotId - The lot being approved.
 * @returns `{ success: true }` once approved.
 */
export const approveLotHandler = async (
  ctx: MutationCtx,
  args: { lotId: Id<"lots"> }
): Promise<{ success: boolean }> => {
  await requireAdmin(ctx);

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) {
    throw new ConvexError("Lot not found");
  }

  if (lot.status !== "pending_review") {
    throw new ConvexError("Only lots in pending_review can be approved");
  }

  await ctx.db.patch("lots", args.lotId, {
    status: "approved",
    hiddenByFlags: false,
  });
  await adjustLotStatusCounters(ctx, "pending_review", "approved");

  return { success: true };
};

/**
 * Approve a lot for assignment to an auction (admin only).
 */
export const approveLot = mutation({
  args: { lotId: v.id("lots") },
  returns: v.object({ success: v.boolean() }),
  handler: approveLotHandler,
});

/**
 * Admin rejects a lot under review.
 * Transitions `pending_review -> rejected`. Legacy `startTime`/`endTime`
 * fields are left untouched; lots no longer own a time window.
 *
 * @param ctx - Mutation context.
 * @param args - Arguments including the lot id.
 * @param args.lotId - The lot being rejected.
 * @returns `{ success: true }` once rejected.
 */
export const rejectLotHandler = async (
  ctx: MutationCtx,
  args: { lotId: Id<"lots"> }
): Promise<{ success: boolean }> => {
  await requireAdmin(ctx);

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) {
    throw new ConvexError("Lot not found");
  }

  if (lot.status !== "pending_review") {
    throw new ConvexError("Only lots in pending_review can be rejected");
  }

  await ctx.db.patch("lots", args.lotId, {
    status: "rejected",
    hiddenByFlags: false,
  });
  await adjustLotStatusCounters(ctx, "pending_review", "rejected");

  return { success: true };
};

/**
 * Reject a lot during review (admin only).
 */
export const rejectLot = mutation({
  args: { lotId: v.id("lots") },
  returns: v.object({ success: v.boolean() }),
  handler: rejectLotHandler,
});
