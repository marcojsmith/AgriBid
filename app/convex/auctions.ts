import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import type { QueryCtx } from "./_generated/server";
import { components } from "./_generated/api";
import { getCallerRole } from "./users";

interface RawImages {
  front?: string;
  engine?: string;
  cabin?: string;
  rear?: string;
  additional?: string[];
}

/**
 * Resolve and normalize image references into accessible URLs.
 *
 * @param images - Image input in either legacy array form (treated as `additional`), a RawImages-like object, or any other value (treated as no images).
 * @returns An object matching the RawImages shape where `front`, `engine`, `cabin`, and `rear` are resolved to URLs or `undefined`, and `additional` is an array of resolved HTTP URLs. Non-HTTP IDs are resolved via the provided storage; entries that cannot be resolved are omitted from `additional`.
 */
export async function resolveImageUrls(storage: QueryCtx["storage"], images: unknown) {
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
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
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
  args: { 
    search: v.optional(v.string()),
    make: v.optional(v.string()),
    minYear: v.optional(v.number()),
    maxYear: v.optional(v.number()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    maxHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auctionsQuery = ctx.db.query("auctions");
    let auctions;

    if (args.search) {
      auctions = await auctionsQuery
        .withSearchIndex("search_title", (q) => 
          q.search("title", args.search!).eq("status", "active")
        )
        .collect();
    } else {
      auctions = await auctionsQuery
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect();
    }

    // Apply additional filters in memory for now (can be optimized with indexes later if needed)
    auctions = auctions.filter(a => {
      if (args.make && a.make !== args.make) return false;
      if (args.minYear !== undefined && a.year < args.minYear) return false;
      if (args.maxYear !== undefined && a.year > args.maxYear) return false;
      if (args.minPrice !== undefined && a.currentPrice < args.minPrice) return false;
      if (args.maxPrice !== undefined && a.currentPrice > args.maxPrice) return false;
      if (args.maxHours !== undefined && a.operatingHours > args.maxHours) return false;
      return true;
    });

    return await Promise.all(
      auctions.map(async (auction) => ({
        ...auction,
        images: await resolveImageUrls(ctx.storage, auction.images),
      }))
    );
  },
});

export const getActiveMakes = query({
  args: {},
  handler: async (ctx) => {
    const activeAuctions = await ctx.db
      .query("auctions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    
    const makes = Array.from(new Set(activeAuctions.map(a => a.make))).sort();
    return makes;
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
        const user = await ctx.runQuery(components.auth.adapter.findOne, {
          model: "user",
          where: [{ field: "userId", operator: "eq", value: bid.bidderId }]
        });
        
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
    // Query user details from the auth component's adapter
    const user = await ctx.runQuery(components.auth.adapter.findOne, {
      model: "user",
      where: [{ field: "userId", operator: "eq", value: args.sellerId }]
    });
    
    if (!user) return null;

    const linkId = user.userId ?? user._id;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", linkId))
      .unique();

    const soldAuctions = await ctx.db
      .query("auctions")
      .withIndex("by_seller_status", (q) => q.eq("sellerId", args.sellerId).eq("status", "sold"))
      .collect();

    return {
      name: user.name,
      isVerified: profile?.isVerified || false,
      role: profile?.role || "Private Seller",
      createdAt: user.createdAt,
      itemsSold: soldAuctions.length,
    };
  },
});

export const getSellerListings = query({
  args: { userId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("auctions")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.userId))
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "sold")
        )
      )
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      results.page.map(async (auction) => ({
        ...auction,
        images: await resolveImageUrls(ctx.storage, auction.images),
      }))
    );

    return {
      ...results,
      page,
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
    description: v.string(),
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
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
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
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
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

/**
 * Internal mutation to settle auctions that have reached their end time.
 * Transitions status to 'sold' if reserve is met, or 'unsold' otherwise.
 */
export const settleExpiredAuctions = internalMutation({
  args: {},
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

      const hasBids = bids.length > 0;
      const reserveMet = auction.currentPrice >= auction.reservePrice;

      const finalStatus = (hasBids && reserveMet) ? "sold" : "unsold";
      
      let winnerId = undefined;
      if (finalStatus === "sold") {
        // Find the highest bid to determine the winner.
        // Tie-break: earlier bid wins if amounts are equal.
        const highestBid = bids.reduce((prev, current) => {
          if (current.amount > prev.amount) return current;
          if (current.amount === prev.amount) {
            return current.timestamp < prev.timestamp ? current : prev;
          }
          return prev;
        });
        winnerId = highestBid.bidderId;
      }

      await ctx.db.patch(auction._id, {
        status: finalStatus,
        winnerId,
      });

      console.log(`Auction ${auction._id} (${auction.title}) settled as ${finalStatus}${winnerId ? " (Winner: yes)" : ""}`);
    }
  },
});

export const getMyBids = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    // Get all bids by this user
    const bids = await ctx.db
      .query("bids")
      .withIndex("by_bidder", (q) => q.eq("bidderId", userId))
      .collect();

    // Group by auctionId to get the latest status per auction
    const bidsByAuction = new Map<typeof bids[number]["auctionId"], typeof bids>();
    for (const bid of bids) {
      const existing = bidsByAuction.get(bid.auctionId);
      if (existing) {
        existing.push(bid);
      } else {
        bidsByAuction.set(bid.auctionId, [bid]);
      }
    }
    const auctionIds = Array.from(bidsByAuction.keys());

    const auctions = await Promise.all(
      auctionIds.map(async (id) => {
        const auction = await ctx.db.get(id);
        if (!auction) return null;
        
        // Find my highest bid on this auction
        const myBids = bidsByAuction.get(id) ?? [];
        const myHighestBid = Math.max(...myBids.map(b => b.amount));
        
        return {
          ...auction,
          images: await resolveImageUrls(ctx.storage, auction.images),
          myHighestBid,
          isWinning: auction.status === 'active' && myHighestBid === auction.currentPrice,
          isWon: auction.status === 'sold' && auction.winnerId === userId,
        };
      })
    );

    return auctions.filter((a): a is NonNullable<typeof a> => a !== null);
  },
});

export const getMyListings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    const listings = await ctx.db
      .query("auctions")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .collect();

    return await Promise.all(
      listings.map(async (auction) => ({
        ...auction,
        images: await resolveImageUrls(ctx.storage, auction.images),
      }))
    );
  },
});