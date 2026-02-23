import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import type { QueryCtx } from "./_generated/server";
import { getCallerRole, findUserById } from "./users";
import type { Doc, Id } from "./_generated/dataModel";
import { logAudit, updateCounter } from "./admin_utils";
import { authComponent } from "./auth";
import { resolveUrlCached } from "./image_cache";

interface RawImages {
  front?: string;
  engine?: string;
  cabin?: string;
  rear?: string;
  additional?: string[];
}

/**
 * Normalises image references and resolves them to accessible URLs.
 *
 * Accepts either a legacy array (treated as `additional`), a RawImages-like object, or any other value (treated as no images).
 *
 * @param storage - Convex storage context
 * @param images - Image input: an array of storage IDs (legacy), a RawImages-like object { front, engine, cabin, rear, additional }, or any other value to indicate no images.
 * @param options - Optional configuration, e.g., { limit: number } to cap additional images.
 * @returns An object with the RawImages shape where `front`, `engine`, `cabin`, and `rear` are either resolved HTTP URLs or `undefined`, and `additional` is an array of resolved HTTP URLs with any unresolvable entries omitted.
 */
export async function resolveImageUrls(
  storage: QueryCtx["storage"],
  images: unknown,
  options: { limit?: number } = {}
) {
  // Normalize legacy array format or non-object inputs
  let normalizedImages: RawImages;
  if (Array.isArray(images)) {
    normalizedImages = {
      additional: images.filter((i): i is string => typeof i === "string"),
    };
  } else if (images && typeof images === "object") {
    normalizedImages = { ...(images as RawImages) };
  } else {
    normalizedImages = { additional: [] };
  }

  // Apply limit to additional images if specified
  if (options.limit !== undefined && normalizedImages.additional) {
    normalizedImages.additional = normalizedImages.additional.slice(
      0,
      options.limit
    );
  }

  return {
    ...normalizedImages,
    front: await resolveUrlCached(storage, normalizedImages.front),
    engine: await resolveUrlCached(storage, normalizedImages.engine),
    cabin: await resolveUrlCached(storage, normalizedImages.cabin),
    rear: await resolveUrlCached(storage, normalizedImages.rear),
    additional: (
      await Promise.all(
        (normalizedImages.additional || []).map(async (id: string) =>
          await resolveUrlCached(storage, id)
        )
      )
    ).filter((url: string | undefined): url is string => !!url),
  };
}

/**
 * Validator for a compact auction summary suitable for list views.
 * Designed to be type-compatible with Doc<"auctions"> while omitting heavy data.
 */
export const AuctionSummaryValidator = v.object({
  _id: v.id("auctions"),
  _creationTime: v.number(),
  title: v.string(),
  make: v.string(),
  model: v.string(),
  year: v.number(),
  operatingHours: v.number(),
  location: v.string(),
  reservePrice: v.number(),
  startingPrice: v.number(),
  currentPrice: v.number(),
  minIncrement: v.number(),
  startTime: v.number(),
  endTime: v.number(),
  sellerId: v.string(),
  status: v.string(),
  winnerId: v.optional(v.string()),
  description: v.optional(v.string()),
  conditionReportUrl: v.optional(v.string()),
  isExtended: v.optional(v.boolean()),
  seedId: v.optional(v.string()),
  images: v.object({
    front: v.optional(v.string()),
    engine: v.optional(v.string()),
    cabin: v.optional(v.string()),
    rear: v.optional(v.string()),
    additional: v.array(v.string()),
  }),
  // Omit heavy conditionChecklist in summaries
  conditionChecklist: v.optional(v.any()),
});

/**
 * Create a compact auction summary suitable for list views.
 *
 * Produces a minimal projection of the auction containing identifying fields,
 * timing and pricing info, location, and a thumbnail image URL.
 *
 * @param ctx - Query context
 * @param auction - The auction document to summarise
 * @returns A skinny auction object compatible with AuctionCard
 */
