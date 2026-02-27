// app/convex/ai/executor.ts

import { ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { FunctionReference } from "convex/server";
import type {
  SearchAuctionsInput,
  GetAuctionDetailsInput,
  GetUserBidsInput,
  GetWatchlistInput,
  DraftBidInput,
} from "./tools";

// Import types for casting to bypass deep type instantiation
import type { AuctionSummary, AuctionDetail } from "../auctions/helpers";

/**
 * Manually defined function references to bypass deep type instantiation in the 'api' object.
 * This satisfies Convex's requirement to call functions via reference rather than direct object.
 */
const getActiveAuctionsRef = makeFunctionReference(
  "auctions/queries:getActiveAuctions"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as unknown as FunctionReference<"query", "public", any, AuctionSummary[]>;

const getAuctionByIdRef = makeFunctionReference(
  "auctions/queries:getAuctionById"
) as unknown as FunctionReference<
  "query",
  "public",
  { auctionId: Id<"auctions"> },
  AuctionDetail | null
>;

const getMyBidsRef = makeFunctionReference(
  "auctions/queries:getMyBids"
) as unknown as FunctionReference<
  "query",
  "public",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  { page: AuctionSummary[]; isDone: boolean; continueCursor: string }
>;

const getWatchedAuctionsRef = makeFunctionReference(
  "watchlist:getWatchedAuctions"
) as unknown as FunctionReference<
  "query",
  "public",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  { page: AuctionSummary[]; isDone: boolean; continueCursor: string }
>;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<{ auctions: any[]; total: number }> => {
      console.log(`[AI Tool: searchAuctions] Input: ${JSON.stringify(input)}`);
      try {
        const auctions = await ctx.runQuery(getActiveAuctionsRef, {
          search: input.search,
          make: input.make,
          minYear: input.minYear,
          maxYear: input.maxYear,
          minPrice: input.minPrice,
          maxPrice: input.maxPrice,
          maxHours: input.maxHours,
          statusFilter: "active",
        });

        const limit = input.limit ?? 5;
        const limitedAuctions = auctions.slice(0, limit);

        // Minimize data passed back to model
        const simplifiedAuctions = limitedAuctions.map((a) => ({
          id: a._id,
          title: a.title,
          make: a.make,
          model: a.model,
          year: a.year,
          currentPrice: a.currentPrice,
          hours: a.operatingHours,
          location: a.location,
          status: a.status,
        }));

        console.log(
          `[AI Tool: searchAuctions] Success. Found ${auctions.length} auctions. Returning ${simplifiedAuctions.length}.`
        );

        return sanitizeToolResult({
          auctions: simplifiedAuctions,
          total: auctions.length,
        });
      } catch (error) {
        console.error(`[AI Tool: searchAuctions] Error:`, error);
        if (error instanceof ConvexError) {
          throw error;
        }
        throw new ConvexError(
          `Failed to search auctions: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },

    /**
     * Get detailed information about a specific auction.
     */
    getAuctionDetails: async (
      input: GetAuctionDetailsInput
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> => {
      console.log(
        `[AI Tool: getAuctionDetails] Input: ${JSON.stringify(input)}`
      );
      try {
        if (!input.auctionId || typeof input.auctionId !== "string") {
          throw new ConvexError(
            "Invalid auction ID provided. Please provide a valid auction ID."
          );
        }

        const details = await ctx.runQuery(getAuctionByIdRef, {
          auctionId: input.auctionId as Id<"auctions">,
        });

        if (!details) {
          console.warn(
            `[AI Tool: getAuctionDetails] Auction ${input.auctionId} not found.`
          );
          throw new ConvexError(
            `Auction with ID '${input.auctionId}' was not found. The auction may have ended or been removed.`
          );
        }

        // Minimize data passed back to model
        const simplifiedDetails = {
          id: details._id,
          title: details.title,
          description: details.description,
          make: details.make,
          model: details.model,
          year: details.year,
          currentPrice: details.currentPrice,
          minIncrement: details.minIncrement,
          hours: details.operatingHours,
          location: details.location,
          status: details.status,
          endTime: details.endTime,
        };

        console.log(
          `[AI Tool: getAuctionDetails] Success. Title: "${details.title}"`
        );

        return sanitizeToolResult(simplifiedDetails);
      } catch (error) {
        console.error(`[AI Tool: getAuctionDetails] Error:`, error);
        if (error instanceof ConvexError) {
          throw error;
        }
        throw new ConvexError(
          `Failed to retrieve auction details: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },

    /**
     * Retrieve the current user's active bids.
     */
    getUserBids: async (
      input: GetUserBidsInput
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<{ bids: any[]; count: number }> => {
      console.log(`[AI Tool: getUserBids] Input: ${JSON.stringify(input)}`);
      try {
        const limit = input.limit ?? 5;
        const result = await ctx.runQuery(getMyBidsRef, {
          paginationOpts: { numItems: limit, cursor: null },
        });

        // Minimize data passed back to model
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const simplifiedBids = result.page.map((b: any) => ({
          id: b._id,
          title: b.title,
          currentPrice: b.currentPrice,
          myHighestBid: b.myHighestBid,
          status: b.status,
        }));

        console.log(
          `[AI Tool: getUserBids] Success. Found ${result.page.length} bids.`
        );

        return sanitizeToolResult({
          bids: simplifiedBids,
          count: simplifiedBids.length,
        });
      } catch (error) {
        console.error(`[AI Tool: getUserBids] Error:`, error);
        throw error;
      }
    },

    /**
     * Get the user's watchlist.
     */
    getWatchlist: async (
      input: GetWatchlistInput
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<{ auctions: any[]; count: number }> => {
      console.log(`[AI Tool: getWatchlist] Input: ${JSON.stringify(input)}`);
      try {
        const limit = input.limit ?? 5;
        const result = await ctx.runQuery(getWatchedAuctionsRef, {
          paginationOpts: { numItems: limit, cursor: null },
        });

        // Minimize data passed back to model
        const simplifiedAuctions = result.page.map((a) => ({
          id: a._id,
          title: a.title,
          make: a.make,
          model: a.model,
          currentPrice: a.currentPrice,
          status: a.status,
        }));

        console.log(
          `[AI Tool: getWatchlist] Success. Found ${result.page.length} items.`
        );

        return sanitizeToolResult({
          auctions: simplifiedAuctions,
          count: simplifiedAuctions.length,
        });
      } catch (error) {
        console.error(`[AI Tool: getWatchlist] Error:`, error);
        throw error;
      }
    },

    /**
     * Draft a bid for user review.
     */
    draftBid: async (input: DraftBidInput) => {
      console.log(`[AI Tool: draftBid] Input: ${JSON.stringify(input)}`);
      const auctionId = input.auctionId as Id<"auctions">;

      // Always validate auction state and minimum bid requirements
      const auction = await ctx.runQuery(getAuctionByIdRef, {
        auctionId,
      });

      if (!auction) {
        console.warn(
          `[AI Tool: draftBid] Auction ${input.auctionId} not found.`
        );
        throw new ConvexError("Auction not found");
      }

      if (auction.status !== "active") {
        console.warn(
          `[AI Tool: draftBid] Auction ${auction.title} is ${auction.status}, not active.`
        );
        throw new ConvexError("Auction is not active");
      }

      const minRequired = auction.currentPrice + (auction.minIncrement || 0);
      if (input.amount < minRequired) {
        console.warn(
          `[AI Tool: draftBid] Bid £${input.amount} below minimum £${minRequired}`
        );
        throw new ConvexError(
          `Bid must be at least £${minRequired}. Current price is £${auction.currentPrice}.`
        );
      }

      console.log(
        `[AI Tool: draftBid] Success. Prepared bid of £${input.amount} for "${auction.title}"`
      );

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
