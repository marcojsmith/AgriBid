import { v } from "convex/values";
import { query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCallerRole, findUserById } from "../users";
import { authComponent } from "../auth";
import {
  AuctionSummaryValidator,
  toAuctionSummary,
  AuctionDetailValidator,
  toAuctionDetail,
} from "./helpers";

/**
 * Represents the possible status values for an auction.
 */
type AuctionStatus = "active" | "sold" | "unsold";

/**
 * Represents the filter options for querying auctions by status.
 * - "active": Returns only active auctions
 * - "closed": Returns only closed auctions (sold or unsold)
 * - "all": Returns all auctions
 */
type StatusFilter = "active" | "closed" | "all";

/**
 * Maps a StatusFilter to the corresponding array of AuctionStatus values.
 * @param filter - The status filter ("active", "closed", or "all")
 * @returns An array of AuctionStatus values to query
 */
const statusesForFilter = (filter: StatusFilter): AuctionStatus[] => {
  if (filter === "active") return ["active"];
  if (filter === "closed") return ["sold", "unsold"];
  return ["active", "sold", "unsold"];
};

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
    statusFilter: v.optional(
      v.union(v.literal("active"), v.literal("closed"), v.literal("all"))
    ),
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
    const statusFilter: StatusFilter = args.statusFilter ?? "active";
    let auctions;

    if (args.search) {
      const statuses = statusesForFilter(statusFilter);
      const searchTerm = args.search;

      const titlePromise = Promise.all(
        statuses.map((status) =>
          ctx.db
            .query("auctions")
            .withSearchIndex("search_title", (q) =>
              q.search("title", searchTerm).eq("status", status)
            )
            .collect()
        )
      );

      const makeModelPromise = Promise.all(
        statuses.map((status) =>
          ctx.db
            .query("auctions")
            .withSearchIndex("search_make_model", (q) =>
              q.search("make", searchTerm).eq("status", status)
            )
            .collect()
        )
      );

      const [titleResults, makeModelResults] = await Promise.all([
        titlePromise,
        makeModelPromise,
      ]);

      const seen = new Set<string>();
      auctions = [...titleResults.flat(), ...makeModelResults.flat()].filter(
        (auction) => {
          const id = auction._id.toString();
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        }
      );
    } else if (args.make) {
      const statuses = statusesForFilter(statusFilter);
      const results = await Promise.all(
        statuses.map((status) =>
          ctx.db
            .query("auctions")
            .withIndex("by_status_make", (q) =>
              q.eq("status", status).eq("make", args.make!)
            )
            .collect()
        )
      );
      auctions = results.flat();
    } else if (args.minYear !== undefined || args.maxYear !== undefined) {
      const statuses = statusesForFilter(statusFilter);
      const results = await Promise.all(
        statuses.map((status) =>
          ctx.db
            .query("auctions")
            .withIndex("by_status_year", (q) => {
              const statusQuery = q.eq("status", status);
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
            .collect()
        )
      );
      auctions = results.flat();
    } else if (
      args.minPrice !== undefined ||
      args.maxPrice !== undefined ||
      args.maxHours !== undefined
    ) {
      // If we only have filters that don't have an index, we use the status index
      const statuses = statusesForFilter(statusFilter);
      const results = await Promise.all(
        statuses.map((status) =>
          ctx.db
            .query("auctions")
            .withIndex("by_status", (q) => q.eq("status", status))
            .collect()
        )
      );
      auctions = results.flat();
    } else {
      // Default: use status index and paginate
      const statuses = statusesForFilter(statusFilter);
      // Since we can't easily paginate across multiple status buckets in one query,
      // and "active" is the most common filter, we'll optimize for that.
      // For "all" or "closed", we'll just query "active" or "sold" for now to keep it simple,
      // OR we can query all and filter.

      // Actually, Convex .paginate() only works on a single query object.
      // If statusFilter is "active", we're good.
      if (statusFilter === "active") {
        const results = await ctx.db
          .query("auctions")
          .withIndex("by_status", (q) => q.eq("status", "active"))
          .order("desc")
          .paginate(args.paginationOpts);

        return {
          ...results,
          page: await Promise.all(
            results.page.map((auction) => toAuctionSummary(ctx, auction))
          ),
        };
      }

      // For other filters, we'll collect and then manually paginate (not ideal but works for now)
      const results = await Promise.all(
        statuses.map((status) =>
          ctx.db
            .query("auctions")
            .withIndex("by_status", (q) => q.eq("status", status))
            .collect()
        )
      );
      auctions = results
        .flat()
        .sort((a, b) => b._creationTime - a._creationTime);
    }

    // Apply remaining filters
    const filteredAuctions = auctions.filter((a) => {
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

    // Manual pagination for complex queries
    const numItems = args.paginationOpts.numItems;
    const startIndex = 0; // In a real app we'd use the cursor
    const page = filteredAuctions.slice(startIndex, startIndex + numItems);

    return {
      page: await Promise.all(
        page.map((auction) => toAuctionSummary(ctx, auction))
      ),
      isDone: filteredAuctions.length <= startIndex + numItems,
      continueCursor: "", // Simplification
    };
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

    // Minimum length for a valid Convex ID is 10 characters. IDs shorter than
    // this are malformed or legacy data and should be treated as anonymous.
    const MIN_VALID_BIDDER_ID_LENGTH = 10;
    // Sentinel key for falsy bidderId values (null, empty string) to avoid
    // using them as map keys which can cause issues with retrieval.
    const ANONYMOUS_KEY = "anonymous";

    const uniqueBidderIds = Array.from(new Set(bids.map((b) => b.bidderId)));
    const bidderNames = new Map<string, string>();

    await Promise.all(
      uniqueBidderIds.map(async (bidderId) => {
        const mapKey = bidderId || ANONYMOUS_KEY;

        if (!bidderId || bidderId.length < MIN_VALID_BIDDER_ID_LENGTH) {
          bidderNames.set(mapKey, "Anonymous");
          return;
        }
        const user = await findUserById(ctx, bidderId);

        if (user) {
          bidderNames.set(mapKey, user.name ?? "Anonymous");
        } else {
          bidderNames.set(mapKey, "Anonymous");
        }
      })
    );

    const bidsWithUsers = bids.map((bid) => ({
      ...bid,
      bidderName: bidderNames.get(bid.bidderId || ANONYMOUS_KEY) || "Anonymous",
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
        auctions.page.map(
          async (auction) => await toAuctionSummary(ctx, auction)
        )
      ),
    };
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
      if (!authUser)
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          pageStatus: null,
          splitCursor: null,
        };
      const userId = authUser.userId ?? authUser._id;

      const bidsResult = await ctx.db
        .query("bids")
        .withIndex("by_bidder", (q) => q.eq("bidderId", userId))
        .order("desc")
        // exclude voided bids from results
        .filter((q) => q.neq(q.field("status"), "voided"))
        .paginate(args.paginationOpts);

      const uniqueAuctionIds = Array.from(
        new Set(bidsResult.page.map((bid) => bid.auctionId))
      );

      const bidsByAuction = new Map<string, number>();

      await Promise.all(
        uniqueAuctionIds.map(async (auctionId) => {
          const latestBid = await ctx.db
            .query("bids")
            .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
            .order("desc")
            // only consider non-voided bids
            .filter((q) => q.neq(q.field("status"), "voided"))
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
      if (err instanceof Error && err.message.includes("Unauthenticated")) {
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          pageStatus: null,
          splitCursor: null,
        };
      }
      console.error("getMyBids failure:", err);
      throw err;
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
      if (!authUser)
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          pageStatus: null,
          splitCursor: null,
        };
      const userId = authUser.userId ?? authUser._id;

      const listingsResult = await ctx.db
        .query("auctions")
        .withIndex("by_seller", (q) => q.eq("sellerId", userId))
        .paginate(args.paginationOpts);

      const page = await Promise.all(
        listingsResult.page.map(
          async (auction) => await toAuctionSummary(ctx, auction)
        )
      );

      return {
        ...listingsResult,
        page,
      };
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("getMyListings failure:", err);
      }
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        pageStatus: null,
        splitCursor: null,
      };
    }
  },
});

