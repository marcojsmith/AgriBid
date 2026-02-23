import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { updateCounter } from "../admin_utils";
import type { Doc } from "../_generated/dataModel";

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
