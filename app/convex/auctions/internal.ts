import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { updateCounter } from "../admin_utils";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Internal mutation to settle auctions that have reached their end time.
 * Transitions status to 'sold' if reserve is met, or 'unsold' otherwise.
 */
export const settleExpiredAuctions = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
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

      console.log(
        `Auction ${auction._id} (${auction.title}) settled as ${finalStatus}${winnerId ? " (Winner: yes)" : ""}`
      );
    }
  },
});

export const cleanupDraftsHandler = async (ctx: MutationCtx) => {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const oldDrafts = await ctx.db
    .query("auctions")
    .withIndex("by_status", (q) => q.eq("status", "draft"))
    .filter((q) => q.lt(q.field("_creationTime"), thirtyDaysAgo))
    .collect();

  for (const draft of oldDrafts) {
    // Delete associated images
    const storageIds = [];
    if (draft.conditionReportUrl) storageIds.push(draft.conditionReportUrl);

    if (draft.images) {
      if (!Array.isArray(draft.images)) {
        if (draft.images.front) storageIds.push(draft.images.front);
        if (draft.images.engine) storageIds.push(draft.images.engine);
        if (draft.images.cabin) storageIds.push(draft.images.cabin);
        if (draft.images.rear) storageIds.push(draft.images.rear);
        if (draft.images.additional) {
          storageIds.push(...draft.images.additional);
        }
      } else {
        storageIds.push(...draft.images);
      }
    }

    for (const id of storageIds) {
      try {
        await ctx.storage.delete(id as Id<"_storage">);
      } catch {
        console.warn(
          `Failed to delete storage item ${id} for draft ${draft._id}`
        );
      }
    }

    await ctx.db.delete(draft._id);
  }
};

export const cleanupDrafts = internalMutation({
  args: {},
  returns: v.null(),
  handler: cleanupDraftsHandler,
});
