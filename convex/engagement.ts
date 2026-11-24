import { ConvexError, v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getCounter, updateCounter } from "./admin_utils";
import { LotSummaryValidator, toLotSummaries } from "./auctions/helpers";
import * as constants from "./constants";
import { getAuthUser, resolveUserId } from "./lib/auth";
import {
  anonViewCounterName,
  getBidCount,
  getViewCount,
  getWatcherCount,
  removeLotWatchData,
  viewCounterName,
} from "./lib/lotCounters";

/** Accepted anonymous session ids: 8-64 chars of [A-Za-z0-9_-]. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Live auctions read when looking for the earliest-ending one. */
const LIVE_AUCTION_SCAN_CAP = 50;

/**
 * Resolves the key that identifies a viewer. Keys are namespaced so a
 * client-chosen session id can never collide with a user id: `u:<userId>` for
 * signed-in viewers, `s:<sessionId>` for anonymous ones.
 *
 * @param ctx - Mutation context
 * @param sessionId - Anonymous session id from the client
 * @returns The prefixed viewer key and whether the viewer is anonymous
 * @throws ConvexError when signed out and the session id is missing or invalid
 */
async function resolveViewerKey(
  ctx: MutationCtx,
  sessionId: string | undefined
): Promise<{ viewerKey: string; anonymous: boolean }> {
  const authUser = await getAuthUser(ctx);
  const userId = authUser ? resolveUserId(authUser) : null;
  if (userId) return { viewerKey: `u:${userId}`, anonymous: false };
  if (sessionId === undefined || !SESSION_ID_PATTERN.test(sessionId)) {
    throw new ConvexError("Invalid session id");
  }
  return { viewerKey: `s:${sessionId}`, anonymous: true };
}

/**
 * Reserves one slot of a lot's hourly anonymous-view budget. The budget lives
 * in a single counter row per lot: `active` holds the current hour bucket and
 * `total` the views counted in it, so the table stays bounded.
 *
 * @param ctx - Mutation context
 * @param lotId - The viewed lot
 * @param now - Current time in ms
 * @returns False when the lot's anonymous cap for this hour is exhausted
 */
async function reserveAnonymousView(
  ctx: MutationCtx,
  lotId: Id<"lots">,
  now: number
): Promise<boolean> {
  const name = anonViewCounterName(lotId);
  const bucket = Math.floor(now / constants.MS_PER_HOUR);
  const counter = await getCounter(ctx, name);
  if (counter?.active === bucket) {
    if (counter.total >= constants.LOT_ANON_VIEW_CAP_PER_HOUR) {
      return false;
    }
    await updateCounter(ctx, name, "total", 1);
    return true;
  }
  await updateCounter(ctx, name, "active", bucket, true);
  await updateCounter(ctx, name, "total", 1, true);
  return true;
}

/**
 * Records a view of a lot. A viewer counts once per lot per 30 minutes and at
 * most 60 counted views per hour; anonymous viewers additionally share a
 * per-lot cap of 20 counted views per hour. Only `assigned` lots are counted.
 *
 * @param ctx - Mutation context
 * @param args - Lot id and optional anonymous session id
 * @param args.lotId - The viewed lot
 * @param args.sessionId - Anonymous session id (used when signed out)
 * @returns Whether the view was counted
 */
