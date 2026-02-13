// app/convex/auctions.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getActiveAuctions = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.search) {
      return await ctx.db
        .query("auctions")
        .withSearchIndex("search_title", (q) => 
          q.search("title", args.search!).eq("status", "active")
        )
        .collect();
    }
    
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
          // Better Auth uses 'userId' as the external identifier
          .withIndex("by_userId", (q) => q.eq("userId", bid.bidderId))
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

export const getEquipmentMetadata = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("equipmentMetadata").collect();
  },
});

export const getSellerInfo = query({
  args: { sellerId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .withIndex("by_userId", (q) => q.eq("userId", args.sellerId))
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

export const createAuction = mutation({
  args: {
    title: v.string(),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    operatingHours: v.number(),
    location: v.string(),
    startingPrice: v.number(),
    reservePrice: v.number(),
    images: v.array(v.string()),
    conditionChecklist: v.object({
      engine: v.boolean(),
      hydraulics: v.boolean(),
      tires: v.boolean(),
      serviceHistory: v.boolean(),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const auctionId = await ctx.db.insert("auctions", {
      ...args,
      sellerId: userId,
      status: "pending_review",
      currentPrice: args.startingPrice,
      minIncrement: args.startingPrice < 10000 ? 100 : 500,
      startTime: Date.now(), // Will be updated by admin upon approval
      endTime: Date.now() + 7 * 24 * 60 * 60 * 1000, // Default 7 days
    });

    return auctionId;
  },
});

export const approveAuction = mutation({
  args: { auctionId: v.id("auctions"), durationDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Enforce admin authorization
    // Note: Better Auth roles are mapped to identity.role in the Convex integration
    if (identity.role !== "admin") {
      throw new Error("Not authorized: Admin privileges required");
    }

    // Validate durationDays
    const durationDays = args.durationDays ?? 7;
    if (durationDays <= 0 || durationDays > 365) {
      throw new Error("Invalid duration: must be between 1 and 365 days");
    }
    
    const auction = await ctx.db.get(args.auctionId);
    if (!auction) throw new Error("Auction not found");
    if (auction.status !== "pending_review") {
      throw new Error("Only auctions in pending_review can be approved");
    }

    const startTime = Date.now();
    const durationMs = durationDays * 24 * 60 * 60 * 1000;
    const endTime = startTime + durationMs;

    await ctx.db.patch(args.auctionId, {
      status: "active",
      startTime,
      endTime,
    });

    return { success: true };
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
    let isExtended = auction.isExtended || false;
    
    if (timeRemaining < 120000) { // 2 minutes in ms
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
