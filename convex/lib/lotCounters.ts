import { internal } from "../_generated/api";
import { getCounter, updateCounter } from "../admin_utils";
import { LOT_DATA_DELETE_BATCH } from "../constants";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Counter row name holding the last lot number issued in a sale.
 * @param auctionId - The auction container id.
 * @returns The counter name.
 */
export const lotNumberCounterName = (auctionId: Id<"auctions">) =>
  `lotNumber:${auctionId}`;

/**
 * Counter row name holding a lot's watcher count (in `total`).
 * @param lotId - The lot id.
 * @returns The counter name.
 */
export const watcherCounterName = (lotId: Id<"lots">) => `watchers:${lotId}`;

/**
 * Counter row name holding a lot's view count (in `total`).
 * @param lotId - The lot id.
 * @returns The counter name.
 */
export const viewCounterName = (lotId: Id<"lots">) => `views:${lotId}`;

/**
 * Counter row name holding a lot's valid (non-voided) bid count (in `total`).
 * @param lotId - The lot id.
 * @returns The counter name.
 */
export const bidCounterName = (lotId: Id<"lots">) => `bids:${lotId}`;

/**
 * Counter row name holding a lot's anonymous-view budget: `active` is the hour
 * bucket and `total` the anonymous views counted in it.
 * @param lotId - The lot id.
 * @returns The counter name.
 */
export const anonViewCounterName = (lotId: Id<"lots">) => `anonviews:${lotId}`;

/**
 * Issues the next lot number for a sale from a monotonic per-auction counter.
 * Numbers are never reused within a sale, even after a lot is unassigned.
 * Convex mutations are serialisable, so concurrent assignments conflict and
 * retry rather than issuing the same number twice.
 *
 * @param ctx - Mutation context.
 * @param auctionId - The auction container the lot is being assigned to.
 * @returns The newly issued lot number (starting at 1).
 */
export async function issueNextLotNumber(
  ctx: MutationCtx,
  auctionId: Id<"auctions">
): Promise<number> {
  const name = lotNumberCounterName(auctionId);
  const counter = await getCounter(ctx, name);
  const next = (counter?.total ?? 0) + 1;
  await updateCounter(ctx, name, "total", next, true);
  return next;
}

/**
 * Applies a delta to a lot's watcher counter, never going below 0.
 *
 * @param ctx - Mutation context.
 * @param lotId - The watched lot.
 * @param delta - `+1` on watch, `-1` on unwatch.
 */
export async function adjustWatcherCount(
  ctx: MutationCtx,
  lotId: Id<"lots">,
  delta: 1 | -1
): Promise<void> {
  await updateCounter(ctx, watcherCounterName(lotId), "total", delta);
}

/**
 * Applies a delta to a lot's valid-bid counter, never going below 0. Call with
 * `+1` wherever a valid bid is inserted and `-1` when a valid bid is voided or
 * removed.
 *
 * @param ctx - Mutation context.
 * @param lotId - The lot the bid belongs to.
 * @param delta - `+1` when a valid bid is added, `-1` when one is voided.
 */
export async function adjustBidCount(
  ctx: MutationCtx,
  lotId: Id<"lots">,
  delta: 1 | -1
): Promise<void> {
  await updateCounter(ctx, bidCounterName(lotId), "total", delta);
}

/**
 * Deletes (at most) one bounded batch of a lot's watchlist rows and its
 * `lotViewers` dedupe rows. When more rows remain it schedules
 * `internal.engagement.continueLotDataRemoval` to continue; the watcher/view
 * counters are only removed once every row is gone. Call when a lot is deleted
 * so no orphaned rows or counters remain.
 *
 * @param ctx - Mutation context.
 * @param lotId - The lot being deleted.
 */