export async function recordLotViewHandler(
  ctx: MutationCtx,
  args: { lotId: Id<"lots">; sessionId?: string }
): Promise<{ counted: boolean }> {
  const { viewerKey, anonymous } = await resolveViewerKey(ctx, args.sessionId);

  const lot = await ctx.db.get("lots", args.lotId);
  if (lot?.status !== "assigned") return { counted: false };

  const now = Date.now();
  const existing = await ctx.db
    .query("lotViewers")
    .withIndex("by_lotId_and_viewerKey", (q) =>
      q.eq("lotId", args.lotId).eq("viewerKey", viewerKey)
    )
    .first();
  if (existing && now - existing.lastViewedAt < constants.LOT_VIEW_DEDUPE_MS) {
    return { counted: false };
  }

  const recent = await ctx.db
    .query("lotViewers")
    .withIndex("by_viewerKey_and_lastViewedAt", (q) =>
      q
        .eq("viewerKey", viewerKey)
        .gt("lastViewedAt", now - constants.LOT_VIEW_RATE_LIMIT_WINDOW_MS)
    )
    .take(constants.LOT_VIEW_RATE_LIMIT_PER_HOUR + 1);
  if (recent.length >= constants.LOT_VIEW_RATE_LIMIT_PER_HOUR) {
    return { counted: false };
  }

  if (anonymous && !(await reserveAnonymousView(ctx, args.lotId, now))) {
    return { counted: false };
  }

  if (existing) {
    await ctx.db.patch("lotViewers", existing._id, { lastViewedAt: now });
  } else {
    await ctx.db.insert("lotViewers", {
      lotId: args.lotId,
      viewerKey,
      lastViewedAt: now,
    });
  }
  await updateCounter(ctx, viewCounterName(args.lotId), "total", 1);
  return { counted: true };
}

/**
 * Public: record a lot view (signed in or anonymous with a session id).
 */
export const recordLotView = mutation({
  args: { lotId: v.id("lots"), sessionId: v.optional(v.string()) },
  returns: v.object({ counted: v.boolean() }),
  handler: recordLotViewHandler,
});

/**
 * Deletes `lotViewers` rows older than 24 hours, one bounded batch per run.
 *
 * @param ctx - Mutation context
 * @returns The number deleted and whether more rows remain
 */
export async function purgeLotViewersHandler(
  ctx: MutationCtx
): Promise<{ deleted: number; hasMore: boolean }> {
  const cutoff = Date.now() - constants.LOT_VIEWER_RETENTION_MS;
  const rows = await ctx.db
    .query("lotViewers")
    .withIndex("by_lastViewedAt", (q) => q.lt("lastViewedAt", cutoff))
    .take(constants.LOT_VIEWER_PURGE_BATCH);
  await Promise.all(rows.map((row) => ctx.db.delete("lotViewers", row._id)));
  return {
    deleted: rows.length,
    hasMore: rows.length === constants.LOT_VIEWER_PURGE_BATCH,
  };
}

/**
 * Internal: purge stale lot-viewer dedupe rows (called by the gated cron).
 */
export const purgeLotViewers = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), hasMore: v.boolean() }),
  handler: purgeLotViewersHandler,
});

/**
 * Internal: continues removing a deleted lot's watchlist rows, viewer rows and
 * counters, one bounded batch per run. Scheduled by `removeLotWatchData` while
 * rows remain.
 */
