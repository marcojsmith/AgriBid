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
import { LotSummaryValidator, toLotSummary } from "./auctions";
import { requireAuth, resolveUserId, getAuthUser } from "./lib/auth";
import type { Id, Doc } from "./_generated/dataModel";

/**
 * Handler for toggling a lot in the user's watchlist.
 * @param ctx - Convex mutation context
 * @param args - Handler arguments
 * @param args.lotId - ID of the lot to toggle
 * @returns Promise<boolean>
 */
export const toggleWatchlistHandler = async (
  ctx: MutationCtx,
  args: { lotId: Id<"lots"> }
) => {
  const authUser = await requireAuth(ctx);
  const userId = resolveUserId(authUser);
  if (!userId) throw new Error("Unable to determine user ID");

  const existing = await ctx.db
    .query("watchlist")
    .withIndex("by_user_lot", (q) =>
      q.eq("userId", userId).eq("lotId", args.lotId)
    )
    .first();

  if (existing) {
    await ctx.db.delete("watchlist", existing._id);
    return false; // Not watched anymore
  } else {
    await ctx.db.insert("watchlist", {
      userId,
      lotId: args.lotId,
    });
    return true; // Now watched
  }
};

/**
 * Toggle a lot in the user's watchlist.
 */
export const toggleWatchlist = mutation({
  args: { lotId: v.id("lots") },
  returns: v.boolean(),
  handler: toggleWatchlistHandler,
});

/**
 * Handler for checking if a lot is watched.
 * @param ctx - Convex query context
 * @param args - Handler arguments
 * @param args.lotId - ID of the lot to check
 * @returns Promise<boolean>
 */
export const isWatchedHandler = async (
  ctx: QueryCtx,
  args: { lotId: Id<"lots"> }
) => {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return false;
    const userId = resolveUserId(authUser);
    if (!userId) return false;

    const existing = await ctx.db
      .query("watchlist")
      .withIndex("by_user_lot", (q) =>
        q.eq("userId", userId).eq("lotId", args.lotId)
      )
      .first();

    return !!existing;
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
      console.error(`isWatched failure for lot ${args.lotId}:`, err);
    }
    return false;
  }
};

/**
 * Check if a specific lot is in the current user's watchlist.
 */
export const isWatched = query({
  args: { lotId: v.id("lots") },
  returns: v.boolean(),
  handler: isWatchedHandler,
});

/**
 * Handler for getting watched lots.
 * @param ctx - Convex query context
 * @param args - Handler arguments
 * @param args.paginationOpts - Convex pagination options
 * @returns Promise<PaginatedLots>
 */
export const getWatchedLotsHandler = async (
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
        const lot = await ctx.db.get("lots", item.lotId);
        if (!lot) return null;
        return await toLotSummary(ctx, lot);
      })
    );

    return {
      ...watchlist,
      page: page.filter((a): a is NonNullable<typeof a> => a !== null),
    };
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
      console.error("getWatchedLots failure:", err);
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
 * Retrieve all lots in the current user's watchlist.
 */
export const getWatchedLots = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(LotSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: getWatchedLotsHandler,
});

/**
 * Handler for getting watched lot IDs.
 * @param ctx - Convex query context
 * @returns Promise<Id<"lots">[]>
 */
export const getWatchedLotIdsHandler = async (ctx: QueryCtx) => {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return [];
    const userId = resolveUserId(authUser);
    if (!userId) return [];

    const results: Id<"lots">[] = [];
    let cursor: string | null = null;
    let isDone = false;
    let pageCount = 0;
    const MAX_PAGES = 10;

    while (!isDone && pageCount < MAX_PAGES) {
      const page = await ctx.db
        .query("watchlist")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .paginate({ numItems: 100, cursor });

      results.push(...page.page.map((item: Doc<"watchlist">) => item.lotId));
      cursor = page.continueCursor;
      isDone = page.isDone;
      pageCount++;
    }

    if (!isDone) {
      console.warn(
        `getWatchedLotIds truncated after ${String(MAX_PAGES)} pages`
      );
    }

    return results;
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
      console.error("getWatchedLotIds failure:", err);
    }
    return [];
  }
};

/**
 * Batch-fetch the set of all watched lot IDs for the current user.
 */
export const getWatchedLotIds = query({
  args: {},
  returns: v.array(v.id("lots")),
  handler: getWatchedLotIdsHandler,
});
