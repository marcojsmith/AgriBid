/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// app/convex/ai/executor.ts
// TypeScript type inference issues - no runtime impact

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

const auctionsApi: any = (api as any).auctions.queries;
const watchlistApi: any = (api as any).watchlist;

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

      return {
        auctions,
        total: auctions.length,
      };
    },

    /**
     * Get detailed information about a specific auction.
     */
    getAuctionDetails: async (input: GetAuctionDetailsInput) => {
      const details = await ctx.runQuery(auctionsApi.getAuctionById, {
        auctionId: input.auctionId as Id<"auctions">,
      });

      if (!details) {
        throw new ConvexError("Auction not found");
      }

      return details;
    },

    /**
     * Retrieve the current user's active bids.
     */
    getUserBids: async (input: GetUserBidsInput) => {
      const result = await ctx.runQuery(auctionsApi.getMyBids, {
        paginationOpts: { numItems: input.limit, cursor: null },
      });

      return {
        bids: result.page,
        count: result.page.length,
      };
    },

    /**
     * Get the user's watchlist.
     */
    getWatchlist: async (input: GetWatchlistInput) => {
      const result = await ctx.runQuery(watchlistApi.getWatchedAuctions, {
        paginationOpts: { numItems: input.limit, cursor: null },
      });

      return {
        auctions: result.page,
        count: result.page.length,
      };
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

      return {
        requiresApproval: true,
        auctionId: input.auctionId,
        auctionTitle: auction.title,
        currentPrice: auction.currentPrice,
        proposedBid: input.amount,
        message: `I've drafted a bid of £${input.amount} for the "${auction.title}". Please confirm in the UI to place this bid.`,
      };
    },
  };
}