export const continueLotDataRemoval = internalMutation({
  args: { lotId: v.id("lots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await removeLotWatchData(ctx, args.lotId);
    return null;
  },
});

/**
 * Engagement score of a lot: `bids * 3 + watchers * 2 + log2(1 + views)`.
 * Valid bids weigh most, watchers next, and views are logarithmic so a flood of
 * (cheap) views cannot outrank real intent. Rounded to 3 decimals so the stored
 * value is stable and unchanged rows are never rewritten.
 *
 * @param signals - The lot's counters
 * @param signals.bids - Valid (non-voided) bid count
 * @param signals.watchers - Watcher count
 * @param signals.views - Counted view count
 * @returns The engagement score
 */
export function computeEngagementScore(signals: {
  bids: number;
  watchers: number;
  views: number;
}): number {
  const raw =
    signals.bids * constants.ENGAGEMENT_BID_WEIGHT +
    signals.watchers * constants.ENGAGEMENT_WATCHER_WEIGHT +
    Math.log2(1 + signals.views);
  return Math.round(raw * 1000) / 1000;
}

/**
 * Live (published, started, not ended) auctions that end soonest first.
 * Exported for the share-preview queries.
 *
 * @param ctx - Query context
 * @param now - Current time in ms
 * @returns Up to `LIVE_AUCTION_SCAN_CAP` live auctions, soonest-ending first
 */
export async function listLiveAuctions(
  ctx: QueryCtx,
  now: number
): Promise<Doc<"auctions">[]> {
  const candidates = await ctx.db
    .query("auctions")
    .withIndex("by_status_endTime", (q) =>
      q.eq("status", "published").gt("endTime", now)
    )
    .take(LIVE_AUCTION_SCAN_CAP);
  return candidates.filter((auction) => auction.startTime <= now);
}

/**
 * Picks the auction to rank: the given published auction, or the live
 * published auction that ends soonest.
 *
 * @param ctx - Query context
 * @param auctionId - Optional explicit auction
 * @returns The auction id, or null when there is nothing to rank
 */
async function resolveEngagementAuction(
  ctx: QueryCtx,
  auctionId: Id<"auctions"> | undefined
): Promise<Id<"auctions"> | null> {
  if (auctionId) {
    const auction = await ctx.db.get("auctions", auctionId);
    return auction?.status === "published" ? auction._id : null;
  }
  const live = await listLiveAuctions(ctx, Date.now());
  return live[0]?._id ?? null;
}

/** Outcome of one `refreshEngagementScores` run. */
export interface EngagementRefreshResult {
  auctions: number;
  upserted: number;
  removed: number;
}

/**
 * Rebuilds the `engagementScores` rows of the live auctions that end soonest
 * (at most `ENGAGEMENT_REFRESH_AUCTION_CAP`, each with at most
 * `ENGAGEMENT_CANDIDATE_CAP` assigned, unhidden lots). It reads ONLY counter
 * rows (watchers, views, bids), never the `bids` table. Rows are upserted and
 * patched only when a value changed; rows of lots that are no longer assigned
 * (or hidden) in the auction are deleted, as are bounded batches of rows whose
 * auction is no longer published. Idempotent.
 *
 * @param ctx - Mutation context
 * @returns Counts of auctions processed and rows written/removed
 */
export async function refreshEngagementScoresHandler(
  ctx: MutationCtx
): Promise<EngagementRefreshResult> {
  const now = Date.now();
  const auctions = (await listLiveAuctions(ctx, now)).slice(
    0,
    constants.ENGAGEMENT_REFRESH_AUCTION_CAP
  );
  let upserted = 0;
  let removed = 0;

  for (const auction of auctions) {
    const lots = await ctx.db
      .query("lots")
      .withIndex("by_status_auctionId", (q) =>
        q.eq("status", "assigned").eq("auctionId", auction._id)
      )
      .take(constants.ENGAGEMENT_CANDIDATE_CAP);
    const eligible = lots.filter((lot) => lot.hiddenByFlags !== true);
    const eligibleIds = new Set<Id<"lots">>(eligible.map((lot) => lot._id));

    for (const lot of eligible) {
      const [watchers, views, bids, existing] = await Promise.all([
        getWatcherCount(ctx, lot._id),
        getViewCount(ctx, lot._id),
        getBidCount(ctx, lot._id),
        ctx.db
          .query("engagementScores")
          .withIndex("by_lotId", (q) => q.eq("lotId", lot._id))
          .first(),
      ]);
      const next = {
        lotId: lot._id,
        auctionId: auction._id,
        lotNumber: lot.lotNumber,
        bids,
        watchers,
        views,
        score: computeEngagementScore({ bids, watchers, views }),
      };
      if (!existing) {
        await ctx.db.insert("engagementScores", { ...next, updatedAt: now });
        upserted++;
      } else if (
        existing.auctionId !== next.auctionId ||
        existing.lotNumber !== next.lotNumber ||
        existing.bids !== next.bids ||
        existing.watchers !== next.watchers ||
        existing.views !== next.views ||
        existing.score !== next.score
      ) {
        await ctx.db.patch("engagementScores", existing._id, {
          ...next,
          updatedAt: now,
        });
        upserted++;
      }
    }

    const stored = await ctx.db
      .query("engagementScores")
      .withIndex("by_auctionId_and_score", (q) =>
        q.eq("auctionId", auction._id)
      )
      .take(constants.ENGAGEMENT_CANDIDATE_CAP * 2);
    for (const row of stored) {
      if (!eligibleIds.has(row.lotId)) {
        await ctx.db.delete("engagementScores", row._id);
        removed++;
      }
    }
  }

  removed += await sweepStaleEngagementScores(ctx);

  return { auctions: auctions.length, upserted, removed };
}

/**
 * Deletes `engagementScores` rows whose auction is gone or no longer
 * `published` (closed, or sent back to draft), scanning at most
 * `ENGAGEMENT_SWEEP_SCAN` rows. Covers closes that bypassed the close paths
 * and rows left by a bounded delete.
 *
 * @param ctx - Mutation context
 * @returns The number of rows deleted
 */
async function sweepStaleEngagementScores(ctx: MutationCtx): Promise<number> {
  const scanned = await ctx.db
    .query("engagementScores")
    .take(constants.ENGAGEMENT_SWEEP_SCAN);
  const published = new Map<Id<"auctions">, boolean>();
  let removed = 0;
  for (const row of scanned) {
    let isPublished = published.get(row.auctionId);
    if (isPublished === undefined) {
      const auction = await ctx.db.get("auctions", row.auctionId);
      isPublished = auction?.status === "published";
      published.set(row.auctionId, isPublished);
    }
    if (!isPublished) {
      await ctx.db.delete("engagementScores", row._id);
      removed++;
    }
  }
  return removed;
}

/**
 * Internal: refresh the precomputed engagement scores (called by the gated
 * cron every 5 minutes).
 */
export const refreshEngagementScores = internalMutation({
  args: {},
  returns: v.object({
    auctions: v.number(),
    upserted: v.number(),
    removed: v.number(),
  }),
  handler: refreshEngagementScoresHandler,
});

/** One ranked lot of a sale with its precomputed engagement row. */
export interface EngagedLotEntry {
  lot: Doc<"lots">;
  row: Doc<"engagementScores">;
}

/**
 * Ranks a published sale's lots by the precomputed `engagementScores` (top
 * `limit`, ties to the lower lot number then the lower id) and returns the lot
 * documents that are still assigned, in the sale and unhidden.
 *
 * @param ctx - Query context
 * @param auctionId - The sale to rank
 * @param limit - How many ranked rows to read (already clamped by the caller)
 * @returns Up to `limit` lots with their score rows, best first
 */
export async function mostEngagedLotDocs(
  ctx: QueryCtx,
  auctionId: Id<"auctions">,
  limit: number
): Promise<EngagedLotEntry[]> {
  const top = await ctx.db
    .query("engagementScores")
    .withIndex("by_auctionId_and_score", (q) => q.eq("auctionId", auctionId))
    .order("desc")
    .take(limit);

  // The index orders equal scores by creation time; re-resolve the tie at
  // the cut-off so the documented tie-break (lot number, then id) holds.
  let ranked = top;
  if (top.length === limit) {
    const cutoff = top[limit - 1].score;
    const tied = await ctx.db
      .query("engagementScores")
      .withIndex("by_auctionId_and_score", (q) =>
        q.eq("auctionId", auctionId).eq("score", cutoff)
      )
      .take(constants.ENGAGEMENT_CANDIDATE_CAP);
    ranked = [...top.filter((row) => row.score > cutoff), ...tied];
  }
  ranked = [...ranked]
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.lotNumber ?? Number.MAX_SAFE_INTEGER) -
          (b.lotNumber ?? Number.MAX_SAFE_INTEGER) ||
        a.lotId.localeCompare(b.lotId)
    )
    .slice(0, limit);

  const entries: {
    lot: Doc<"lots">;
    row: Doc<"engagementScores">;
  }[] = [];
  for (const row of ranked) {
    const lot = await ctx.db.get("lots", row.lotId);
    // A lot may have left the sale or been hidden since the last refresh.
    if (
      lot?.status === "assigned" &&
      lot.auctionId === auctionId &&
      lot.hiddenByFlags !== true
    ) {
      entries.push({ lot, row });
    }
  }

  return entries;
}

