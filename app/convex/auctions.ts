// app/convex/auctions.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

interface RawImages {
  front?: string;
  engine?: string;
  cabin?: string;
  rear?: string;
  additional?: string[];
}

async function resolveImageUrls(storage: QueryCtx["storage"], images: unknown) {
  const resolveUrl = async (id: string | undefined) => {
    if (!id) return undefined;
    if (id.startsWith("http")) return id;
    return (await storage.getUrl(id)) ?? undefined;
  };

  // Normalize legacy array format or non-object inputs
  let normalizedImages: RawImages;
  if (Array.isArray(images)) {
    normalizedImages = { additional: images as string[] };
  } else if (images && typeof images === "object") {
    normalizedImages = images as RawImages;
  } else {
    normalizedImages = { additional: [] };
  }

  return {
    ...normalizedImages,
    front: await resolveUrl(normalizedImages.front),
    engine: await resolveUrl(normalizedImages.engine),
    cabin: await resolveUrl(normalizedImages.cabin),
    rear: await resolveUrl(normalizedImages.rear),
    additional: (await Promise.all(
      (normalizedImages.additional || []).map(async (id: string) => 
        id.startsWith("http") ? id : await storage.getUrl(id)
      )
    )).filter((url: string | null | undefined): url is string => !!url),
  };
}

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
        images: await resolveImageUrls(ctx.storage, auction.images),
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
        images: await resolveImageUrls(ctx.storage, auction.images),
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
      images: await resolveImageUrls(ctx.storage, auction.images),
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

    if (durationDays <= 0 || durationDays > 365) {
      throw new Error("Invalid duration: must be between 1 and 365 days");
    }

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
      status: "rejected", 
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
