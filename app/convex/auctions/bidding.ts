import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth } from "../lib/auth";

export const placeBid = mutation({
  args: { auctionId: v.id("auctions"), amount: v.number() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);

    const userId = authUser.userId ?? authUser._id;

    // Check Verification Status
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile?.isVerified) {
      throw new Error(
        "Account verification required to place bids. Please complete KYC."
      );
    }

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) throw new Error("Auction not found");
    if (auction.status !== "active") throw new Error("Auction not active");

    // Prevent sellers from bidding on their own auction
    if (auction.sellerId === userId) {
      throw new Error("Sellers cannot bid on their own auction");
    }

    // Check if auction has expired
    if (!auction.endTime || auction.endTime <= Date.now()) {
      throw new Error("Auction ended");
    }

    // Enforce Minimum Bid Increment
    const minimumRequired = auction.currentPrice + auction.minIncrement;
    if (args.amount < minimumRequired) {
      throw new Error(`Bid must be at least R${minimumRequired}`);
    }

    // Extend auction if bid placed in final 2 minutes (Soft Close)
    const timeRemaining = auction.endTime - Date.now();
    let newEndTime = auction.endTime;
    let isExtended = auction.isExtended || false;

    if (timeRemaining < 120000) {
      // 2 minutes in ms
      newEndTime = Date.now() + 120000;
      isExtended = true;
    }

    await ctx.db.patch(args.auctionId, {
      currentPrice: args.amount,
      endTime: newEndTime,
      isExtended,
    });

    await ctx.db.insert("bids", {
      auctionId: args.auctionId,
      bidderId: userId,
      amount: args.amount,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});
