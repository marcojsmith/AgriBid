// app/convex/watchlist.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { resolveImageUrls } from "./auctions";
import { authComponent } from "./auth";

/**
 * Toggle an auction in the user's watchlist.
 * If already watched, remove it. If not, add it.
 *
 * @param auctionId - The ID of the auction to toggle
 * @returns boolean - true if now watched, false if removed
 */
export const toggleWatchlist = mutation({
  args: { auctionId: v.id("auctions") },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");
    const userId = authUser.userId ?? authUser._id;

    const existing = await ctx.db
      .query("watchlist")
      .withIndex("by_user_auction", (q) =>
        q.eq("userId", userId).eq("auctionId", args.auctionId),
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
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) return false;
    const userId = authUser.userId ?? authUser._id;

    const existing = await ctx.db
      .query("watchlist")
      .withIndex("by_user_auction", (q) =>
        q.eq("userId", userId).eq("auctionId", args.auctionId),
      )
      .first();

    return !!existing;
  },
});

/**
 * Retrieve all auctions in the current user's watchlist.
 */
export const getWatchedAuctions = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) return [];
    const userId = authUser.userId ?? authUser._id;

    const watchlist = await ctx.db
      .query("watchlist")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const auctions = await Promise.all(
      watchlist.map(async (item) => {
        const auction = await ctx.db.get(item.auctionId);
        if (!auction) return null;
        return {
          ...auction,
          images: await resolveImageUrls(ctx.storage, auction.images),
        };
      }),
    );

    return auctions.filter((a): a is NonNullable<typeof a> => a !== null);
  },
});