export async function toAuctionSummary(ctx: QueryCtx, auction: Doc<"auctions">) {
  return {
    _id: auction._id,
    _creationTime: auction._creationTime,
    title: auction.title,
    description: auction.description,
    make: auction.make,
    model: auction.model,
    year: auction.year,
    currentPrice: auction.currentPrice,
    startingPrice: auction.startingPrice,
    minIncrement: auction.minIncrement,
    startTime: auction.startTime,
    endTime: auction.endTime,
    status: auction.status,
    reservePrice: auction.reservePrice,
    operatingHours: auction.operatingHours,
    location: auction.location,
    sellerId: auction.sellerId,
    winnerId: auction.winnerId,
    conditionReportUrl: auction.conditionReportUrl,
    isExtended: auction.isExtended,
    seedId: auction.seedId,
    // List views only need the front image (thumbnail)
    images: await resolveImageUrls(ctx.storage, auction.images, { limit: 0 }),
  };
}

/**
 * Validator for a full auction document with resolved URLs.
 */
export const AuctionDetailValidator = v.object({
  _id: v.id("auctions"),
  _creationTime: v.number(),
  title: v.string(),
  make: v.string(),
  model: v.string(),
  year: v.number(),
  operatingHours: v.number(),
  location: v.string(),
  description: v.optional(v.string()),
  startingPrice: v.number(),
  reservePrice: v.number(),
  durationDays: v.optional(v.number()),
  images: v.object({
    front: v.optional(v.string()),
    engine: v.optional(v.string()),
    cabin: v.optional(v.string()),
    rear: v.optional(v.string()),
    additional: v.array(v.string()),
  }),
  conditionChecklist: v.optional(
    v.object({
      engine: v.boolean(),
      hydraulics: v.boolean(),
      tires: v.boolean(),
      serviceHistory: v.boolean(),
      notes: v.optional(v.string()),
    })
  ),
  sellerId: v.string(),
  status: v.string(),
  currentPrice: v.number(),
  minIncrement: v.number(),
  startTime: v.number(),
  endTime: v.number(),
  isExtended: v.optional(v.boolean()),
  winnerId: v.optional(v.string()),
  seedId: v.optional(v.string()),
  conditionReportUrl: v.optional(v.string()),
});

/**
 * Resolves full auction details including all image URLs.
 */
async function toAuctionDetail(ctx: QueryCtx, auction: Doc<"auctions">) {
  return {
    ...auction,
    images: await resolveImageUrls(ctx.storage, auction.images),
  };
}

export const getPendingAuctions = query({
  args: {},
  returns: v.array(AuctionSummaryValidator),
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
      auctions.map((auction) => toAuctionSummary(ctx, auction))
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
  returns: v.array(AuctionSummaryValidator),
  handler: async (ctx, args) => {
    const auctionsQuery = ctx.db.query("auctions");
    let auctions;

    if (args.search) {
      auctions = await auctionsQuery
        .withSearchIndex("search_title", (q) =>
          q.search("title", args.search!).eq("status", "active")
        )
        .collect();
    } else if (args.make) {
      // Use composite index for status + make
      auctions = await auctionsQuery
        .withIndex("by_status_make", (q) =>
          q.eq("status", "active").eq("make", args.make!)
        )
        .collect();
    } else if (args.minYear !== undefined || args.maxYear !== undefined) {
      // Use composite index for status + year (range)
      auctions = await auctionsQuery
        .withIndex("by_status_year", (q) => {
          const statusQuery = q.eq("status", "active");
          if (args.minYear !== undefined && args.maxYear !== undefined) {
            return statusQuery
              .gte("year", args.minYear)
              .lte("year", args.maxYear);
          }
          if (args.minYear !== undefined) {
            return statusQuery.gte("year", args.minYear);
          }
          if (args.maxYear !== undefined) {
            return statusQuery.lte("year", args.maxYear);
          }
          return statusQuery;
        })
        .collect();
    } else {
      // Default: status only
      auctions = await auctionsQuery
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect();
    }

    // Apply remaining in-memory filters
    auctions = auctions.filter((a) => {
      if (args.make && a.make !== args.make) return false;
      if (args.minYear !== undefined && a.year < args.minYear) return false;
      if (args.maxYear !== undefined && a.year > args.maxYear) return false;
      if (args.minPrice !== undefined && a.currentPrice < args.minPrice)
        return false;
      if (args.maxPrice !== undefined && a.currentPrice > args.maxPrice)
        return false;
      if (args.maxHours !== undefined && a.operatingHours > args.maxHours)
        return false;
      return true;
    });

    return await Promise.all(
      auctions.map((auction) => toAuctionSummary(ctx, auction))
    );
  },
});

