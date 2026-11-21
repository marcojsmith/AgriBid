import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { countQuery, getCounter, updateCounter } from "./admin_utils";
import {
  issueNextLotNumber,
  lotNumberCounterName,
  watcherCounterName,
} from "./lib/lotCounters";
import type { MutationCtx } from "./_generated/server";

/** Lots examined per `backfillLotNumbers` batch. */
export const LOT_NUMBER_BACKFILL_BATCH = 100;
/** Lots examined per `backfillWatcherCounts` batch (each does an index count). */
export const WATCHER_BACKFILL_BATCH = 25;

/** Result of one migration batch. */
interface BatchResult {
  processed: number;
  updated: number;
  isDone: boolean;
  continueCursor: string | null;
}

/**
 * One batch of the lot-number backfill.
 *
 * Walks the `lots` table in `_creationTime` order (so numbers follow creation
 * order within each sale). Lots that are in a sale (`auctionId` set, status
 * assigned/sold/unsold) and have no `lotNumber` get the next number from the
 * auction's monotonic counter. Lots that already have a number are skipped, and
 * the counter is raised to cover them so a later issue can never collide.
 * Re-running is a no-op once every lot is numbered. Reschedules itself until the
 * table is exhausted.
 *
 * @param ctx - Mutation context.
 * @param args - Batch arguments.
 * @param args.cursor - Pagination cursor, `null` for the first batch.
 * @returns Counts for this batch and whether the migration finished.
 */
export async function backfillLotNumbersHandler(
  ctx: MutationCtx,
  args: { cursor: string | null }
): Promise<BatchResult> {
  const page = await ctx.db
    .query("lots")
    .paginate({ numItems: LOT_NUMBER_BACKFILL_BATCH, cursor: args.cursor });

  let updated = 0;
  for (const lot of page.page) {
    if (!lot.auctionId) continue;
    if (
      lot.status !== "assigned" &&
      lot.status !== "sold" &&
      lot.status !== "unsold"
    ) {
      continue;
    }

    if (lot.lotNumber !== undefined) {
      // Keep the counter at or above every number already in use.
      const counter = await getCounter(
        ctx,
        lotNumberCounterName(lot.auctionId)
      );
      if ((counter?.total ?? 0) < lot.lotNumber) {
        await updateCounter(
          ctx,
          lotNumberCounterName(lot.auctionId),
          "total",
          lot.lotNumber,
          true
        );
      }
      continue;
    }

    const lotNumber = await issueNextLotNumber(ctx, lot.auctionId);
    await ctx.db.patch("lots", lot._id, { lotNumber });
    updated++;
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(0, internal.migrations.backfillLotNumbers, {
      cursor: page.continueCursor,
    });
  }

  return {
    processed: page.page.length,
    updated,
    isDone: page.isDone,
    continueCursor: page.isDone ? null : page.continueCursor,
  };
}

/**
 * Backfill `lots.lotNumber` for existing assigned/sold/unsold lots.
 * Run with `bunx convex run migrations:backfillLotNumbers`. Idempotent.
 */
export const backfillLotNumbers = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    processed: v.number(),
    updated: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) =>
    backfillLotNumbersHandler(ctx, { cursor: args.cursor ?? null }),
});

/**
 * One batch of the watcher-count rebuild.
 *
 * Walks the `lots` table and, for each lot, sets its `watchers:<lotId>` counter
 * to the authoritative number of `watchlist` rows (via the `by_lot` index). It
 * writes absolute values, so it is idempotent and tolerates watch/unwatch
 * mutations landing between batches. Lots with no watchers and no counter row
 * are left alone. Reschedules itself until the table is exhausted.
 *
 * @param ctx - Mutation context.
 * @param args - Batch arguments.
 * @param args.cursor - Pagination cursor, `null` for the first batch.
 * @returns Counts for this batch and whether the migration finished.
 */
export async function backfillWatcherCountsHandler(
  ctx: MutationCtx,
  args: { cursor: string | null }
): Promise<BatchResult> {
  const page = await ctx.db
    .query("lots")
    .paginate({ numItems: WATCHER_BACKFILL_BATCH, cursor: args.cursor });

  let updated = 0;
  for (const lot of page.page) {
    const name = watcherCounterName(lot._id);
    const [watchers, counter] = await Promise.all([
      countQuery(
        ctx.db
          .query("watchlist")
          .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
      ),
      getCounter(ctx, name),
    ]);

    if (watchers === 0 && !counter) continue;
    if (counter?.total === watchers) continue;

    await updateCounter(ctx, name, "total", watchers, true);
    updated++;
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(0, internal.migrations.backfillWatcherCounts, {
      cursor: page.continueCursor,
    });
  }

  return {
    processed: page.page.length,
    updated,
    isDone: page.isDone,
    continueCursor: page.isDone ? null : page.continueCursor,
  };
}

/**
 * Rebuild every lot's watcher counter from `watchlist`.
 * Run with `bunx convex run migrations:backfillWatcherCounts`. Idempotent.
 */
export const backfillWatcherCounts = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    processed: v.number(),
    updated: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) =>
    backfillWatcherCountsHandler(ctx, { cursor: args.cursor ?? null }),
});
