// app/convex/watchlist.ts
import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { AuctionSummaryValidator, toAuctionSummary } from "./auctions";
import { authComponent } from "./auth";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "./_generated/dataModel";

/**
 * Toggle an auction in the user's watchlist.
 * If already watched, remove it. If not, add it.
 *
 * @param auctionId - The ID of the auction to toggle
 * @returns boolean - true if now watched, false if removed
 */
export const toggleWatchlist = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) throw new ConvexError("Not authenticated");
    const userId = authUser.userId ?? authUser._id;

    const existing = await ctx.db
      .query("watchlist")
      .withIndex("by_user_auction", (q) =>
        q.eq("userId", userId).eq("auctionId", args.auctionId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return false; // Not watched anymore
    } else {
      await ctx.db.insert("watchlist", {
        userId,
        auctionId: args.auctionId,
      });
      return true; // Now watched
    }
  },
});

/**
 * Check if a specific auction is in the current user's watchlist.
 */
export const isWatched = query({
  args: { auctionId: v.id("auctions") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return false;
      const userId = authUser.userId ?? authUser._id;

      const existing = await ctx.db
        .query("watchlist")
        .withIndex("by_user_auction", (q) =>
          q.eq("userId", userId).eq("auctionId", args.auctionId)
        )
        .first();

      return !!existing;
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error(`isWatched failure for auction ${args.auctionId}:`, err);
      }
      return false;
    }
  },
});

/**
 * Retrieve all auctions in the current user's watchlist.
 */
export const getWatchedAuctions = query({
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

      const watchlist = await ctx.db
        .query("watchlist")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .paginate(args.paginationOpts);

      const page = await Promise.all(
        watchlist.page.map(async (item) => {
          const auction = await ctx.db.get(item.auctionId);
          if (!auction) return null;
          return await toAuctionSummary(ctx, auction);
        })
      );

      return {
        ...watchlist,
        page: page.filter((a): a is NonNullable<typeof a> => a !== null),
      };
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("getWatchedAuctions failure:", err);
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
 * Batch-fetch the set of all watched auction IDs for the current user.
 * Optimized for efficiently determining which auctions in a list are watched
 * without making per-auction queries.
 *
 * @returns An array of auction IDs that the user has watched
 */
export const getWatchedAuctionIds = query({
  args: {},
  returns: v.array(v.id("auctions")),
  handler: async (ctx) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return [];
      const userId = authUser.userId ?? authUser._id;

      const results: Id<"auctions">[] = [];
      let cursor: string | null = null;
      let isDone = false;

      while (!isDone) {
        const page = await ctx.db
          .query("watchlist")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .paginate({ numItems: 100, cursor });

        results.push(...page.page.map((item) => item.auctionId));
        cursor = page.continueCursor;
        isDone = page.isDone;
      }

      return results;
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("getWatchedAuctionIds failure:", err);
      }
      return [];
    }
  },
});
