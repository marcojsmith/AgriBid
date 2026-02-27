/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// app/convex/ai/tools.ts
// TypeScript type inference issues with AI SDK - no runtime impact

import { tool } from "ai";
import { z } from "zod";

export const searchAuctionsSchema = z.object({
  search: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  minYear: z.number().optional(),
  maxYear: z.number().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  maxHours: z.number().optional(),
});

export type SearchAuctionsInput = z.infer<typeof searchAuctionsSchema>;

export const getAuctionDetailsSchema = z.object({
  auctionId: z.string(),
});

export type GetAuctionDetailsInput = z.infer<typeof getAuctionDetailsSchema>;

export const getUserBidsSchema = z.object({
  limit: z.number().optional().default(10),
});

export type GetUserBidsInput = z.infer<typeof getUserBidsSchema>;

export const getWatchlistSchema = z.object({
  limit: z.number().optional().default(10),
});

export type GetWatchlistInput = z.infer<typeof getWatchlistSchema>;

export const draftBidSchema = z.object({
  auctionId: z.string(),
  amount: z
    .number()
    .positive()
    .max(1000000, "Bid amount cannot exceed R1,000,000"),
});

export type DraftBidInput = z.infer<typeof draftBidSchema>;

export type ToolExecutor = {
  searchAuctions: (input: SearchAuctionsInput) => Promise<unknown>;
  getAuctionDetails: (input: GetAuctionDetailsInput) => Promise<unknown>;
  getUserBids: (input: GetUserBidsInput) => Promise<unknown>;
  getWatchlist: (input: GetWatchlistInput) => Promise<unknown>;
  draftBid: (input: DraftBidInput) => Promise<unknown>;
};

export function createTools(executor: ToolExecutor) {
  return {
    searchAuctions: tool({
      description: "Search for agricultural equipment auctions",
      parameters: searchAuctionsSchema,
      execute: executor.searchAuctions,
    }),
    getAuctionDetails: tool({
      description: "Get auction details by ID",
      parameters: getAuctionDetailsSchema,
      execute: executor.getAuctionDetails,
    }),
    getUserBids: tool({
      description: "Get user's current bids",
      parameters: getUserBidsSchema,
      execute: executor.getUserBids,
    }),
    getWatchlist: tool({
      description: "Get user's watchlist",
      parameters: getWatchlistSchema,
      execute: executor.getWatchlist,
    }),
    draftBid: tool({
      description:
        "Draft a bid on an auction for the user to review and confirm",
      parameters: draftBidSchema,
      execute: executor.draftBid,
    }),
  };
}
