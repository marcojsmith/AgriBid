// app/convex/auctions.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getPendingAuctions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.role !== "admin") {
      throw new Error("Not authorized: Admin privileges required");
    }

    const auctions = await ctx.db
      .query("auctions")
      .withIndex("by_status", (q) => q.eq("status", "pending_review"))
      .collect();

    return await Promise.all(
      auctions.map(async (auction) => ({
        ...auction,
        images: {
          ...auction.images,
          front: (auction.images.front?.startsWith("http") 
            ? auction.images.front 
            : await (auction.images.front ? ctx.storage.getUrl(auction.images.front) : Promise.resolve(undefined))) ?? undefined,
          engine: (auction.images.engine?.startsWith("http")
            ? auction.images.engine
            : await (auction.images.engine ? ctx.storage.getUrl(auction.images.engine) : Promise.resolve(undefined))) ?? undefined,
          cabin: (auction.images.cabin?.startsWith("http")
            ? auction.images.cabin
            : await (auction.images.cabin ? ctx.storage.getUrl(auction.images.cabin) : Promise.resolve(undefined))) ?? undefined,
          rear: (auction.images.rear?.startsWith("http")
            ? auction.images.rear
            : await (auction.images.rear ? ctx.storage.getUrl(auction.images.rear) : Promise.resolve(undefined))) ?? undefined,
          additional: (await Promise.all(
            (auction.images.additional || []).map(async (id) => 
              id.startsWith("http") ? id : await ctx.storage.getUrl(id)
            )
          )).filter((url): url is string => !!url),
        },
      }))
    );
  },
});

export const getActiveAuctions = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let auctions;
    if (args.search) {
      auctions = await ctx.db
        .query("auctions")
        .withSearchIndex("search_title", (q) => 
          q.search("title", args.search!).eq("status", "active")
        )
        .collect();
    } else {
      auctions = await ctx.db
        .query("auctions")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect();
    }

    return await Promise.all(
      auctions.map(async (auction) => ({
        ...auction,
        images: {
          ...auction.images,
          front: (auction.images.front?.startsWith("http") 
            ? auction.images.front 
            : await (auction.images.front ? ctx.storage.getUrl(auction.images.front) : Promise.resolve(undefined))) ?? undefined,
          engine: (auction.images.engine?.startsWith("http")
            ? auction.images.engine
            : await (auction.images.engine ? ctx.storage.getUrl(auction.images.engine) : Promise.resolve(undefined))) ?? undefined,
          cabin: (auction.images.cabin?.startsWith("http")
            ? auction.images.cabin
            : await (auction.images.cabin ? ctx.storage.getUrl(auction.images.cabin) : Promise.resolve(undefined))) ?? undefined,
          rear: (auction.images.rear?.startsWith("http")
            ? auction.images.rear
            : await (auction.images.rear ? ctx.storage.getUrl(auction.images.rear) : Promise.resolve(undefined))) ?? undefined,
          additional: (await Promise.all(
            (auction.images.additional || []).map(async (id) => 
              id.startsWith("http") ? id : await ctx.storage.getUrl(id)
            )
          )).filter((url): url is string => !!url),
        },
      }))
    );
  },
});

export const getAuctionById = query({
  args: { auctionId: v.id("auctions") },
  handler: async (ctx, args) => {
    const auction = await ctx.db.get(args.auctionId);
    if (!auction) return null;

    return {
      ...auction,
      images: {
        ...auction.images,
        front: (auction.images.front?.startsWith("http") 
          ? auction.images.front 
          : await (auction.images.front ? ctx.storage.getUrl(auction.images.front) : Promise.resolve(undefined))) ?? undefined,
        engine: (auction.images.engine?.startsWith("http")
          ? auction.images.engine
          : await (auction.images.engine ? ctx.storage.getUrl(auction.images.engine) : Promise.resolve(undefined))) ?? undefined,
        cabin: (auction.images.cabin?.startsWith("http")
          ? auction.images.cabin
          : await (auction.images.cabin ? ctx.storage.getUrl(auction.images.cabin) : Promise.resolve(undefined))) ?? undefined,
        rear: (auction.images.rear?.startsWith("http")
          ? auction.images.rear
          : await (auction.images.rear ? ctx.storage.getUrl(auction.images.rear) : Promise.resolve(undefined))) ?? undefined,
        additional: (await Promise.all(
          (auction.images.additional || []).map(async (id) => 
            id.startsWith("http") ? id : await ctx.storage.getUrl(id)
          )
        )).filter((url): url is string => !!url),
      },
    };
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

export const generateUploadUrl = mutation(async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return await ctx.storage.generateUploadUrl();
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
    durationDays: v.number(),
    images: v.object({
      front: v.optional(v.string()),
      engine: v.optional(v.string()),
      cabin: v.optional(v.string()),
      rear: v.optional(v.string()),
      additional: v.optional(v.array(v.string())),
    }),
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

    const { durationDays, ...restArgs } = args;

    if (restArgs.images.additional && restArgs.images.additional.length > 6) {
      throw new Error("Additional images limit exceeded (max 6)");
    }

    // Default additional to empty array if not provided (though validator requires it currently)
    const images = {
      ...restArgs.images,
      additional: restArgs.images.additional || [],
    };

    const auctionId = await ctx.db.insert("auctions", {
      ...restArgs,
      images,
      sellerId: userId,
      status: "pending_review",
      currentPrice: args.startingPrice,
      minIncrement: args.startingPrice < 10000 ? 100 : 500,
      startTime: Date.now(), // Will be updated by admin upon approval
      endTime: Date.now() + durationDays * 24 * 60 * 60 * 1000,
    });

    return auctionId;
  },
});

/**
 * Migration mutation to convert 'images' from array to object format.
 * Run this once after schema relaxation.
 */
export const migrateImages = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity?.role !== "admin") {
      throw new Error("Unauthorized: Admin only");
    }

    const auctions = await ctx.db.query("auctions").collect();
    let migratedCount = 0;

    for (const auction of auctions) {
      if (Array.isArray(auction.images)) {
        await ctx.db.patch(auction._id, {
          images: {
            front: undefined,
            engine: undefined,
            cabin: undefined,
            rear: undefined,
            additional: auction.images,
          },
        } as any);
        migratedCount++;
      }
    }

    return { migratedCount };
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

export const rejectAuction = mutation({
  args: { auctionId: v.id("auctions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.role !== "admin") {
      throw new Error("Not authorized: Admin privileges required");
    }

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) throw new Error("Auction not found");
    if (auction.status !== "pending_review") {
      throw new Error("Only auctions in pending_review can be rejected");
    }

    await ctx.db.patch(args.auctionId, {
      status: "unsold", // Using 'unsold' as rejection status for now
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
