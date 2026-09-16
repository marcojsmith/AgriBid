import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { updateCounter, logAudit } from "../admin_utils";
import { logActivity } from "../userActivity";
import { deleteAuctionImages, safeDelete } from "../lib/storage";
import {
  DRAFT_RETENTION_MS,
  CLEANUP_BATCH_SIZE,
  DRAFT_RETENTION_DAYS,
} from "../constants";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * A fee line item derived from a lot's auction-level defaults (the values
 * snapshotted onto the lot at assignment time).
 */
export interface ResolvedDefaultFee {
  appliedTo: "buyer" | "seller";
  rate: number;
  calculatedAmount: number;
}

/**
 * Compute the buyer/seller fee line items implied by a lot's snapshotted
 * auction fee defaults (`resolvedBuyerPremiumPct`/`resolvedSellerCommissionPct`).
 *
 * These amounts are intentionally NOT persisted to `lotFees`: that table's
 * `feeId` is a required FK to a real `platformFees` row, and auction defaults
 * are not `platformFees` rows. Keeping the amounts derived (rather than writing
 * fake ledger rows) also makes settlement idempotent by construction — there is
 * nothing to double-insert on a re-run. The read-side fee queries surface them
 * alongside the persisted `platformFees`-sourced rows.
 *
 * @param lot - The lot whose resolved defaults should be applied.
 * @param salePrice - The price the percentages are applied to.
 * @returns Zero, one, or two fee line items (buyer and/or seller).
 */
export function computeResolvedDefaultFees(
  lot: Doc<"lots">,
  salePrice: number
): ResolvedDefaultFee[] {
  const fees: ResolvedDefaultFee[] = [];

  if (lot.resolvedBuyerPremiumPct !== undefined) {
    fees.push({
      appliedTo: "buyer",
      rate: lot.resolvedBuyerPremiumPct,
      calculatedAmount:
        Math.round(salePrice * lot.resolvedBuyerPremiumPct * 100) / 100,
    });
  }

  if (lot.resolvedSellerCommissionPct !== undefined) {
    fees.push({
      appliedTo: "seller",
      rate: lot.resolvedSellerCommissionPct,
      calculatedAmount:
        Math.round(salePrice * lot.resolvedSellerCommissionPct * 100) / 100,
    });
  }

  return fees;
}

/**
 * Calculate fees for a lot and persist them to the database.
 * Evaluates all active platform fees and creates lotFee records
 * based on each fee's configuration (percentage or fixed, buyer/seller/both).
 * Includes an idempotency guard to skip duplicate inserts.
 *
 * The lot's snapshotted auction fee defaults (`resolvedBuyerPremiumPct`/
 * `resolvedSellerCommissionPct`) are also calculated and included in the audit
 * total, but are not persisted to `lotFees` — see `computeResolvedDefaultFees`.
 *
 * @param ctx - The mutation context for database operations.
 * @param lot - The lot document to calculate fees for.
 * @param salesVolume - Optional override for the sale price (e.g. actual winning amount).
 * @returns Promise<void>
 * Side effects: writes new lotFee records to the database, emits audit log entries.
 * @throws Error if database operations fail.
 */
export async function calculateAndRecordFees(
  ctx: MutationCtx,
  lot: Doc<"lots">,
  salesVolume?: number
): Promise<void> {
  const activeFees = await ctx.db
    .query("platformFees")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();

  const salePrice = salesVolume ?? lot.currentPrice;
  const defaultFees = computeResolvedDefaultFees(lot, salePrice);

  if (activeFees.length === 0 && defaultFees.length === 0) {
    return;
  }

  const now = Date.now();
  let totalFees = 0;

  for (const fee of activeFees) {
    let calculatedAmount = 0;

    if (fee.feeType === "percentage") {
      calculatedAmount = salePrice * fee.value;
    } else {
      calculatedAmount = fee.value;
    }

    calculatedAmount = Math.round(calculatedAmount * 100) / 100;

    if (fee.appliesTo === "both" || fee.appliesTo === "seller") {
      const existing = await ctx.db
        .query("lotFees")
        .withIndex("by_lot_fee_applied", (q) =>
          q.eq("lotId", lot._id).eq("feeId", fee._id).eq("appliedTo", "seller")
        )
        .first();

      if (!existing) {
        await ctx.db.insert("lotFees", {
          lotId: lot._id,
          feeId: fee._id,
          feeName: fee.name,
          appliedTo: "seller",
          feeType: fee.feeType,
          rate: fee.value,
          salePrice,
          calculatedAmount,
          createdAt: now,
        });
        totalFees += calculatedAmount;
      }
    }

    if (fee.appliesTo === "both" || fee.appliesTo === "buyer") {
      const existing = await ctx.db
        .query("lotFees")
        .withIndex("by_lot_fee_applied", (q) =>
          q.eq("lotId", lot._id).eq("feeId", fee._id).eq("appliedTo", "buyer")
        )
        .first();

      if (!existing) {
        await ctx.db.insert("lotFees", {
          lotId: lot._id,
          feeId: fee._id,
          feeName: fee.name,
          appliedTo: "buyer",
          feeType: fee.feeType,
          rate: fee.value,
          salePrice,
          calculatedAmount,
          createdAt: now,
        });
        totalFees += calculatedAmount;
      }
    }
  }

  for (const fee of defaultFees) {
    totalFees += fee.calculatedAmount;
  }

  if (totalFees > 0) {
    await logAudit(ctx, {
      action: "CALCULATE_FEES",
      targetId: lot._id,
      targetType: "lot",
      details: `Calculated ${totalFees.toFixed(2)} in fees for lot ${lot.title}`,
    });
  }
}

