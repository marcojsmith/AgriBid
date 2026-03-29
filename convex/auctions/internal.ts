import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { updateCounter, logAudit } from "../admin_utils";
import { deleteAuctionImages } from "../lib/storage";
import {
  DRAFT_RETENTION_MS,
  CLEANUP_BATCH_SIZE,
  DRAFT_RETENTION_DAYS,
} from "../constants";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Calculate fees for an auction and persist them to the database.
 * Evaluates all active platform fees and creates auctionFee records
 * based on each fee's configuration (percentage or fixed, buyer/seller/both).
 * Includes an idempotency guard to skip duplicate inserts.
 *
 * @param ctx - The mutation context for database operations.
 * @param auction - The auction document to calculate fees for.
 * @param salesVolume - Optional override for the sale price (e.g. actual winning amount).
 * @returns Promise<void>
 * @sideEffects Writes new auctionFee records to the database, emits audit log entries.
 * @throws Error if database operations fail.
 */
export async function calculateAndRecordFees(
  ctx: MutationCtx,
  auction: Doc<"auctions">,
  salesVolume?: number
): Promise<void> {
  const activeFees = await ctx.db
    .query("platformFees")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();

  if (activeFees.length === 0) {
    return;
  }

  const salePrice = salesVolume ?? auction.currentPrice;
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
        .query("auctionFees")
        .withIndex("by_auction_fee_applied", (q) =>
          q
            .eq("auctionId", auction._id)
            .eq("feeId", fee._id)
            .eq("appliedTo", "seller")
        )
        .first();

      if (!existing) {
        await ctx.db.insert("auctionFees", {
          auctionId: auction._id,
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
        .query("auctionFees")
        .withIndex("by_auction_fee_applied", (q) =>
          q
            .eq("auctionId", auction._id)
            .eq("feeId", fee._id)
            .eq("appliedTo", "buyer")
        )
        .first();

      if (!existing) {
        await ctx.db.insert("auctionFees", {
          auctionId: auction._id,
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
      targetId: auction._id,
      targetType: "auction",
      details: `Calculated ${totalFees.toFixed(2)} in fees for auction ${auction.title}`,
    });
  }
}

/**
 * Internal mutation to settle auctions that have reached their end time.
 * Transitions status to 'sold' if reserve is met, or 'unsold' otherwise.
 *
 * @param ctx - The mutation context.
 * @returns Promise<void>
 */
export const settleExpiredAuctionsHandler = async (ctx: MutationCtx) => {
  const now = Date.now();
  const expiredAuctions = await ctx.db
    .query("auctions")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .filter((q) => q.lte(q.field("endTime"), now))
    .collect();

  for (const auction of expiredAuctions) {
    // Check if there are any bids and if the currentPrice >= reservePrice
    const bids = await ctx.db
      .query("bids")
      .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
      .collect();

    // Filter out voided or invalid bids so they don't affect settlement
    const validBids = bids.filter((b: Doc<"bids">) => b.status !== "voided");

    const hasBids = validBids.length > 0;
    const reserveMet = auction.currentPrice >= auction.reservePrice;

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

    await ctx.db.patch(auction._id, {
      status: finalStatus,
      winnerId,
    });

    await updateCounter(ctx, "auctions", "active", -1);

    if (finalStatus === "sold") {
      await updateCounter(ctx, "auctions", "soldCount", 1);
      await updateCounter(ctx, "auctions", "salesVolume", auction.currentPrice);
      const winningBid = validBids.reduce(
        (prev: Doc<"bids">, current: Doc<"bids">) => {
          if (current.amount > prev.amount) return current;
          if (current.amount === prev.amount) {
            return current.timestamp < prev.timestamp ? current : prev;
          }
          return prev;
        }
      );
      await calculateAndRecordFees(ctx, auction, winningBid.amount);
    }

    console.log(
      `Auction ${auction._id} (${auction.title}) settled as ${finalStatus}${winnerId ? " (Winner: yes)" : ""}`
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
 * Handler for cleaning up abandoned drafts.
 * Uses batching to stay within Convex mutation limits.
 *
 * @param ctx - The mutation context.
 * @param args - The arguments for the cleanup.
 * @param args.system - Whether this is a system-initiated cleanup (default: true).
 * @returns Object containing the number of deleted auctions and errors encountered.
 */
export const cleanupDraftsHandler = async (
  ctx: MutationCtx,
  args: { system?: boolean } = { system: true }
) => {
  const cutoffTime = Date.now() - DRAFT_RETENTION_MS;

  // Process in batches to avoid hitting Convex limits
  const oldDrafts = (
    await ctx.db
      .query("auctions")
      .withIndex("by_status", (q) =>
        q.eq("status", "draft").lte("_creationTime", cutoffTime)
      )
      .collect()
  ).slice(0, CLEANUP_BATCH_SIZE);

  let deleted = 0;
  let errors = 0;

  for (const auction of oldDrafts) {
    try {
      // Delete images
      await deleteAuctionImages(ctx, auction.images);

      // Delete condition report PDF if it exists
      if (auction.conditionReportUrl) {
        try {
          await ctx.storage.delete(
            auction.conditionReportUrl as Id<"_storage">
          );
        } catch (e) {
          console.warn(
            `Failed to delete condition report: ${auction.conditionReportUrl}`,
            e
          );
        }
      }

      await ctx.db.delete(auction._id);
      deleted++;
    } catch (e) {
      console.error(`Failed to delete draft auction: ${auction._id}`, e);
      errors++;
    }
  }

  if (deleted > 0) {
    await logAudit(ctx, {
      action: "CLEANUP_DRAFT_AUCTIONS",
      targetType: "system",
      system: args.system ?? true,
      details: JSON.stringify({
        deletedCount: deleted,
        errorCount: errors,
        cutoffTime: new Date(cutoffTime).toISOString(),
        retentionDays: DRAFT_RETENTION_DAYS,
      }),
    });

    await updateCounter(ctx, "auctions", "total", -deleted);
    await updateCounter(ctx, "auctions", "draft", -deleted);
  }

  console.log(
    `Cleanup: deleted ${deleted.toString()} draft auctions, ${errors.toString()} errors`
  );

  return { deleted, errors };
};

/**
 * Internal mutation to clean up old draft auctions.
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