export const getActiveMakes = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const metadata = await ctx.db.query("equipmentMetadata").collect();
    const makes = Array.from(new Set(metadata.map((m) => m.make))).sort();
    return makes;
  },
});

export const getAuctionById = query({
  args: { auctionId: v.id("auctions") },
  returns: v.union(v.null(), AuctionDetailValidator),
  handler: async (ctx, args) => {
    const auction = await ctx.db.get(args.auctionId);
    if (!auction) return null;

    return await toAuctionDetail(ctx, auction);
  },
});

export const getAuctionBids = query({
  args: { auctionId: v.id("auctions") },
  returns: v.array(
    v.object({
      _id: v.id("bids"),
      _creationTime: v.number(),
      auctionId: v.id("auctions"),
      bidderId: v.string(),
      amount: v.number(),
      timestamp: v.number(),
      status: v.optional(v.union(v.literal("valid"), v.literal("voided"))),
      bidderName: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const bids = await ctx.db
      .query("bids")
      .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
      .order("desc")
      .take(50);

    const uniqueBidderIds = Array.from(new Set(bids.map((b) => b.bidderId)));
    const bidderNames = new Map<string, string>();

    await Promise.all(
      uniqueBidderIds.map(async (bidderId) => {
        const user = await findUserById(ctx, bidderId);

        if (user) {
          bidderNames.set(bidderId, user.name ?? "Anonymous");
        } else {
          bidderNames.set(bidderId, "Anonymous");
        }
      })
    );

    const bidsWithUsers = bids.map((bid) => ({
      ...bid,
      bidderName: bidderNames.get(bid.bidderId) || "Anonymous",
    }));

    return bidsWithUsers;
  },
});

export const getEquipmentMetadata = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("equipmentMetadata"),
      _creationTime: v.number(),
      make: v.string(),
      models: v.array(v.string()),
      category: v.string(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("equipmentMetadata").take(100);
  },
});

export const getSellerInfo = query({
  args: { sellerId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      name: v.optional(v.string()),
      isVerified: v.boolean(),
      role: v.string(),
      createdAt: v.optional(v.number()),
      itemsSold: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Query user details from the auth component's adapter
    const user = await findUserById(ctx, args.sellerId);

    if (!user) return null;

    const linkId = user.userId ?? user._id;
    if (!linkId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", linkId))
      .unique();

    const soldAuctions = await ctx.db
      .query("auctions")
      .withIndex("by_seller_status", (q) =>
        q.eq("sellerId", args.sellerId).eq("status", "sold")
      )
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
  returns: v.object({
    page: v.array(AuctionSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("auctions")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.userId))
      .filter((q) =>
        q.or(q.eq(q.field("status"), "active"), q.eq(q.field("status"), "sold"))
      )
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      results.page.map(async (auction) => await toAuctionSummary(ctx, auction))
    );

    return {
      ...results,
      page,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const deleteUpload = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Unauthorized: Only admins can delete storage items");
    }

    // Verify existence before deletion
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      console.warn(
        `Attempted to delete non-existent storage item: ${args.storageId}`
      );
      return;
    }

    await ctx.storage.delete(args.storageId);
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
  returns: v.id("auctions"),
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }
    const userId = authUser.userId ?? authUser._id;

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

    await updateCounter(ctx, "auctions", "total", 1);
    await updateCounter(ctx, "auctions", "pending", 1);

    return auctionId;
  },
});

