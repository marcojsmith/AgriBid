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
 * per-lot cap of 200 counted views per hour. Only `assigned` lots are counted.
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
  const now = Date.now();
  const candidates = await ctx.db
    .query("auctions")
    .withIndex("by_status_endTime", (q) =>
      q.eq("status", "published").gt("endTime", now)
    )
    .take(LIVE_AUCTION_SCAN_CAP);
  const live = candidates.find((auction) => auction.startTime <= now);
  return live?._id ?? null;
}

interface EngagedCandidate {
  lot: Doc<"lots">;
  watchers: number;
  bids: number;
  views: number;
  score: number;
}

/**
 * Public: the most engaged lots (watchers + valid bids + views) of an auction.
 * Without `auctionId`, uses the live auction that ends soonest.
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

    const lots = await ctx.db
      .query("lots")
      .withIndex("by_status_auctionId", (q) =>
        q.eq("status", "assigned").eq("auctionId", auctionId)
      )
      .take(constants.ENGAGEMENT_CANDIDATE_CAP);

    const scored: EngagedCandidate[] = await Promise.all(
      lots
        .filter((lot) => lot.hiddenByFlags !== true)
        .map(async (lot) => {
          const [watchers, views, bidRows] = await Promise.all([
            getWatcherCount(ctx, lot._id),
            getViewCount(ctx, lot._id),
            ctx.db
              .query("bids")
              .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
              .take(constants.ENGAGEMENT_BID_COUNT_CAP + 1),
          ]);
          const bids = Math.min(
            bidRows.filter((bid) => bid.status !== "voided").length,
            constants.ENGAGEMENT_BID_COUNT_CAP
          );
          return { lot, watchers, bids, views, score: watchers + bids + views };
        })
    );

    scored.sort(
      (a, b) =>
        b.score - a.score ||
        (a.lot.lotNumber ?? Number.MAX_SAFE_INTEGER) -
          (b.lot.lotNumber ?? Number.MAX_SAFE_INTEGER) ||
        a.lot._id.localeCompare(b.lot._id)
    );

    const top = scored.slice(0, limit);
    const summaries = await toLotSummaries(
      ctx,
      top.map((entry) => entry.lot)
    );
    return top.map((entry, index) => ({
      lot: summaries[index],
      watchers: entry.watchers,
      bids: entry.bids,
      views: entry.views,
      score: entry.score,
    }));
  },
});
