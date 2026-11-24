import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import { getBuyerPremiumPct } from "../../admin/platformSettings";
import { requireAdmin } from "../../lib/auth";
import { percentToFraction } from "../../lib/buyerPremium";
import { issueNextLotNumber, syncAuctionLotCount } from "../../lib/lotCounters";
import { adjustLotStatusCounters } from "../../lots/mutations/helpers";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/**
 * Admin assigns an approved lot to an auction container.
 * The target auction does not need to be published yet: admins may pre-stage
 * lots into a `draft` auction before publishing it.
 *
 * Snapshots, so later edits cannot retroactively change this lot:
 * - the auction's fee defaults (`defaultBuyerPremiumPct`/
 *   `defaultSellerCommissionPct`) onto `resolvedBuyerPremiumPct`/
 *   `resolvedSellerCommissionPct` (issue #318). The buyer premium is always
 *   snapshotted: from the auction with `premiumSource: "auction"`, otherwise
 *   the platform default (percent -> fraction, 4 dp) with `premiumSource:
 *   "platform"`. Settlement decides which premium actually applies (see
 *   `resolveBuyerPremium`), so the buyer is never charged twice. The seller
 *   commission is snapshotted only when the auction sets one, with
 *   `commissionSource: "auction"`; it then replaces active seller % fee rows
 *   (see `resolveSellerCommission`).
 * - the seller's VAT status and type from their profile (unset stays
 *   undefined, i.e. unknown, which is treated as VAT-registered).
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

  const premiumSource =
    auction.defaultBuyerPremiumPct !== undefined
      ? ("auction" as const)
      : ("platform" as const);
  const resolvedBuyerPremiumPct =
    auction.defaultBuyerPremiumPct ??
    percentToFraction(await getBuyerPremiumPct(ctx));

  const sellerProfile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", lot.sellerId))
    .unique();

  const lotNumber = await issueNextLotNumber(ctx, args.auctionId);
  await ctx.db.patch("lots", args.lotId, {
    auctionId: args.auctionId,
    lotNumber,
    status: "assigned",
    resolvedBuyerPremiumPct,
    premiumSource,
    resolvedSellerCommissionPct: auction.defaultSellerCommissionPct,
    commissionSource:
      auction.defaultSellerCommissionPct !== undefined
        ? ("auction" as const)
        : undefined,
    sellerVatRegistered: sellerProfile?.vatRegistered,
    sellerType: sellerProfile?.sellerType,
  });
  await adjustLotStatusCounters(ctx, "approved", "assigned");
  await syncAuctionLotCount(ctx, lot, {
    status: "assigned",
    auctionId: args.auctionId,
    hiddenByFlags: lot.hiddenByFlags,
  });

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
  await syncAuctionLotCount(ctx, lot, {
    status: "approved",
    auctionId: undefined,
    hiddenByFlags: lot.hiddenByFlags,
  });

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
