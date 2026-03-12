// app/convex/watchlist.ts
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { PaginationOptions } from "convex/server";

import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { AuctionSummaryValidator, toAuctionSummary } from "./auctions";
import { requireAuth, resolveUserId, getAuthUser } from "./lib/auth";
import type { Id, Doc } from "./_generated/dataModel";

/**
 * Handler for toggling an auction in the user's watchlist.
 * @param ctx
 * @param args
 * @param args.auctionId
 * @returns Promise<boolean>
 */
export const toggleWatchlistHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  const authUser = await requireAuth(ctx);
  const userId = resolveUserId(authUser);
  if (!userId) throw new Error("Unable to determine user ID");

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
};

/**
 * Toggle an auction in the user's watchlist.
 */
export const toggleWatchlist = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.boolean(),
  handler: toggleWatchlistHandler,
});

/**
 * Handler for checking if an auction is watched.
 * @param ctx
 * @param args
 * @param args.auctionId
 * @returns Promise<boolean>
 */
export const isWatchedHandler = async (
  ctx: QueryCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return false;
    const userId = resolveUserId(authUser);
    if (!userId) return false;

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
};

/**
 * Check if a specific auction is in the current user's watchlist.
 */
export const isWatched = query({
  args: { auctionId: v.id("auctions") },
  returns: v.boolean(),
  handler: isWatchedHandler,
});

/**
 * Handler for getting watched auctions.
 * @param ctx
 * @param args
 * @param args.paginationOpts
 * @returns Promise<PaginatedAuctions>
 */
export const getWatchedAuctionsHandler = async (
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions }
) => {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser)
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        pageStatus: null,
        splitCursor: null,
      };
    const userId = resolveUserId(authUser);
    if (!userId)
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        pageStatus: null,
        splitCursor: null,
      };

    const watchlist = await ctx.db
      .query("watchlist")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      watchlist.page.map(async (item: Doc<"watchlist">) => {
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
};

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
  handler: getWatchedAuctionsHandler,
});

/**
 * Handler for getting watched auction IDs.
 * @param ctx
 * @returns Promise<Id<"auctions">[]>
 */
export const getWatchedAuctionIdsHandler = async (ctx: QueryCtx) => {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return [];
    const userId = resolveUserId(authUser);
    if (!userId) return [];

    const results: Id<"auctions">[] = [];
    let cursor: string | null = null;
    let isDone = false;
    let pageCount = 0;
    const MAX_PAGES = 10;

    while (!isDone && pageCount < MAX_PAGES) {
      const page = await ctx.db
        .query("watchlist")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .paginate({ numItems: 100, cursor });

      results.push(
        ...page.page.map((item: Doc<"watchlist">) => item.auctionId)
      );
      cursor = page.continueCursor;
      isDone = page.isDone;
      pageCount++;
    }

    if (!isDone) {
      console.warn(`getWatchedAuctionIds truncated after ${MAX_PAGES} pages`);
    }

    return results;
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
      console.error("getWatchedAuctionIds failure:", err);
    }
    return [];
  }
};

/**
 * Batch-fetch the set of all watched auction IDs for the current user.
 */
export const getWatchedAuctionIds = query({
  args: {},
  returns: v.array(v.id("auctions")),
  handler: getWatchedAuctionIdsHandler,
});
