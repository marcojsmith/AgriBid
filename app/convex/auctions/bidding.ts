import { v, ConvexError } from "convex/values";

import { mutation } from "../_generated/server";
import { requireVerified } from "../lib/auth";
import { handleNewBid } from "./proxy_bidding";

/**
 * Mutation to place a bid on an auction.
 *
 * Validates that the user is verified, the auction exists and is active,
 * the user is not the seller, and the auction hasn't ended.
 * Delegates the core bidding and proxy logic to `handleNewBid`.
 *
 * @param ctx - Convex Mutation context
 * @param args - Mutation arguments
 * @param args.auctionId - ID of the auction to bid on
 * @param args.amount - Bid amount
 * @param args.maxBid - Optional maximum bid for proxy bidding
 * @returns Object containing:
 *  - `success`: Whether the bid was accepted
 *  - `nextBidAmount`: Suggested next bid amount
 *  - `isProxyBid`: Whether this was a proxy bid
 *  - `proxyBidActive`: Whether the user's proxy bid is currently winning
 *  - `confirmedMaxBid`: The max bid stored on the server
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
  handler: async (ctx, args) => {
    // This also returns userId
    const { userId } = await requireVerified(ctx);

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) throw new ConvexError("Auction not found");
    if (auction.status !== "active")
      throw new ConvexError("Auction not active");

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

    return {
      success: result.success,
      nextBidAmount: result.nextBidAmount,
      isProxyBid: result.isProxyBid,
      proxyBidActive: result.proxyBidActive,
      confirmedMaxBid: result.confirmedMaxBid,
    };
  },
});
