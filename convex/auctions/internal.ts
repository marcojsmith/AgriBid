import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { updateCounter, logAudit } from "../admin_utils";
import { deleteAuctionImages } from "../lib/storage";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const DRAFT_RETENTION_DAYS = 30;
const DRAFT_RETENTION_MS = DRAFT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;

/**
 * Internal mutation to settle auctions that have reached their end time.
 * Transitions status to 'sold' if reserve is met, or 'unsold' otherwise.
 *
 * @param ctx
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
      await updateCounter(
        ctx,
        "auctions",
        "salesVolume",
        auction.currentPrice
      );
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
 * @param ctx - Mutation context
 * @param args
 * @param args.system - Whether this is a system-initiated cleanup (default: true)
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

  console.log(`Cleanup: deleted ${deleted} draft auctions, ${errors} errors`);

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
  handler: async (ctx) => {
    return await cleanupDraftsHandler(ctx);
  },
});
