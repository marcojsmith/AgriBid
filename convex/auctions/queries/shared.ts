import { paginationOptsValidator, type PaginationOptions } from "convex/server";

import { query } from "../../_generated/server";
import type { QueryCtx } from "../../_generated/server";
import { getAuthUser, resolveUserId } from "../../lib/auth";
import type { Doc, Id } from "../../_generated/dataModel";
import { LotSummaryValidator } from "../helpers";

export { paginationOptsValidator, type PaginationOptions };
export { query };
export type { QueryCtx };
export { LotSummaryValidator };

/**
 * Bid statistics for a single auction.
 * All timestamps are in milliseconds since epoch.
 * Amounts are in dollars (major units).
 */
export interface AuctionBidStats {
  /** Timestamp of the most recent bid in milliseconds */
  lastBidTimestamp: number;
  /** Highest bid amount in dollars */
  highestBid: number;
  /** Total number of bids on this auction */
  bidCount: number;
}

/**
 * Aggregated bid statistics across all auctions for a user.
 * Amounts are in dollars (major units).
 */
export interface GlobalUserBidStats {
  /** Number of active auctions the user is currently winning */
  totalActive: number;
  /** Number of auctions the user has won */
  winningCount: number;
  /** Number of active auctions where the user has been outbid */
  outbidCount: number;
  /** Sum of highest bids across all winning positions in dollars */
  totalExposure: number;
}

/**
 * Result of calculating user bid statistics.
 * Contains global aggregates and per-lot breakdowns.
 */
export interface CalculateUserBidStatsResult {
  /** Aggregated statistics across all lots */
  globalStats: GlobalUserBidStats;
  /** Map of lotId to bid stats for that lot */
  auctionStatsMap: Map<string, AuctionBidStats>;
  /** Map of lotId to lot document (may be null if lot deleted) */
  auctionsMap: Map<string, Doc<"lots"> | null>;
}

export const ZERO_AUCTION_STATS: GlobalUserBidStats = {
  totalActive: 0,
  winningCount: 0,
  outbidCount: 0,
  totalExposure: 0,
};

/**
 * Calculates bid statistics for a user across all their lots.
 * Returns global stats and maps of lot stats and lot documents.
 *
 * This function uses lightweight aggregations to avoid loading all bids and lots
 * when only global stats are needed. For detailed per-lot stats, it still loads
 * the necessary data but does so more efficiently.
 *
 * @param ctx - Convex Query context
 * @param userId - The user ID to calculate stats for
 * @returns User bid statistics result
 */
export async function calculateUserBidStats(
  ctx: QueryCtx,
  userId: string
): Promise<CalculateUserBidStatsResult> {
  // Use async iteration instead of .collect() to avoid loading all bids at once
  const auctionStatsMap = new Map<string, AuctionBidStats>();

  // Process bids one at a time using async iteration
  for await (const bid of ctx.db
    .query("bids")
    .withIndex("by_bidder", (q) => q.eq("bidderId", userId))
    .filter((q) => q.neq(q.field("status"), "voided"))) {
    const stats = auctionStatsMap.get(bid.lotId) ?? {
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
    auctionStatsMap.set(bid.lotId, stats);
  }

  const globalStats: GlobalUserBidStats = {
    totalActive: 0,
    winningCount: 0,
    outbidCount: 0,
    totalExposure: 0,
  };
  const auctionIds = Array.from(auctionStatsMap.keys()) as Id<"lots">[];

  // Only load lots that the user has bid on, in chunks to avoid overwhelming the database
  const CHUNK_SIZE = 100;
  const auctionEntries: {
    id: Id<"lots">;
    auction: Doc<"lots"> | null;
  }[] = [];

  for (let i = 0; i < auctionIds.length; i += CHUNK_SIZE) {
    const chunk = auctionIds.slice(i, i + CHUNK_SIZE);
    const chunkEntries = await Promise.all(
      chunk.map(async (id) => ({
        id,
        auction: await ctx.db.get("lots", id),
      }))
    );
    auctionEntries.push(...chunkEntries);
  }

  const auctionsMap = new Map<string, Doc<"lots"> | null>();

  for (const { id, auction } of auctionEntries) {
    auctionsMap.set(id, auction);
    if (!auction) continue;
    const stats = auctionStatsMap.get(id);
    if (!stats) continue;

    if (auction.status === "assigned") {
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
  }

  return { globalStats, auctionStatsMap, auctionsMap };
}

/** Lot status values surfaced by the public browse filters */
export type LotStatus = "assigned" | "sold" | "unsold";

/** Filter options for lot status queries */
export type StatusFilter = "active" | "closed" | "all";

/**
 * Converts StatusFilter to array of stored lot statuses.
 *
 * A lot is "active" when it is `assigned` to a published, in-window parent
 * auction — that window check happens at query time, so this only maps the
 * filter to the underlying stored statuses.
 *
 * @param filter - The status filter to convert
 * @returns Array of lot statuses
 */
export function statusesForFilter(filter: StatusFilter): LotStatus[] {
  if (filter === "active") return ["assigned"];
  if (filter === "closed") return ["sold", "unsold"];
  return ["assigned", "sold", "unsold"];
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
  const authUser = await getAuthUser(ctx);
  if (!authUser) return null;
  return resolveUserId(authUser);
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
