import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { requireVerified } from "../../lib/auth";
import { logActivity } from "../../userActivity";
import { handleNewBid } from "../proxy_bidding";

/**
 * Minimum time between consecutive bids from the same user (issue #283).
 * Prevents bid spam / runaway function-call costs.
 */
export const BID_COOLDOWN_MS = 1000;

/**
 * Handler for placing a bid.
 * @param ctx - Mutation context
 * @param args - Arguments for placing a bid
 * @param args.auctionId - The ID of the auction
 * @param args.amount - The bid amount
 * @param args.maxBid - Optional maximum bid for proxy bidding
 * @returns The result of the bid placement
 */
export const placeBidHandler = async (
  ctx: MutationCtx,
  args: {
    auctionId: Id<"auctions">;
    amount: number;
    maxBid?: number;
  }
) => {
  // This also returns userId
  const { userId } = await requireVerified(ctx);

  // Per-user cooldown check (issue #283). Must happen before handleNewBid so
  // a rejected bid never consumes the cooldown window.
  const now = Date.now();
  const cooldown = await ctx.db
    .query("bidCooldowns")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (cooldown && now - cooldown.lastBidAt < BID_COOLDOWN_MS) {
    throw new ConvexError(
      "You're bidding too fast. Please wait a moment and try again."
    );
  }

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) throw new ConvexError("Auction not found");
  if (auction.status !== "active") throw new ConvexError("Auction not active");

  // Prevent sellers from bidding on their own auction
  if (auction.sellerId === userId) {
    throw new ConvexError("Sellers cannot bid on their own auction");
  }

  // Check if auction has expired
  if (!auction.endTime || auction.endTime <= Date.now()) {
    throw new ConvexError("Auction ended");
  }

  // Use handleNewBid for all bidding logic (including proxy and regular)
  const result = await handleNewBid(
    ctx,
    args.auctionId,
    userId,
    args.amount,
    args.maxBid
  );

  // Record the cooldown only after the bid succeeds, so a rejected bid
  // (e.g. "Auction ended") doesn't consume the cooldown window.
  if (cooldown) {
    await ctx.db.patch(cooldown._id, { lastBidAt: now });
  } else {
    await ctx.db.insert("bidCooldowns", { userId, lastBidAt: now });
  }

  // handleNewBid throws on any validation failure, so a resolved result
  // always represents a recorded bid and is safe to log.
  await logActivity(ctx, {
    userId,
    type: "bid_placed",
    description: `Bid placed: R${args.amount.toLocaleString("en-ZA")}`,
    relatedId: args.auctionId,
  });

  return {
    success: result.success,
    nextBidAmount: result.nextBidAmount,
    isProxyBid: result.isProxyBid,
    proxyBidActive: result.proxyBidActive,
    confirmedMaxBid: result.confirmedMaxBid,
  };
};

/**
 * Mutation to place a bid on an auction.
 */
export const placeBid = mutation({
  args: {
    auctionId: v.id("auctions"),
    amount: v.number(),
    maxBid: v.optional(v.number()), // Optional max bid for proxy bidding
  },
  returns: v.object({
    success: v.boolean(),
    nextBidAmount: v.optional(v.union(v.number(), v.null())), // Next bid amount if proxy bidding is active
    isProxyBid: v.boolean(), // Whether this bid was placed via proxy
    proxyBidActive: v.boolean(), // Whether the caller's proxy bid is active
    confirmedMaxBid: v.optional(v.number()), // The maximum bid amount confirmed by the server
  }),
  handler: placeBidHandler,
});