export const approveAuction = mutation({
  args: { auctionId: v.id("auctions"), durationDays: v.optional(v.number()) },
  returns: v.object({ success: v.boolean() }),
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

    await updateCounter(ctx, "auctions", "pending", -1);
    await updateCounter(ctx, "auctions", "active", 1);

    return { success: true };
  },
});

export const rejectAuction = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
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

    await updateCounter(ctx, "auctions", "pending", -1);

    return { success: true };
  },
});

export const placeBid = mutation({
  args: { auctionId: v.id("auctions"), amount: v.number() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }

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

      const hasBids = bids.length > 0;
      const reserveMet = auction.currentPrice >= auction.reservePrice;

      const finalStatus = hasBids && reserveMet ? "sold" : "unsold";

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

      await updateCounter(ctx, "auctions", "active", -1);

      console.log(
        `Auction ${auction._id} (${auction.title}) settled as ${finalStatus}${winnerId ? " (Winner: yes)" : ""}`
      );
    }
  },
});

/**
 * Admin: List all auctions for full management.
 */
export const getAllAuctions = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(AuctionSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Not authorized");
    }

    const auctions = await ctx.db
      .query("auctions")
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...auctions,
      page: await Promise.all(
        auctions.page.map(async (auction) => await toAuctionSummary(ctx, auction))
      ),
    };
  },
});

/**
 * Admin: Update any field of an auction.
 */
export const adminUpdateAuction = mutation({
  args: {
    auctionId: v.id("auctions"),
    updates: v.object({
      title: v.optional(v.string()),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      year: v.optional(v.number()),
      operatingHours: v.optional(v.number()),
      location: v.optional(v.string()),
      description: v.optional(v.string()),
      startingPrice: v.optional(v.number()),
      reservePrice: v.optional(v.number()),
      status: v.optional(
        v.union(
          v.literal("draft"),
          v.literal("pending_review"),
          v.literal("active"),
          v.literal("sold"),
          v.literal("unsold"),
          v.literal("rejected")
        )
      ),
      startTime: v.optional(v.number()),
      endTime: v.optional(v.number()),
      currentPrice: v.optional(v.number()),
    }),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Not authorized");
    }

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) throw new Error("Auction not found");

    const oldStatus = auction.status;
    const newStatus = args.updates.status;

    await ctx.db.patch(args.auctionId, args.updates);

    if (newStatus && oldStatus !== newStatus) {
      const statusToCounterKey: Record<
        string,
        "active" | "pending" | undefined
      > = {
        active: "active",
        pending_review: "pending",
      };

      const oldKey = statusToCounterKey[oldStatus];
      const newKey = statusToCounterKey[newStatus];

      if (oldKey) await updateCounter(ctx, "auctions", oldKey, -1);
      if (newKey) await updateCounter(ctx, "auctions", newKey, 1);
    }

    await logAudit(ctx, {
      action: "UPDATE_AUCTION",
      targetId: args.auctionId,
      targetType: "auction",
      details: JSON.stringify(args.updates),
    });

    return { success: true };
  },
});

/**
 * Admin: Bulk update multiple auctions.
 */
const MAX_BULK_UPDATE_SIZE = 50;