/**
 * Log activity-feed entries for a settled lot.
 *
 * Records `listing_sold` for the seller when the lot sold, and `bid_won`
 * for the winner when there is one. Shared by both settlement paths (manual
 * early closure and expiry settlement) so they stay consistent.
 *
 * @param ctx - The mutation context.
 * @param lot - The settled lot document (pre-patch snapshot).
 * @param finalStatus - The settlement outcome ("sold" or "unsold").
 * @param winnerId - The winning bidder's user ID, when the lot sold.
 */
export async function logAuctionSettlementActivity(
  ctx: MutationCtx,
  lot: Doc<"lots">,
  finalStatus: "sold" | "unsold",
  winnerId?: string
): Promise<void> {
  if (finalStatus === "sold") {
    await logActivity(ctx, {
      userId: lot.sellerId,
      type: "listing_sold",
      description: `Listing sold for R${lot.currentPrice.toLocaleString("en-ZA")}`,
      relatedId: lot._id,
    });
  }

  if (winnerId !== undefined) {
    await logActivity(ctx, {
      userId: winnerId,
      type: "bid_won",
      description: `Won auction for R${lot.currentPrice.toLocaleString("en-ZA")}`,
      relatedId: lot._id,
    });
  }
}

/**
 * Settle a single assigned lot: determine the winning bid (if any), patch the
 * lot to `sold`/`unsold`, update counters, record fees and log activity.
 *
 * Unsold lots have their `auctionId` cleared so admins can filter
 * `status === "unsold"` and re-approve/reassign them.
 *
 * Shared by the expiry cron (`settleExpiredLotsHandler`) and manual container
 * closure (`closeAuctionContainerHandler`), so both paths settle identically.
 *
 * @param ctx - The mutation context.
 * @param lot - The assigned lot to settle.
 * @param now - The settlement timestamp to record.
 * @returns The resulting lot status ("sold" or "unsold").
 */
export async function settleLot(
  ctx: MutationCtx,
  lot: Doc<"lots">,
  now: number
): Promise<"sold" | "unsold"> {
  const bids = await ctx.db
    .query("bids")
    .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
    .collect();

  // Filter out voided or invalid bids so they don't affect settlement
  const validBids = bids.filter((b: Doc<"bids">) => b.status !== "voided");

  const hasBids = validBids.length > 0;
  const reserveMet = lot.currentPrice >= lot.reservePrice;
  const finalStatus: "sold" | "unsold" =
    hasBids && reserveMet ? "sold" : "unsold";

  // Find the highest valid bid to determine the winner.
  // Tie-break: earlier bid wins if amounts are equal.
  const winningBid =
    finalStatus === "sold"
      ? validBids.reduce((prev: Doc<"bids">, current: Doc<"bids">) => {
          if (current.amount > prev.amount) return current;
          if (current.amount === prev.amount) {
            return current.timestamp < prev.timestamp ? current : prev;
          }
          return prev;
        })
      : undefined;
  const winnerId = winningBid?.bidderId;

  await ctx.db.patch("lots", lot._id, {
    status: finalStatus,
    winnerId,
    settledAt: now,
    // Unsold lots return to the pool for admin reassignment.
    ...(finalStatus === "unsold" ? { auctionId: undefined } : {}),
  });

  await updateCounter(ctx, "lots", "active", -1);

  if (finalStatus === "sold" && winningBid) {
    await updateCounter(ctx, "lots", "soldCount", 1);
    await updateCounter(ctx, "lots", "salesVolume", lot.currentPrice);
    await calculateAndRecordFees(ctx, lot, winningBid.amount);
  }

  await logAuctionSettlementActivity(ctx, lot, finalStatus, winnerId);

  console.warn(
    `Lot ${lot._id} (${lot.title}) settled as ${finalStatus}${winnerId ? " (Winner: yes)" : ""}`
  );

  return finalStatus;
}