/**
 * Get flags for a specific auction (admin only).
 */
export const getAuctionFlags = query({
  args: { auctionId: v.id("auctions") },
  returns: v.array(
    v.object({
      _id: v.id("auctionFlags"),
      _creationTime: v.number(),
      auctionId: v.id("auctions"),
      reporterId: v.string(),
      reason: v.union(
        v.literal("misleading"),
        v.literal("inappropriate"),
        v.literal("suspicious"),
        v.literal("other")
      ),
      details: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("reviewed"),
        v.literal("dismissed")
      ),
      createdAt: v.number(),
      reporterName: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Not authorized: Admin privileges required");
    }

    const flags = await ctx.db
      .query("auctionFlags")
      .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
      .order("desc")
      .collect();

    const uniqueReporterIds = Array.from(
      new Set(flags.map((f) => f.reporterId))
    );
    const reporterNames = new Map<string, string>();

    await Promise.all(
      uniqueReporterIds.map(async (reporterId) => {
        const user = await findUserById(ctx, reporterId);
        reporterNames.set(reporterId, user?.name ?? "Unknown User");
      })
    );

    return flags.map((flag) => ({
      ...flag,
      reporterName: reporterNames.get(flag.reporterId) ?? "Unknown User",
    }));
  },
});

/**
 * Get all pending flags across all auctions (admin only).
 */
export const getAllPendingFlags = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("auctionFlags"),
      _creationTime: v.number(),
      auctionId: v.id("auctions"),
      reporterId: v.string(),
      reason: v.union(
        v.literal("misleading"),
        v.literal("inappropriate"),
        v.literal("suspicious"),
        v.literal("other")
      ),
      details: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("reviewed"),
        v.literal("dismissed")
      ),
      createdAt: v.number(),
      auctionTitle: v.string(),
      reporterName: v.string(),
    })
  ),
  handler: async (ctx) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Not authorized: Admin privileges required");
    }

    const flags = await ctx.db
      .query("auctionFlags")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    const uniqueAuctionIds = Array.from(new Set(flags.map((f) => f.auctionId)));
    const auctionTitles = new Map<string, string>();
    const uniqueReporterIds = Array.from(
      new Set(flags.map((f) => f.reporterId))
    );
    const reporterNames = new Map<string, string>();

    await Promise.all([
      ...uniqueAuctionIds.map(async (auctionId) => {
        const auction = await ctx.db.get(auctionId);
        auctionTitles.set(auctionId, auction?.title ?? "Unknown Auction");
      }),
      ...uniqueReporterIds.map(async (reporterId) => {
        const user = await findUserById(ctx, reporterId);
        reporterNames.set(reporterId, user?.name ?? "Unknown User");
      }),
    ]);

    return flags.map((flag) => ({
      ...flag,
      auctionTitle: auctionTitles.get(flag.auctionId) ?? "Unknown Auction",
      reporterName: reporterNames.get(flag.reporterId) ?? "Unknown User",
    }));
  },
});
