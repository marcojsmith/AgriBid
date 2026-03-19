import { paginationOptsValidator, type PaginationOptions } from "convex/server";

import { query } from "../../_generated/server";
import type { QueryCtx } from "../../_generated/server";
import { authComponent } from "../../auth";
import { resolveUserId } from "../../lib/auth";
import type { Doc, Id } from "../../_generated/dataModel";
import { AuctionSummaryValidator } from "../helpers";

export { paginationOptsValidator, type PaginationOptions };
export { query };
export type { QueryCtx };
export { AuctionSummaryValidator };

export interface AuctionBidStats {
  lastBidTimestamp: number;
  highestBid: number;
  bidCount: number;
}

export interface GlobalUserBidStats {
  totalActive: number;
  winningCount: number;
  outbidCount: number;
  totalExposure: number;
}

export interface CalculateUserBidStatsResult {
  globalStats: GlobalUserBidStats;
  auctionStatsMap: Map<string, AuctionBidStats>;
  auctionsMap: Map<string, Doc<"auctions"> | null>;
}

export const ZERO_AUCTION_STATS: GlobalUserBidStats = {
  totalActive: 0,
  winningCount: 0,
  outbidCount: 0,
  totalExposure: 0,
};

/**
 * Calculates bid statistics for a user across all their auctions.
 * Returns global stats and maps of auction stats and auction documents.
 *
 * @param ctx - Convex Query context
 * @param userId - The user ID to calculate stats for
 * @returns User bid statistics result
 */
export async function calculateUserBidStats(
  ctx: QueryCtx,
  userId: string
): Promise<CalculateUserBidStatsResult> {
  const allUserBids = await ctx.db
    .query("bids")
    .withIndex("by_bidder", (q) => q.eq("bidderId", userId))
    .filter((q) => q.neq(q.field("status"), "voided"))
    .collect();

  const auctionStatsMap = new Map<string, AuctionBidStats>();

  for (const bid of allUserBids) {
    const stats = auctionStatsMap.get(bid.auctionId) ?? {
      lastBidTimestamp: 0,
      highestBid: 0,
      bidCount: 0,
    };
    stats.bidCount++;
    if (bid.amount > stats.highestBid) {
      stats.highestBid = bid.amount;
    }
    if (bid.timestamp > stats.lastBidTimestamp) {
      stats.lastBidTimestamp = bid.timestamp;
    }
    auctionStatsMap.set(bid.auctionId, stats);
  }

  const globalStats: GlobalUserBidStats = {
    totalActive: 0,
    winningCount: 0,
    outbidCount: 0,
    totalExposure: 0,
  };
  const auctionIds = Array.from(auctionStatsMap.keys()) as Id<"auctions">[];

  const CHUNK_SIZE = 100;
  const fullAuctions: (Doc<"auctions"> | null)[] = [];

  for (let i = 0; i < auctionIds.length; i += CHUNK_SIZE) {
    const chunk = auctionIds.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(chunk.map((id) => ctx.db.get(id)));
    fullAuctions.push(...chunkResults);
  }

  const auctionsMap = new Map<string, Doc<"auctions"> | null>();

  fullAuctions.forEach((auction: Doc<"auctions"> | null, index: number) => {
    auctionsMap.set(auctionIds[index], auction);
    if (!auction) return;
    const stats = auctionStatsMap.get(auctionIds[index]);
    if (!stats) return;

    if (auction.status === "active") {
      globalStats.totalActive++;
      const isWinning =
        stats.highestBid === auction.currentPrice &&
        auction.winnerId === userId;
      if (isWinning) {
        globalStats.winningCount++;
        globalStats.totalExposure += stats.highestBid;
      } else {
        globalStats.outbidCount++;
      }
    }
  });

  return { globalStats, auctionStatsMap, auctionsMap };
}

export type AuctionStatus = "active" | "sold" | "unsold";

export type StatusFilter = "active" | "closed" | "all";

/**
 * Converts StatusFilter to array of AuctionStatus values.
 *
 * @param filter - The status filter to convert
 * @returns Array of auction statuses
 */
export function statusesForFilter(filter: StatusFilter): AuctionStatus[] {
  if (filter === "active") return ["active"];
  if (filter === "closed") return ["sold", "unsold"];
  return ["active", "sold", "unsold"];
}

/**
 * Gets the authenticated user ID from the query context, or null if not authenticated.
 *
 * @param ctx - Convex Query context
 * @returns The user ID or null
 */
export async function getAuthenticatedUserId(
  ctx: QueryCtx
): Promise<string | null> {
  try {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) return null;
    return resolveUserId(authUser);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unauthenticated")) {
      return null;
    }
    throw err;
  }
}

/**
 * Returns an empty paginated result structure for unauthenticated users.
 *
 * @param totalCount - Optional total count (default 0)
 * @returns Empty paginated result
 */
export function unauthenticatedPaginatedResult(totalCount = 0) {
  return {
    page: [],
    isDone: true,
    continueCursor: "",
    totalCount,
    pageStatus: null,
    splitCursor: null,
  };
}