/**
 * Closes published auction containers whose window has elapsed and which have
 * no lots still awaiting settlement (`assigned`). Containers with a lot whose
 * anti-snipe `extendedEndTime` runs past the auction window are left open until
 * that lot settles.
 *
 * @param ctx - The mutation context.
 * @param now - The current timestamp.
 * @returns Promise<void>
 */
async function closeCompletedAuctions(
  ctx: MutationCtx,
  now: number
): Promise<void> {
  const published = await ctx.db
    .query("auctions")
    .withIndex("by_status", (q) => q.eq("status", "published"))
    .collect();

  for (const auction of published) {
    if (auction.endTime > now) continue;

    const remaining = await ctx.db
      .query("lots")
      .withIndex("by_status_auctionId", (q) =>
        q.eq("status", "assigned").eq("auctionId", auction._id)
      )
      .collect();
    if (remaining.length > 0) continue;

    await ctx.db.patch("auctions", auction._id, {
      status: "closed",
      updatedAt: now,
    });
  }
}

/**
 * Internal mutation to settle assigned lots whose effective end time has passed.
 * A lot is settled only while its parent auction is `published` and once
 * `extendedEndTime ?? auction.endTime <= now`. Transitions status to 'sold' if
 * the reserve is met, or 'unsold' otherwise. Unsold lots clear their
 * `auctionId` so admins can filter `status === "unsold"` and re-approve/reassign.
 * Containers past their window with no remaining assigned lots are closed.
 *
 * @param ctx - The mutation context.
 * @returns Promise<void>
 */
export const settleExpiredLotsHandler = async (ctx: MutationCtx) => {
  const now = Date.now();
  const assignedLots = await ctx.db
    .query("lots")
    .withIndex("by_status", (q) => q.eq("status", "assigned"))
    .collect();

  for (const lot of assignedLots) {
    const auction = lot.auctionId
      ? await ctx.db.get("auctions", lot.auctionId)
      : null;

    // Only settle lots whose parent auction is live and whose effective
    // end time (anti-snipe extension included) has passed.
    const effectiveLotEndTime = lot.extendedEndTime ?? auction?.endTime ?? 0;
    if (auction?.status !== "published" || effectiveLotEndTime > now) {
      continue;
    }

    await settleLot(ctx, lot, now);
  }

  // Lifecycle hygiene: retire published containers once their window has
  // elapsed and every lot in them has settled.
  await closeCompletedAuctions(ctx, now);

  return null;
};

/**
 * Internal mutation to settle auctions that have reached their end time.
 */
export const settleExpiredLots = internalMutation({
  args: {},
  returns: v.null(),
  handler: settleExpiredLotsHandler,
});

/**
 * Handler for cleaning up abandoned draft lots.
 * Uses batching to stay within Convex mutation limits.
 *
 * @param ctx - The mutation context.
 * @param args - The arguments for the cleanup.
 * @param args.system - Whether this is a system-initiated cleanup (default: true).
 * @returns Object containing the number of deleted lots and errors encountered.
 */
export const cleanupDraftsHandler = async (
  ctx: MutationCtx,
  args: { system?: boolean } = { system: true }
) => {
  const cutoffTime = Date.now() - DRAFT_RETENTION_MS;

  // Process in batches to avoid hitting Convex limits
  const oldDrafts = (
    await ctx.db
      .query("lots")
      .withIndex("by_status", (q) =>
        q.eq("status", "draft").lte("_creationTime", cutoffTime)
      )
      .collect()
  ).slice(0, CLEANUP_BATCH_SIZE);

  let deleted = 0;
  let errors = 0;

  for (const lot of oldDrafts) {
    try {
      // Delete images
      await deleteAuctionImages(ctx, lot.images);

      // Delete condition report PDF if it exists
      if (lot.conditionReportUrl) {
        await safeDelete(ctx, lot.conditionReportUrl, "condition report");
      }

      await ctx.db.delete("lots", lot._id);
      deleted++;
    } catch (e) {
      console.error(`Failed to delete draft lot: ${lot._id}`, e);
      errors++;
    }
  }

  if (deleted > 0) {
    await logAudit(ctx, {
      action: "CLEANUP_DRAFT_LOTS",
      targetType: "system",
      system: args.system ?? true,
      details: JSON.stringify({
        deletedCount: deleted,
        errorCount: errors,
        cutoffTime: new Date(cutoffTime).toISOString(),
        retentionDays: DRAFT_RETENTION_DAYS,
      }),
    });

    await updateCounter(ctx, "lots", "total", -deleted);
    await updateCounter(ctx, "lots", "draft", -deleted);
  }

  console.warn(
    `Cleanup: deleted ${deleted.toString()} draft lots, ${errors.toString()} errors`
  );

  return { deleted, errors };
};

/**
 * Internal mutation to clean up old draft lots.
 * Deletes drafts older than 30 days and their associated storage.
 */
export const cleanupDrafts = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
    errors: v.number(),
  }),
  handler: cleanupDraftsHandler,
});
