import { v } from "convex/values";

import {
  paginationOptsValidator,
  query,
  type QueryCtx,
  LotSummaryValidator,
  getAuthenticatedUserId,
  unauthenticatedPaginatedResult,
  type PaginationOptions,
  type AuctionBidStats,
  calculateUserBidStats,
} from "./shared";
import type { Doc, Id } from "../../_generated/dataModel";
import { BidValidator, toLotSummaries } from "../helpers";
import { countQuery } from "../../admin_utils";
import { getAuthenticatedProfile } from "../../lib/auth";
import { parseOffsetCursor } from "../../lib/pagination";
import { resolveDisplayNames } from "../../lib/userNames";

/** Maximum bids to read when determining distinct lots for a page */
const MAX_BIDS_PER_PAGE = 100;

/**
 * Upper bound on the bids a single "recent" page may read while hunting for
 * `numItems` lots it has not returned yet. Reached only by accounts that have
 * bid on the same lots many times over; such pages may come back short rather
 * than reading a user's whole bid history.
 */
const MAX_BIDS_PER_WINDOW = 1000;

/** Maximum distinct lots to consider for "ending" sort (bounded fallback) */
const MAX_LOTS_FOR_ENDING_SORT = 200;

/**
 * Resolves the page size to honour from `paginationOpts`.
 *
 * Clamped to at least one item: a zero or negative `numItems` would produce a
 * page that can never satisfy the page size, so both sorts would hand back an
 * empty page with `isDone: false` and a cursor that never advances, and the
 * client's "load more" loop would spin forever.
 *
 * @param paginationOpts - Pagination options from the caller
 * @returns A positive integer page size
 */
function resolvePageSize(paginationOpts: PaginationOptions): number {
  return Math.max(1, Math.floor(paginationOpts.numItems));
}

/**
 * Computes per-lot bid statistics for a specific user and set of lots.
 * Uses the by_bidder_lot index to efficiently fetch only relevant bids.
 *
 * @param ctx - Convex Query context
 * @param userId - The user ID
 * @param lotIds - Set of lot IDs to compute stats for
 * @returns Map of lotId to bid stats
 */
export async function computeLotStatsForUser(
  ctx: QueryCtx,
  userId: string,
  lotIds: Set<Id<"lots">>
): Promise<Map<Id<"lots">, AuctionBidStats>> {
  const statsMap = new Map<Id<"lots">, AuctionBidStats>();

  await Promise.all(
    Array.from(lotIds).map(async (lotId) => {
      const bids = await ctx.db
        .query("bids")
        .withIndex("by_bidder_lot", (q) =>
          q.eq("bidderId", userId).eq("lotId", lotId)
        )
        .filter((q) => q.neq(q.field("status"), "voided"))
        .collect();

      if (bids.length === 0) return;

      let highestBid = 0;
      let lastBidTimestamp = 0;

      for (const bid of bids) {
        if (bid.amount > highestBid) {
          highestBid = bid.amount;
        }
        if (bid.timestamp > lastBidTimestamp) {
          lastBidTimestamp = bid.timestamp;
        }
      }

      statsMap.set(lotId, {
        highestBid,
        lastBidTimestamp,
        bidCount: bids.length,
      });
    })
  );

  return statsMap;
}

/**
 * Parses a cursor string into timestamp and optional _id components.
 * Cursor format: "{timestamp}:{_id}" or just "{timestamp}"
 *
 * @param cursor - The cursor string to parse
 * @returns Parsed cursor object or null if invalid
 */
export function parseCursor(
  cursor: string
): { timestamp: number; id?: string } | null {
  if (!cursor) return null;

  const parts = cursor.split(":");
  if (parts.length === 1) {
    const timestamp = parseInt(parts[0], 10);
    if (isNaN(timestamp)) return null;
    return { timestamp };
  }

  if (parts.length === 2) {
    const timestamp = parseInt(parts[0], 10);
    const id = parts[1];
    if (isNaN(timestamp) || !id) return null;
    return { timestamp, id };
  }

  return null;
}

