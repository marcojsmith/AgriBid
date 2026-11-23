import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import { getBuyerPremiumPct } from "../../admin/platformSettings";
import { requireAdmin } from "../../lib/auth";
import { issueNextLotNumber } from "../../lib/lotCounters";
import { adjustLotStatusCounters } from "../../lots/mutations/helpers";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/** Active `platformFees` rows inspected when looking for a buyer percentage fee. */
const ACTIVE_FEE_SCAN_CAP = 50;

/**
 * Whether any active platform fee is a percentage fee charged to buyers.
 * Settlement applies every such row, so the platform premium fallback must not
 * also be snapshotted onto the lot.
 *
 * @param ctx - Mutation context.
 * @returns True when an active percentage fee applies to buyer or both.
 */
async function hasActiveBuyerPercentageFee(ctx: MutationCtx): Promise<boolean> {
  const activeFees = await ctx.db
    .query("platformFees")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .take(ACTIVE_FEE_SCAN_CAP);
  return activeFees.some(
    (fee) =>
      fee.feeType === "percentage" &&
      (fee.appliesTo === "buyer" || fee.appliesTo === "both")
  );
}

/**
 * Admin assigns an approved lot to an auction container.
 * The target auction does not need to be published yet: admins may pre-stage
 * lots into a `draft` auction before publishing it.
 *
 * Snapshots the auction's fee defaults (`defaultBuyerPremiumPct`/
 * `defaultSellerCommissionPct`) onto the lot's `resolvedBuyerPremiumPct`/
 * `resolvedSellerCommissionPct` fields so later auction edits cannot
 * retroactively change this lot's fees (issue #318).
 *
 * @param ctx - Mutation context.
 * @param args - The lot and target auction ids.
 * @param args.lotId - The approved lot to assign.
 * @param args.auctionId - The auction container to assign it to.
 * @returns `{ success: true }` once assigned.
 */
export const assignLotToAuctionHandler = async (
  ctx: MutationCtx,
  args: { lotId: Id<"lots">; auctionId: Id<"auctions"> }
): Promise<{ success: boolean }> => {
  await requireAdmin(ctx);

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) {
    throw new ConvexError("Lot not found");
  }

  if (lot.status !== "approved") {
    throw new ConvexError("Only approved lots can be assigned to an auction");
  }

  const auction = await ctx.db.get("auctions", args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  if (auction.status === "closed") {
    throw new ConvexError("Cannot assign lots to a closed auction");
  }

  // Resolve the auction's fee defaults onto the lot now, so later edits to the
  // auction's defaults cannot change an already-assigned lot's fees (issue #318).
  // When the auction sets no premium, fall back to the platform-wide buyer
  // premium (stored as a percent; lots hold a fraction, rounded to 4 dp) --
  // but only if settlement will not already charge a percentage buyer fee from
  // `platformFees`, otherwise the buyer would be charged twice.
  const resolvedBuyerPremiumPct =
    auction.defaultBuyerPremiumPct ??
    ((await hasActiveBuyerPercentageFee(ctx))
      ? undefined
      : Math.round((await getBuyerPremiumPct(ctx)) * 100) / 10000);
  const lotNumber = await issueNextLotNumber(ctx, args.auctionId);
  await ctx.db.patch("lots", args.lotId, {
    auctionId: args.auctionId,
    lotNumber,
    status: "assigned",
    resolvedBuyerPremiumPct,
    resolvedSellerCommissionPct: auction.defaultSellerCommissionPct,
  });
  await adjustLotStatusCounters(ctx, "approved", "assigned");

  return { success: true };
};

/**
 * Assign an approved lot to an auction (admin only).
 */
export const assignLotToAuction = mutation({
  args: { lotId: v.id("lots"), auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: assignLotToAuctionHandler,
});

/**
 * Admin removes a lot from its auction, returning it to the approved pool.
 * `assigned -> approved`. This is the manual "unsold lot returns for
 * reassignment" path; settlement-driven auto-unassignment is handled in step 4.
 *
 * @param ctx - Mutation context.
 * @param args - The lot to unassign.
 * @param args.lotId - The assigned lot to return to the approved pool.
 * @returns `{ success: true }` once unassigned.
 */
export const unassignLotHandler = async (
  ctx: MutationCtx,
  args: { lotId: Id<"lots"> }
): Promise<{ success: boolean }> => {
  await requireAdmin(ctx);

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) {
    throw new ConvexError("Lot not found");
  }

  if (lot.status !== "assigned") {
    throw new ConvexError("Only assigned lots can be unassigned");
  }

  await ctx.db.patch("lots", args.lotId, {
    auctionId: undefined,
    lotNumber: undefined,
    status: "approved",
  });
  await adjustLotStatusCounters(ctx, "assigned", "approved");

  return { success: true };
};

/**
 * Unassign a lot from its auction (admin only).
 */
export const unassignLot = mutation({
  args: { lotId: v.id("lots") },
  returns: v.object({ success: v.boolean() }),
  handler: unassignLotHandler,
});