/**
 * Public: the most engaged lots of an auction, ranked by the precomputed
 * `engagementScores` (score = bids * 3 + watchers * 2 + log2(1 + views),
 * refreshed every 5 minutes). Without `auctionId`, uses the live auction that
 * ends soonest. Ties go to the lower lot number, then the lower id. Reads only
 * `engagementScores` (top `limit` via `by_auctionId_and_score`, plus the rows
 * tied with the last one) and the top lots themselves, so view counts never
 * re-run it. Empty until the first refresh.
 */
export const getMostEngagedLots = query({
  args: {
    auctionId: v.optional(v.id("auctions")),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      lot: LotSummaryValidator,
      watchers: v.number(),
      bids: v.number(),
      views: v.number(),
      score: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const rawLimit = Number.isFinite(args.limit)
      ? Math.floor(args.limit ?? constants.ENGAGEMENT_DEFAULT_LIMIT)
      : constants.ENGAGEMENT_DEFAULT_LIMIT;
    const limit = Math.min(
      Math.max(rawLimit, 1),
      constants.ENGAGEMENT_MAX_LIMIT
    );

    const auctionId = await resolveEngagementAuction(ctx, args.auctionId);
    if (!auctionId) return [];

    const entries = await mostEngagedLotDocs(ctx, auctionId, limit);

    const summaries = await toLotSummaries(
      ctx,
      entries.map((entry) => entry.lot)
    );
    return entries.map((entry, index) => ({
      lot: summaries[index],
      watchers: entry.row.watchers,
      bids: entry.row.bids,
      views: entry.row.views,
      score: entry.row.score,
    }));
  },
});