/**
 * Encodes timestamp and id into a cursor string.
 *
 * @param timestamp - The timestamp
 * @param id - Optional id
 * @returns Cursor string
 */
export function encodeCursor(timestamp: number, id?: string): string {
  if (id) {
    return `${String(timestamp)}:${id}`;
  }
  return String(timestamp);
}

/**
 * Returns paginated bids for a lot with bidder names.
 * Hides real bidder names unless user is admin or seller.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.lotId - The lot ID to fetch bids for
 * @param args.paginationOpts - Pagination options
 * @returns Paginated bids with bidder names
 */
export const getLotBidsHandler = async (
  ctx: QueryCtx,
  args: {
    lotId: Id<"lots">;
    paginationOpts: PaginationOptions;
  }
) => {
  const bidsQuery = ctx.db
    .query("bids")
    .withIndex("by_lot", (q) => q.eq("lotId", args.lotId));

  const [bidsResult, totalCount] = await Promise.all([
    bidsQuery.order("desc").paginate(args.paginationOpts),
    countQuery(
      ctx.db.query("bids").withIndex("by_lot", (q) => q.eq("lotId", args.lotId))
    ),
  ]);

  const bids = bidsResult.page;

  const uniqueBidderIds = Array.from(
    new Set(bids.map((b: Doc<"bids">) => b.bidderId))
  );

  const lot = await ctx.db.get("lots", args.lotId);
  const auth = await getAuthenticatedProfile(ctx);
  const isAdmin = auth?.profile?.role === "admin";
  // Guard against undefined === undefined: a missing lot doc combined
  // with an unauthenticated caller must never mark the caller as the seller.
  const isSeller = Boolean(lot && lot.sellerId === auth?.userId);

  // Only admins and the seller may see who bid; everyone else gets a single
  // shared placeholder, so no profile is read for them at all.
  const bidderNames = new Map<string, string>();
  if (isAdmin || isSeller) {
    const resolved = await resolveDisplayNames(ctx, uniqueBidderIds, {
      fallback: "Anonymous",
    });
    for (const [bidderId, bidderName] of resolved) {
      bidderNames.set(bidderId, bidderName);
    }
  } else {
    for (const bidderId of uniqueBidderIds) {
      if (bidderId) bidderNames.set(bidderId, "Bidder");
    }
  }

  const page = bids.map((bid: Doc<"bids">) => ({
    ...bid,
    bidderName: bidderNames.get(bid.bidderId) ?? "Anonymous",
  }));

  return {
    ...bidsResult,
    page,
    totalCount,
  };
};

/**
 * Query: Get paginated lot bids with bidder names.
 * Args: lotId, paginationOpts
 *
 * @returns Paginated bids with bidder names
 */
