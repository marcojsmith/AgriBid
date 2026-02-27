// app/convex/ai/executor.ts

import { ConvexError } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type {
  SearchAuctionsInput,
  GetAuctionDetailsInput,
  GetUserBidsInput,
  GetWatchlistInput,
  DraftBidInput,
} from "./tools";

// @ts-expect-error - Convex API deep type instantiation issues
const auctionsApi = api.auctions.queries;
const watchlistApi = api.watchlist;

/**
 * Sanitizes tool results to normalize text and remove dangerous content.
 */
function sanitizeToolResult<T>(result: T): T {
  if (result === null || result === undefined) return result;

  if (typeof result === "string") {
    return (
      result
        .replace(/[#*`_~]/g, "") // Strip basic markdown
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Strip control characters
        .replace(/(javascript|data):/gi, "[REMOVED]:") // Block dangerous URLs
        .trim() as unknown as T
    );
  }

  if (Array.isArray(result)) {
    return result.map(sanitizeToolResult) as unknown as T;
  }

  if (typeof result === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result)) {
      sanitized[key] = sanitizeToolResult(value);
    }
    return sanitized as unknown as T;
  }

  return result;
}

/**
 * Tool executor that runs inside a Convex Action.
 * It uses ctx.runQuery and ctx.runMutation to interact with the database
 * via existing defined functions, ensuring consistency and reusability.
 */
export function createToolExecutor(ctx: ActionCtx) {
  return {
    /**
     * Search for auctions using the centralized getActiveAuctions query.
     */
    searchAuctions: async (
      input: SearchAuctionsInput
    ): Promise<{ auctions: unknown[]; total: number }> => {
      const auctions = await ctx.runQuery(auctionsApi.getActiveAuctions, {
        search: input.search,
        make: input.make,
        minYear: input.minYear,
        maxYear: input.maxYear,
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
        maxHours: input.maxHours,
        statusFilter: "active",
      });

      return sanitizeToolResult({
        auctions,
        total: auctions.length,
      });
    },

    /**
     * Get detailed information about a specific auction.
     */
    getAuctionDetails: async (
      input: GetAuctionDetailsInput
    ): Promise<unknown> => {
      const details = await ctx.runQuery(auctionsApi.getAuctionById, {
        auctionId: input.auctionId as Id<"auctions">,
      });

      if (!details) {
        throw new ConvexError("Auction not found");
      }

      return sanitizeToolResult(details);
    },

    /**
     * Retrieve the current user's active bids.
     */
    getUserBids: async (
      input: GetUserBidsInput
    ): Promise<{ bids: unknown[]; count: number }> => {
      const result = await ctx.runQuery(auctionsApi.getMyBids, {
        paginationOpts: { numItems: input.limit, cursor: null },
      });

      return sanitizeToolResult({
        bids: result.page,
        count: result.page.length,
      });
    },

    /**
     * Get the user's watchlist.
     */
    getWatchlist: async (
      input: GetWatchlistInput
    ): Promise<{ auctions: unknown[]; count: number }> => {
      const result = await ctx.runQuery(watchlistApi.getWatchedAuctions, {
        paginationOpts: { numItems: input.limit, cursor: null },
      });

      return sanitizeToolResult({
        auctions: result.page,
        count: result.page.length,
      });
    },

    /**
     * Draft a bid for user review.
     */
    draftBid: async (input: DraftBidInput) => {
      const auctionId = input.auctionId as Id<"auctions">;

      // Always validate auction state and minimum bid requirements
      const auction = await ctx.runQuery(auctionsApi.getAuctionById, {
        auctionId,
      });

      if (!auction) {
        throw new ConvexError("Auction not found");
      }

      if (auction.status !== "active") {
        throw new ConvexError("Auction is not active");
      }

      const minRequired = auction.currentPrice + (auction.minIncrement || 0);
      if (input.amount < minRequired) {
        throw new ConvexError(
          `Bid must be at least £${minRequired}. Current price is £${auction.currentPrice}.`
        );
      }

      return sanitizeToolResult({
        requiresApproval: true,
        auctionId: input.auctionId,
        auctionTitle: auction.title,
        currentPrice: auction.currentPrice,
        proposedBid: input.amount,
        message: `I've drafted a bid of £${input.amount} for the "${auction.title}". Please confirm in the UI to place this bid.`,
      });
    },
  };
}