/** The most sales `getMostEngagedLotAcrossSales` considers. */
const FEATURED_MAX_SALES = 4;

/**
 * Public: the single most engaged lot across several live sales (the multi-
 * sale Home hero). Reads the top precomputed `engagementScores` row of each
 * sale (at most {@link FEATURED_MAX_SALES}), takes the highest score (ties go
 * to the lower lot number, then the lower id) and returns that lot's summary,
 * or null when no sale has a ranked lot yet.
 */
export const getMostEngagedLotAcrossSales = query({
  args: { auctionIds: v.array(v.id("auctions")) },
  returns: v.union(
    v.null(),
    v.object({
      lot: LotSummaryValidator,
      watchers: v.number(),
      bids: v.number(),
      views: v.number(),
      score: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const rows: Doc<"engagementScores">[] = [];
    for (const auctionId of args.auctionIds.slice(0, FEATURED_MAX_SALES)) {
      const top = await ctx.db
        .query("engagementScores")
        .withIndex("by_auctionId_and_score", (q) =>
          q.eq("auctionId", auctionId)
        )
        .order("desc")
        .take(3);
      rows.push(...top);
    }
    rows.sort(
      (a, b) =>
        b.score - a.score ||
        (a.lotNumber ?? Number.MAX_SAFE_INTEGER) -
          (b.lotNumber ?? Number.MAX_SAFE_INTEGER) ||
        a.lotId.localeCompare(b.lotId)
    );
    for (const row of rows) {
      const lot = await ctx.db.get("lots", row.lotId);
      if (
        lot?.status === "assigned" &&
        lot.auctionId === row.auctionId &&
        lot.hiddenByFlags !== true
      ) {
        const [summary] = await toLotSummaries(ctx, [lot]);
        return {
          lot: summary,
          watchers: row.watchers,
          bids: row.bids,
          views: row.views,
          score: row.score,
        };
      }
    }
    return null;
  },
});
