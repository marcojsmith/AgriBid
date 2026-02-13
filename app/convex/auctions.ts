// app/convex/auctions.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getActiveAuctions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("auctions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const getAuctionById = query({
  args: { auctionId: v.id("auctions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.auctionId);
  },
});

export const getAuctionBids = query({
  args: { auctionId: v.id("auctions") },
  handler: async (ctx, args) => {
    const bids = await ctx.db
      .query("bids")
      .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
      .order("desc")
      .take(50);

    const bidsWithUsers = await Promise.all(
      bids.map(async (bid) => {
        const user = await ctx.db
          .query("user")
          // Use filter because bidderId is a string from Better Auth
          .filter((q) => q.eq(q.field("_id"), bid.bidderId))
          .first();
        
        return {
          ...bid,
          bidderName: user?.name || "Anonymous",
        };
      })
    );

    return bidsWithUsers;
  },
});

export const getSellerInfo = query({
  args: { sellerId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("_id"), args.sellerId))
      .first();
    
    if (!user) return null;

    return {
      name: user.name,
      isVerified: user.isVerified || false,
      role: user.role || "Private Seller",
      createdAt: user.createdAt,
    };
  },
});

export const placeBid = mutation({
  args: { auctionId: v.id("auctions"), amount: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) throw new Error("Auction not found");
    if (auction.status !== "active") throw new Error("Auction not active");

    // Prevent sellers from bidding on their own auction
    if (auction.sellerId === userId) {
      throw new Error("Sellers cannot bid on their own auction");
    }
    
    // Check if auction has expired
    if (auction.endTime <= Date.now()) {
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
    if (timeRemaining < 120000) { // 2 minutes in ms
      newEndTime = Date.now() + 120000;
    }

    await ctx.db.patch(args.auctionId, {
      currentPrice: args.amount,
      endTime: newEndTime,
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