export async function removeLotWatchData(
  ctx: MutationCtx,
  lotId: Id<"lots">
): Promise<void> {
  const rows = await ctx.db
    .query("watchlist")
    .withIndex("by_lot", (q) => q.eq("lotId", lotId))
    .take(LOT_DATA_DELETE_BATCH);
  await Promise.all(rows.map((row) => ctx.db.delete("watchlist", row._id)));
  const watchHasMore = rows.length === LOT_DATA_DELETE_BATCH;

  const viewHasMore = await removeLotViewData(ctx, lotId);

  if (watchHasMore || viewHasMore) {
    await ctx.scheduler.runAfter(
      0,
      internal.engagement.continueLotDataRemoval,
      {
        lotId,
      }
    );
    return;
  }
  for (const name of [watcherCounterName(lotId), bidCounterName(lotId)]) {
    const counter = await getCounter(ctx, name);
    if (counter) await ctx.db.delete("counters", counter._id);
  }
  const scores = await ctx.db
    .query("engagementScores")
    .withIndex("by_lotId", (q) => q.eq("lotId", lotId))
    .take(LOT_DATA_DELETE_BATCH);
  await Promise.all(
    scores.map((row) => ctx.db.delete("engagementScores", row._id))
  );
}

/**
 * Deletes (at most) one bounded batch of an auction's `engagementScores` rows.
 * Call when an auction closes so its precomputed ranking does not linger; the
 * 5-minute `refreshEngagementScores` cron sweeps any rows left over.
 *
 * @param ctx - Mutation context.
 * @param auctionId - The auction that closed.
 * @returns The number of rows deleted.
 */
export async function deleteAuctionEngagementScores(
  ctx: MutationCtx,
  auctionId: Id<"auctions">
): Promise<number> {
  const rows = await ctx.db
    .query("engagementScores")
    .withIndex("by_auctionId_and_score", (q) => q.eq("auctionId", auctionId))
    .take(LOT_DATA_DELETE_BATCH);
  await Promise.all(
    rows.map((row) => ctx.db.delete("engagementScores", row._id))
  );
  return rows.length;
}

/**
 * Deletes (at most) one bounded batch of a lot's `lotViewers` rows. When no
 * rows remain afterwards, also deletes the lot's view and anonymous-view
 * counters. The caller is responsible for continuing when this returns true
 * (see {@link removeLotWatchData}).
 *
 * @param ctx - Mutation context.
 * @param lotId - The lot being deleted.
 * @returns True when more `lotViewers` rows may remain.
 */
export async function removeLotViewData(
  ctx: MutationCtx,
  lotId: Id<"lots">
): Promise<boolean> {
  const rows = await ctx.db
    .query("lotViewers")
    .withIndex("by_lotId_and_viewerKey", (q) => q.eq("lotId", lotId))
    .take(LOT_DATA_DELETE_BATCH);
  await Promise.all(rows.map((row) => ctx.db.delete("lotViewers", row._id)));
  if (rows.length === LOT_DATA_DELETE_BATCH) return true;

  for (const name of [viewCounterName(lotId), anonViewCounterName(lotId)]) {
    const counter = await getCounter(ctx, name);
    if (counter) await ctx.db.delete("counters", counter._id);
  }
  return false;
}

/**
 * Reads a lot's view count from its counter row.
 *
 * @param ctx - Query or mutation context.
 * @param lotId - The lot.
 * @returns The view count, 0 when no counter exists.
 */
export async function getViewCount(
  ctx: QueryCtx,
  lotId: Id<"lots">
): Promise<number> {
  const counter = await getCounter(ctx, viewCounterName(lotId));
  return counter?.total ?? 0;
}

/**
 * Reads a lot's valid-bid count from its counter row.
 *
 * @param ctx - Query or mutation context.
 * @param lotId - The lot.
 * @returns The valid-bid count, 0 when no counter exists.
 */
export async function getBidCount(
  ctx: QueryCtx,
  lotId: Id<"lots">
): Promise<number> {
  const counter = await getCounter(ctx, bidCounterName(lotId));
  return counter?.total ?? 0;
}

/**
 * Reads a lot's watcher count from its counter row (a single indexed read).
 *
 * @param ctx - Query or mutation context.
 * @param lotId - The lot.
 * @returns The watcher count, 0 when no counter exists.
 */
export async function getWatcherCount(
  ctx: QueryCtx,
  lotId: Id<"lots">
): Promise<number> {
  const counter = await getCounter(ctx, watcherCounterName(lotId));
  return counter?.total ?? 0;
}
