import { v } from "convex/values";
import { query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCallerRole, findUserById } from "../users";
import { authComponent } from "../auth";
import { getSetting } from "../admin/settings";
import * as constants from "../constants";
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
    paginationOpts: paginationOptsValidator,
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
    const statuses = statusesForFilter(statusFilter);
    const auctionsQuery = ctx.db.query("auctions");
    let results;

    if (args.search) {
      // Search index queries return a Query object which supports .paginate()
      // However, we can only paginate on a single search index call.
      // For now, we search on the first status in the filter.
      // Future improvement: use a single search index that doesn't filter by status, then filter in query.
      results = await auctionsQuery
        .withSearchIndex("search_title", (q) =>
          q.search("title", args.search!).eq("status", statuses[0])
        )
        .paginate(args.paginationOpts);
    } else if (args.make) {
      results = await auctionsQuery
        .withIndex("by_status_make", (q) =>
          q.eq("status", statuses[0]).eq("make", args.make!)
        )
        .paginate(args.paginationOpts);
    } else if (args.minYear !== undefined || args.maxYear !== undefined) {
      results = await auctionsQuery
        .withIndex("by_status_year", (q) => {
          const statusQuery = q.eq("status", statuses[0]);
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
        .paginate(args.paginationOpts);
    } else {
      results = await auctionsQuery
        .withIndex("by_status", (q) => q.eq("status", statuses[0]))
        .order("desc")
        .paginate(args.paginationOpts);
    }

    const page = await Promise.all(
      results.page.map((auction) => toAuctionSummary(ctx, auction))
    );

    return {
      ...results,
      page,
    };
  },
});

export const getActiveMakes = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const limit = await getSetting(
      ctx,
      "max_results_cap",
      constants.MAX_RESULTS_CAP
    );
    const metadata = await ctx.db.query("equipmentMetadata").take(limit);
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
  args: {
    auctionId: v.id("auctions"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
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
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const bidsResult = await ctx.db
      .query("bids")
      .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
      .order("desc")
      .paginate(args.paginationOpts);

    const bids = bidsResult.page;

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

    const page = bids.map((bid) => ({
      ...bid,
      bidderName: bidderNames.get(bid.bidderId || ANONYMOUS_KEY) || "Anonymous",
    }));

    return {
      ...bidsResult,
      page,
    };
  },
});

export const getEquipmentMetadata = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("equipmentMetadata"),
        _creationTime: v.number(),
        make: v.string(),
        models: v.array(v.string()),
        category: v.string(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("equipmentMetadata")
      .paginate(args.paginationOpts);
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
        // exclude voided bids from results
        .filter((q) => q.neq(q.field("status"), "voided"))
        .order("desc")
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
            // only consider non-voided bids
            .filter((q) => q.neq(q.field("status"), "voided"))
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