export const getLotBids = query({
  args: {
    lotId: v.id("lots"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(BidValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRequired"),
        v.literal("SplitRecommended"),
        v.null()
      )
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: getLotBidsHandler,
});

/**
 * Returns the total bid count for a lot.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.lotId - The lot ID
 * @returns The bid count
 */
export const getLotBidCountHandler = async (
  ctx: QueryCtx,
  args: { lotId: Id<"lots"> }
) => {
  return await countQuery(
    ctx.db.query("bids").withIndex("by_lot", (q) => q.eq("lotId", args.lotId))
  );
};

/**
 * Query: Get lot bid count.
 * Args: lotId
 *
 * @returns The bid count
 */
export const getLotBidCount = query({
  args: { lotId: v.id("lots") },
  returns: v.number(),
  handler: getLotBidCountHandler,
});

/**
 * Returns paginated list of lots the current user has bid on with bid stats.
 *
 * The "recent" sort pages through the by_bidder_timestamp index with a keyset
 * cursor, one distinct lot per result. The "ending" sort uses a bounded
 * fallback that considers at most MAX_LOTS_FOR_ENDING_SORT lots sorted by end
 * time. `totalCount` is a non-voided bid count for "recent" and a lot count for
 * "ending" - see {@link getMyBidsRecent}.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.paginationOpts - Pagination options
 * @param args.sort - Sort order (recent or ending)
 * @returns Paginated user bids with lot details
 */
export const getMyBidsHandler = async (
  ctx: QueryCtx,
  args: {
    paginationOpts: PaginationOptions;
    sort?: string;
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) return { ...unauthenticatedPaginatedResult(), page: [] };

  const sortBy = args.sort ?? "recent";

  if (sortBy === "recent") {
    return await getMyBidsRecent(ctx, userId, args.paginationOpts);
  } else {
    return await getMyBidsEnding(ctx, userId, args.paginationOpts);
  }
};

/**
 * One page of the "recent" bid walk: which lots to show and where to continue.
 */
interface RecentBidPage {
  /** Lot ids for the page, in the order they were first met (newest bid first). */
  lotIds: Id<"lots">[];
  /** The lowest bid the page consumed: the next page starts just below it. */
  lastConsumedBid: {
    timestamp: number;
    bidId: Id<"bids">;
  } | null;
  /** Bid stats for every lot in the window, including the ones filtered out. */
  statsMap: Map<Id<"lots">, AuctionBidStats>;
  /** True when bids remain below the page's last consumed bid. */
  hasMore: boolean;
}

/**
 * Reads the user's bids at or below the cursor and picks out the next page of
 * lots, one distinct lot each, ordered by the newest bid.
 *
 * The first window is `Math.max(numItems * 5, MAX_BIDS_PER_PAGE)` bids. A lot the
 * user bid on repeatedly contributes bids that this page has to walk past, so a
 * window can hold plenty of bids yet too few lots that are still unlisted; such
 * a window is retried with a doubled read, up to `MAX_BIDS_PER_WINDOW`. Without
 * the retry heavily re-bid accounts would get short pages; without the cap one
 * page could end up reading the user's entire bid history.
 *
 * @param ctx - Convex Query context
 * @param userId - The authenticated user ID
 * @param parsedCursor - Cursor to resume from, or null for the first page
 * @param numItems - Page size to honour
 * @returns The lots for the page, the per-lot stats and the continuation state
 */
async function readRecentBidPage(
  ctx: QueryCtx,
  userId: string,
  parsedCursor: { timestamp: number; id?: string } | null,
  numItems: number
): Promise<RecentBidPage> {
  let windowSize = Math.max(numItems * 5, MAX_BIDS_PER_PAGE);

  for (;;) {
    const bids = await ctx.db
      .query("bids")
      .withIndex("by_bidder_timestamp", (q) =>
        parsedCursor
          ? q.eq("bidderId", userId).lte("timestamp", parsedCursor.timestamp)
          : q.eq("bidderId", userId)
      )
      .filter((q) => q.neq(q.field("status"), "voided"))
      .order("desc")
      .take(windowSize + 1);

    // One extra bid was requested, so a full window means bids remain below it.
    const windowExhausted = bids.length > windowSize;

    // Bids at the cursor's exact timestamp are ordered by document id; the ones
    // at or before the cursor bid were already consumed by the previous page.
    const cursorBidId = parsedCursor?.id;
    const windowBids =
      cursorBidId === undefined || parsedCursor === null
        ? bids
        : bids.filter(
            (bid) =>
              bid.timestamp !== parsedCursor.timestamp || bid._id > cursorBidId
          );

    const windowedLotIds = new Set<Id<"lots">>();
    for (const bid of windowBids) {
      windowedLotIds.add(bid.lotId);
    }

    // Also yields the newest bid time of every candidate lot, which is what tells
    // an unlisted lot apart from one an earlier page already returned.
    const statsMap = await computeLotStatsForUser(ctx, userId, windowedLotIds);

    const lotIds: Id<"lots">[] = [];
    const listedLotIds = new Set<Id<"lots">>();
    let lastConsumedBid: RecentBidPage["lastConsumedBid"] = null;
    let stoppedAtPageEnd = false;

    for (const bid of windowBids) {
      const stats = statsMap.get(bid.lotId);
      if (!stats) continue;

      // Every bid at or above the cursor timestamp was consumed by an earlier
      // page, so a lot whose newest bid sits there was already returned. Listing
      // it again would show the lot twice: once for its newest bid, once for an
      // older one.
      if (parsedCursor && stats.lastBidTimestamp >= parsedCursor.timestamp) {
        continue;
      }

      // Consume every bid that belongs to a lot already on this page so the
      // cursor ends up below the last lot's whole run; stop on the first bid of
      // a lot that would overflow the page (re-read by the next page).
      if (!listedLotIds.has(bid.lotId)) {
        if (lotIds.length >= numItems) {
          stoppedAtPageEnd = true;
          break;
        }
        listedLotIds.add(bid.lotId);
        lotIds.push(bid.lotId);
      }

      lastConsumedBid = { timestamp: bid.timestamp, bidId: bid._id };
    }

    const hasMore = stoppedAtPageEnd || windowExhausted;

    if (
      lotIds.length >= numItems ||
      !windowExhausted ||
      windowSize >= MAX_BIDS_PER_WINDOW
    ) {
      if (lastConsumedBid === null && windowExhausted) {
        // The window held nothing but bids of lots an earlier page returned, so
        // point the cursor at its lowest bid: the cursor still advances and
        // paging terminates instead of repeating the same page forever. A window
        // that was read past its own size cannot be empty, so this read is safe.
        const lowestBid = bids[bids.length - 1];
        lastConsumedBid = {
          timestamp: lowestBid.timestamp,
          bidId: lowestBid._id,
        };
      }

      return { lotIds, lastConsumedBid, statsMap, hasMore };
    }

    windowSize = Math.min(windowSize * 2, MAX_BIDS_PER_WINDOW);
  }
}

/**
 * Paginates lots the user has bid on, ordered by most recent bid time.
 *
 * Walks the `by_bidder_timestamp` index in descending order with a keyset
 * ("timestamp:id") cursor: every page bounds the index range by the cursor's
 * timestamp, so a page only reads the bids below the previous page instead of
 * re-reading the user's newest bids from the top of the index.
 *
 * One lot can own several of the user's bids spread across the index (the user
 * bid on it, then on another lot, then on it again), so walking below a cursor
 * inevitably runs into bids of lots an earlier page already returned.
 * {@link readRecentBidPage} drops those lots, which is what keeps a lot from
 * appearing on two pages.
 *
 * Semantics of the returned cursor:
 * - The cursor points at the lowest bid consumed by the page, which is always
 *   the last bid of the last lot on the page (the scan keeps consuming bids
 *   that belong to lots already on the page before it moves on). The next page
 *   therefore starts strictly below every bid of the lots already returned.
 * - Lots are ordered by their most recent bid, newest first, and a lot only ever
 *   appears on the page holding its newest bid. A bid placed between two page
 *   fetches is newer than the page-1 cursor, so it belongs to an already-listed
 *   lot and is filtered out: the row page 1 returned keeps the stats it had, and
 *   only a fresh first page sees the newer bid.
 * - Bids sharing the exact same `timestamp` as the cursor are ordered by
 *   document id and the ones at or before the cursor are skipped. Document ids
 *   are opaque, so the relative order of two bids placed in the same
 *   millisecond is unspecified - but a page boundary never splits them, because
 *   the scan always consumes the whole run of bids belonging to a listed lot.
 * - Every page but the last holds `numItems` lots, unless filling it would need
 *   more than `MAX_BIDS_PER_WINDOW` bids: past that cap a page may come back
 *   short rather than reading a user's whole bid history.
 * - `totalCount` is the number of the user's non-voided bids, not the number of
 *   lots: counting distinct lots would require reading every bid the user ever
 *   placed, which is exactly what pagination avoids. Clients that need a lot
 *   count should use `getMyBidsCount`.
 *
 * @param ctx - Convex Query context
 * @param userId - The authenticated user ID
 * @param paginationOpts - Pagination options
 * @returns Paginated results with a keyset cursor
 */
async function getMyBidsRecent(
  ctx: QueryCtx,
  userId: string,
  paginationOpts: PaginationOptions
) {
  const numItems = resolvePageSize(paginationOpts);
  const parsedCursor = paginationOpts.cursor
    ? parseCursor(paginationOpts.cursor)
    : null;

  const {
    lotIds: pageLotIds,
    lastConsumedBid,
    statsMap,
    hasMore,
  } = await readRecentBidPage(ctx, userId, parsedCursor, numItems);

  const lots = await Promise.all(
    pageLotIds.map((id) => ctx.db.get("lots", id))
  );

  const validLots = lots.filter((lot): lot is Doc<"lots"> => lot !== null);

  const lotSummaries = await toLotSummaries(ctx, validLots);
  const summariesByLotId = new Map(lotSummaries.map((s) => [s._id, s]));

  const page = pageLotIds
    .map((lotId) => {
      const summary = summariesByLotId.get(lotId);
      if (!summary) return null;
      const lot = lots.find((l) => l?._id === lotId);
      if (!lot) return null;
      const stats = statsMap.get(lotId);
      if (!stats) return null;

      const isWinning =
        lot.status === "assigned" &&
        stats.highestBid === lot.currentPrice &&
        lot.winnerId === userId;

      return {
        ...summary,
        myHighestBid: stats.highestBid,
        isWinning,
        isWon: lot.status === "sold" && lot.winnerId === userId,
        isOutbid: lot.status === "assigned" && !isWinning,
        isCancelled: lot.status === "rejected",
        bidAmount: stats.highestBid,
        bidTimestamp: stats.lastBidTimestamp,
        lastBidTimestamp: stats.lastBidTimestamp,
        bidCount: stats.bidCount,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const continueCursor =
    hasMore && lastConsumedBid
      ? encodeCursor(lastConsumedBid.timestamp, lastConsumedBid.bidId)
      : "";

  const totalCount = await countQuery(
    ctx.db
      .query("bids")
      .withIndex("by_bidder", (q) => q.eq("bidderId", userId))
      .filter((q) => q.neq(q.field("status"), "voided"))
  );

  return {
    page,
    isDone: !hasMore,
    continueCursor,
    totalCount,
    pageStatus: null,
    splitCursor: null,
  };
}

/**
 * Paginates lots the user has bid on, ordered by auction end time.
 * Uses a bounded approach: considers at most MAX_LOTS_FOR_ENDING_SORT
 * most recently bid-on lots, sorted by end time with offset cursor.
 *
 * Note: This bounded approach may miss lots if the user has bid on more
 * than MAX_LOTS_FOR_ENDING_SORT lots. The alternative would be a table scan
 * or maintaining a denormalized end-time index.
 *
 * @param ctx - Convex Query context
 * @param userId - The authenticated user ID
 * @param paginationOpts - Pagination options
 * @returns Paginated results with offset cursors (within bounded window)
 */
async function getMyBidsEnding(
  ctx: QueryCtx,
  userId: string,
  paginationOpts: PaginationOptions
) {
  const numItems = resolvePageSize(paginationOpts);

  const maxBidsToRead = MAX_LOTS_FOR_ENDING_SORT * 3;
  const bids = await ctx.db
    .query("bids")
    .withIndex("by_bidder_timestamp", (q) => q.eq("bidderId", userId))
    .filter((q) => q.neq(q.field("status"), "voided"))
    .order("desc")
    .take(maxBidsToRead);

  const distinctLotIds = new Set<Id<"lots">>();
  for (const bid of bids) {
    distinctLotIds.add(bid.lotId);
    if (distinctLotIds.size >= MAX_LOTS_FOR_ENDING_SORT) {
      break;
    }
  }

  const lotIdsArray = Array.from(distinctLotIds);
  const lots = await Promise.all(
    lotIdsArray.map((id) => ctx.db.get("lots", id))
  );

  const validLots = lots.filter((lot): lot is Doc<"lots"> => lot !== null);

  const lotSummaries = await toLotSummaries(ctx, validLots);
  const summariesByLotId = new Map(lotSummaries.map((s) => [s._id, s]));

  const statsMap = await computeLotStatsForUser(ctx, userId, distinctLotIds);

  const allAuctionSummaries = lotIdsArray
    .map((lotId) => {
      const summary = summariesByLotId.get(lotId);
      if (!summary) return null;
      const lot = lots.find((l) => l?._id === lotId);
      if (!lot) return null;
      const stats = statsMap.get(lotId);
      if (!stats) return null;

      const isWinning =
        lot.status === "assigned" &&
        stats.highestBid === lot.currentPrice &&
        lot.winnerId === userId;

      return {
        ...summary,
        myHighestBid: stats.highestBid,
        isWinning,
        isWon: lot.status === "sold" && lot.winnerId === userId,
        isOutbid: lot.status === "assigned" && !isWinning,
        isCancelled: lot.status === "rejected",
        bidAmount: stats.highestBid,
        bidTimestamp: stats.lastBidTimestamp,
        lastBidTimestamp: stats.lastBidTimestamp,
        bidCount: stats.bidCount,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  allAuctionSummaries.sort((a, b) => {
    const timeA =
      a.extendedEndTime ?? a.auctionEndTime ?? Number.MAX_SAFE_INTEGER;
    const timeB =
      b.extendedEndTime ?? b.auctionEndTime ?? Number.MAX_SAFE_INTEGER;
    return timeA - timeB;
  });

  const totalCount = allAuctionSummaries.length;
  const startIndex = Math.min(
    parseOffsetCursor(paginationOpts.cursor),
    totalCount
  );

  const page = allAuctionSummaries.slice(startIndex, startIndex + numItems);
  const isDone = startIndex + numItems >= totalCount;
  const continueCursor = isDone ? "" : (startIndex + numItems).toString();

  return {
    page,
    isDone,
    continueCursor,
    totalCount,
    pageStatus: null,
    splitCursor: null,
  };
}

/**
 * Query: Get user's bid history with lot details.
 * Args: paginationOpts, sort (recent|ending)
 *
 * @returns Paginated bid results
 */
export const getMyBids = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sort: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        ...LotSummaryValidator.fields,
        myHighestBid: v.number(),
        isWinning: v.boolean(),
        isWon: v.boolean(),
        isOutbid: v.boolean(),
        isCancelled: v.boolean(),
        bidAmount: v.number(),
        bidTimestamp: v.number(),
        lastBidTimestamp: v.number(),
        bidCount: v.number(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRequired"),
        v.literal("SplitRecommended"),
        v.null()
      )
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: getMyBidsHandler,
});

/**
 * Returns the total number of active auctions the user has bid on.
 *
 * @param ctx - Convex Query context
 * @returns The bid count
 */
export const getMyBidsCountHandler = async (ctx: QueryCtx) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) return 0;

  const { auctionStatsMap } = await calculateUserBidStats(ctx, userId);
  return auctionStatsMap.size;
};

/**
 * Query: Get user's bid count.
 * Args: (none)
 *
 * @returns The bid count
 */
export const getMyBidsCount = query({
  args: {},
  returns: v.number(),
  handler: getMyBidsCountHandler,
});

/**
 * Returns global bid statistics for the current user (winning, outbid, exposure).
 *
 * @param ctx - Convex Query context
 * @returns User bid statistics
 */
export const getMyBidsStatsHandler = async (ctx: QueryCtx) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId)
    return {
      totalActive: 0,
      winningCount: 0,
      outbidCount: 0,
      totalExposure: 0,
    };

  const { globalStats } = await calculateUserBidStats(ctx, userId);
  return globalStats;
};

/**
 * Query: Get user's bid statistics.
 * Args: (none)
 *
 * @returns User bid statistics
 */
export const getMyBidsStats = query({
  args: {},
  returns: v.object({
    totalActive: v.number(),
    winningCount: v.number(),
    outbidCount: v.number(),
    totalExposure: v.number(),
  }),
  handler: getMyBidsStatsHandler,
});
