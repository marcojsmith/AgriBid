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
 * Calculate fees for a lot and persist them to the database.
 * Evaluates all active platform fees and creates lotFee records
 * based on each fee's configuration (percentage or fixed, buyer/seller/both).
 * Includes an idempotency guard to skip duplicate inserts.
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

  if (activeFees.length === 0) {
    return;
  }

  const salePrice = salesVolume ?? lot.currentPrice;
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
          q
            .eq("lotId", lot._id)
            .eq("feeId", fee._id)
            .eq("appliedTo", "seller")
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
          q
            .eq("lotId", lot._id)
            .eq("feeId", fee._id)
            .eq("appliedTo", "buyer")
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
 * Internal mutation to settle assigned lots whose effective end time has passed.
 * A lot is settled only while its parent auction is `published` and once
 * `extendedEndTime ?? auction.endTime <= now`. Transitions status to 'sold' if
 * the reserve is met, or 'unsold' otherwise. Unsold lots clear their
 * `auctionId` so admins can filter `status === "unsold"` and re-approve/reassign.
 *
 * @param ctx - The mutation context.
 * @returns Promise<void>
 */
export const settleExpiredAuctionsHandler = async (ctx: MutationCtx) => {
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

    // Check if there are any bids and if the currentPrice >= reservePrice
    const bids = await ctx.db
      .query("bids")
      .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
      .collect();

    // Filter out voided or invalid bids so they don't affect settlement
    const validBids = bids.filter((b: Doc<"bids">) => b.status !== "voided");

    const hasBids = validBids.length > 0;
    const reserveMet = lot.currentPrice >= lot.reservePrice;

    const finalStatus = hasBids && reserveMet ? "sold" : "unsold";

    let winnerId = undefined;
    if (finalStatus === "sold") {
      // Find the highest valid bid to determine the winner.
      // Tie-break: earlier bid wins if amounts are equal.
      const highestBid = validBids.reduce(
        (prev: Doc<"bids">, current: Doc<"bids">) => {
          if (current.amount > prev.amount) return current;
          if (current.amount === prev.amount) {
            return current.timestamp < prev.timestamp ? current : prev;
          }
          return prev;
        }
      );
      winnerId = highestBid.bidderId;
    }

    await ctx.db.patch("lots", lot._id, {
      status: finalStatus,
      winnerId,
      settledAt: now,
      // Unsold lots return to the pool for admin reassignment.
      ...(finalStatus === "unsold" ? { auctionId: undefined } : {}),
    });

    await updateCounter(ctx, "lots", "active", -1);

    if (finalStatus === "sold") {
      await updateCounter(ctx, "lots", "soldCount", 1);
      await updateCounter(ctx, "lots", "salesVolume", lot.currentPrice);
      const winningBid = validBids.reduce(
        (prev: Doc<"bids">, current: Doc<"bids">) => {
          if (current.amount > prev.amount) return current;
          if (current.amount === prev.amount) {
            return current.timestamp < prev.timestamp ? current : prev;
          }
          return prev;
        }
      );
      await calculateAndRecordFees(ctx, lot, winningBid.amount);
    }

    await logAuctionSettlementActivity(ctx, lot, finalStatus, winnerId);

    console.warn(
      `Lot ${lot._id} (${lot.title}) settled as ${finalStatus}${winnerId ? " (Winner: yes)" : ""}`
    );
  }

  return null;
};

/**
 * Internal mutation to settle auctions that have reached their end time.
 */
export const settleExpiredAuctions = internalMutation({
  args: {},
  returns: v.null(),
  handler: settleExpiredAuctionsHandler,
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