export const bulkUpdateAuctions = mutation({
  args: {
    auctionIds: v.array(v.id("auctions")),
    updates: v.object({
      status: v.optional(
        v.union(
          v.literal("draft"),
          v.literal("pending_review"),
          v.literal("active"),
          v.literal("sold"),
          v.literal("unsold"),
          v.literal("rejected")
        )
      ),
      startTime: v.optional(v.number()),
      endTime: v.optional(v.number()),
      startingPrice: v.optional(v.number()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    updated: v.array(v.id("auctions")),
    skipped: v.array(v.id("auctions")),
  }),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Not authorized");
    }

    if (args.auctionIds.length > MAX_BULK_UPDATE_SIZE) {
      throw new Error(
        `Bulk update exceeds limit of ${MAX_BULK_UPDATE_SIZE} auctions`
      );
    }

    const updated: Id<"auctions">[] = [];
    const skipped: Id<"auctions">[] = [];
    for (const id of args.auctionIds) {
      const auction = await ctx.db.get(id);
      if (auction) {
        const oldStatus = auction.status;
        const newStatus = args.updates.status;

        await ctx.db.patch(id, args.updates);
        updated.push(id);

        if (newStatus && oldStatus !== newStatus) {
          const statusToCounterKey: Record<
            string,
            "active" | "pending" | undefined
          > = {
            active: "active",
            pending_review: "pending",
          };

          const oldKey = statusToCounterKey[oldStatus];
          const newKey = statusToCounterKey[newStatus];

          if (oldKey) await updateCounter(ctx, "auctions", oldKey, -1);
          if (newKey) await updateCounter(ctx, "auctions", newKey, 1);
        }
      } else {
        skipped.push(id);
      }
    }

    await logAudit(ctx, {
      action: "BULK_UPDATE_AUCTIONS",
      targetId: args.auctionIds.join(","),
      targetType: "auction",
      targetCount: args.auctionIds.length,
      details: JSON.stringify({
        count: args.auctionIds.length,
        updates: Object.keys(args.updates),
        preview: args.auctionIds.slice(0, 3),
      }),
    });

    return { success: true, updated, skipped };
  },
});

export const getMyBids = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        ...AuctionSummaryValidator.fields,
        myHighestBid: v.number(),
        isWinning: v.boolean(),
        isWon: v.boolean(),
        bidAmount: v.number(),
        bidTimestamp: v.number(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return { page: [], isDone: true, continueCursor: "", pageStatus: null, splitCursor: null };
      const userId = authUser.userId ?? authUser._id;

      // Get bids by this user, paginated
      const bidsResult = await ctx.db
        .query("bids")
        .withIndex("by_bidder", (q) => q.eq("bidderId", userId))
        .order("desc") // Show latest bids first
        .paginate(args.paginationOpts);

      // Collect unique auction IDs from the page to avoid redundant queries
      const uniqueAuctionIds = Array.from(
        new Set(bidsResult.page.map((bid) => bid.auctionId))
      );

      // Fetch only the latest (highest) bid per auction for this user
      const bidsByAuction = new Map<string, number>();

      await Promise.all(
        uniqueAuctionIds.map(async (auctionId) => {
          const latestBid = await ctx.db
            .query("bids")
            .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
            .order("desc")
            .filter((q) => q.eq(q.field("bidderId"), userId))
            .first();

          bidsByAuction.set(auctionId, latestBid?.amount || 0);
        })
      );

      const page = await Promise.all(
        bidsResult.page.map(async (bid) => {
          const auction = await ctx.db.get(bid.auctionId);
          if (!auction) return null;

          const summary = await toAuctionSummary(ctx, auction);
          const myHighestBid = bidsByAuction.get(auction._id) || 0;

          return {
            ...summary,
            myHighestBid,
            isWinning:
              auction.status === "active" &&
              myHighestBid === auction.currentPrice,
            isWon: auction.status === "sold" && auction.winnerId === userId,
            bidAmount: bid.amount,
            bidTimestamp: bid.timestamp,
          };
        })
      );

      return {
        ...bidsResult,
        page: page.filter((a): a is NonNullable<typeof a> => a !== null),
      };
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("getMyBids failure:", err);
      }
      return { page: [], isDone: true, continueCursor: "", pageStatus: null, splitCursor: null };
    }
  },
});

export const getMyListings = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(AuctionSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return { page: [], isDone: true, continueCursor: "", pageStatus: null, splitCursor: null };
      const userId = authUser.userId ?? authUser._id;

      const listingsResult = await ctx.db
        .query("auctions")
        .withIndex("by_seller", (q) => q.eq("sellerId", userId))
        .paginate(args.paginationOpts);

      const page = await Promise.all(
        listingsResult.page.map(async (auction) => await toAuctionSummary(ctx, auction))
      );

      return {
        ...listingsResult,
        page,
      };
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("getMyListings failure:", err);
      }
      return { page: [], isDone: true, continueCursor: "", pageStatus: null, splitCursor: null };
    }
  },
});