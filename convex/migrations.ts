import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { countQuery, getCounter, updateCounter } from "./admin_utils";
import {
  bidCounterName,
  issueNextLotNumber,
  lotNumberCounterName,
  watcherCounterName,
} from "./lib/lotCounters";
import type { Id } from "./_generated/dataModel";
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

/** Most `platformFees` rows examined per `convertPercentageFeesToFractions` run. */
export const FEE_FRACTION_MIGRATION_CAP = 500;

/** One converted fee row, reported by `convertPercentageFeesToFractions`. */
export interface ConvertedFeeDetail {
  id: Id<"platformFees">;
  name: string;
  from: number;
  to: number;
}

/** Result of `convertPercentageFeesToFractions`. */
export interface FeeFractionMigrationResult {
  converted: number;
  skipped: number;
  details: ConvertedFeeDetail[];
}

/**
 * Converts percentage `platformFees` rows stored as whole percents (e.g. 12)
 * into fractions (0.12), the unit settlement and the fee validator use.
 *
 * Only percentage rows with `1 < value <= 100` are converted. Rows at or below
 * 1 are already fractions and are left alone, so re-running is a no-op (a
 * value of exactly 1 is ambiguous and treated as the fraction 100%). Fixed
 * fees and out-of-range values are skipped. Examines at most
 * `FEE_FRACTION_MIGRATION_CAP` rows per run.
 *
 * @param ctx - Mutation context.
 * @returns How many rows were converted/skipped and the before/after of each.
 */
export async function convertPercentageFeesToFractionsHandler(
  ctx: MutationCtx
): Promise<FeeFractionMigrationResult> {
  const fees = await ctx.db
    .query("platformFees")
    .take(FEE_FRACTION_MIGRATION_CAP);

  const details: ConvertedFeeDetail[] = [];
  let skipped = 0;
  const now = Date.now();
  for (const fee of fees) {
    if (fee.feeType !== "percentage" || fee.value <= 1 || fee.value > 100) {
      skipped++;
      continue;
    }
    // Round away binary float noise (e.g. 12.1 / 100).
    const to = Math.round((fee.value / 100) * 1e6) / 1e6;
    await ctx.db.patch("platformFees", fee._id, { value: to, updatedAt: now });
    details.push({ id: fee._id, name: fee.name, from: fee.value, to });
  }

  return { converted: details.length, skipped, details };
}

/**
 * Convert percentage fee rows stored as whole percents into fractions.
 * Run with `bunx convex run migrations:convertPercentageFeesToFractions`.
 * Idempotent.
 */
export const convertPercentageFeesToFractions = internalMutation({
  args: {},
  returns: v.object({
    converted: v.number(),
    skipped: v.number(),
    details: v.array(
      v.object({
        id: v.id("platformFees"),
        name: v.string(),
        from: v.number(),
        to: v.number(),
      })
    ),
  }),
  handler: convertPercentageFeesToFractionsHandler,
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

/** Lots examined per `backfillBidCounts` batch. */
export const BID_COUNT_BACKFILL_BATCH = 10;
/** Bids read per query while counting one lot's valid bids. */
export const BID_COUNT_PAGE_SIZE = 500;
/**
 * Bids read in total by one `backfillBidCounts` mutation. A lot with more bids
 * is counted across several reschedules, carrying a partial total.
 */
export const BID_COUNT_READ_BUDGET = 1000;

/** Result of one `backfillBidCounts` batch. */
interface BidCountBatchResult extends BatchResult {
  /** Valid bids counted across the lots of this batch. */
  bidsCounted: number;
}

/** Arguments of one `backfillBidCounts` batch (also its continuation state). */
export interface BidCountBatchArgs {
  /** Lots pagination cursor, `null` for the first batch. */
  cursor: string | null;
  /** Index within the lots page at which to resume (default 0). */
  lotIndex?: number;
  /** `timestamp` of the last bid already read for the resumed lot. */
  afterTimestamp?: number | null;
  /** Bids already read that share `afterTimestamp` (bids can tie on it). */
  skipAtTimestamp?: number;
  /** Valid bids already counted for the resumed lot. */
  partialValid?: number;
}

/**
 * One batch of the valid-bid-count rebuild.
 *
 * Walks the `lots` table and, for each lot, sets its `bids:<lotId>` counter to
 * the authoritative number of valid (not voided) bids. A lot's bids are read
 * through the `by_lot` index in pages of `BID_COUNT_PAGE_SIZE` and a mutation
 * reads at most `BID_COUNT_READ_BUDGET` bids, so no single mutation is
 * unbounded: when the budget runs out mid-lot, the batch reschedules itself
 * with the lots cursor, the lot's index in the page, the last read bid's
 * `timestamp` (plus how many bids already read share it) and the partial
 * total. Counter writes are absolute, so the
 * migration is idempotent and safe to re-run (run it while bids are quiet: a
 * bid placed on a lot between two of its pages is only reflected by a re-run).
 * Lots with no valid bids and no counter row are left alone. Reschedules itself
 * until the table is exhausted.
 *
 * @param ctx - Mutation context.
 * @param args - Batch arguments and continuation state.
 * @returns Counts for this batch (lots finished, not merely touched) and
 *   whether the migration finished.
 */
export async function backfillBidCountsHandler(
  ctx: MutationCtx,
  args: BidCountBatchArgs
): Promise<BidCountBatchResult> {
  const page = await ctx.db
    .query("lots")
    .paginate({ numItems: BID_COUNT_BACKFILL_BATCH, cursor: args.cursor });

  let updated = 0;
  let processed = 0;
  let bidsCounted = 0;
  let budget = BID_COUNT_READ_BUDGET;
  let afterTs = args.afterTimestamp ?? null;
  let skip = args.skipAtTimestamp ?? 0;
  let valid = args.partialValid ?? 0;

  for (let i = args.lotIndex ?? 0; i < page.page.length; i++) {
    const lot = page.page[i];

    let exhausted = false;
    while (!exhausted && budget > 0) {
      const limit = Math.min(BID_COUNT_PAGE_SIZE, budget);
      const from = afterTs;
      // `by_lot` orders by (timestamp, creation time). Resume at the last
      // read timestamp and skip the bids of it that were already read.
      const raw = await ctx.db
        .query("bids")
        .withIndex("by_lot", (q) =>
          from === null
            ? q.eq("lotId", lot._id)
            : q.eq("lotId", lot._id).gte("timestamp", from)
        )
        .take(limit + skip);
      budget -= raw.length;
      exhausted = raw.length < limit + skip;
      const chunk = raw.slice(skip);
      if (chunk.length > 0) {
        const lastTs = chunk[chunk.length - 1].timestamp;
        let tail = 0;
        while (
          tail < chunk.length &&
          chunk[chunk.length - 1 - tail].timestamp === lastTs
        ) {
          tail++;
        }
        skip = tail === chunk.length && lastTs === afterTs ? skip + tail : tail;
        afterTs = lastTs;
      }
      const validInChunk = chunk.filter(
        (bid) => bid.status !== "voided"
      ).length;
      valid += validInChunk;
      bidsCounted += validInChunk;
    }

    if (!exhausted) {
      // Read budget spent mid-lot: continue this lot in a fresh mutation.
      await ctx.scheduler.runAfter(0, internal.migrations.backfillBidCounts, {
        cursor: args.cursor,
        lotIndex: i,
        afterTimestamp: afterTs,
        skipAtTimestamp: skip,
        partialValid: valid,
      });
      return {
        processed,
        updated,
        bidsCounted,
        isDone: false,
        continueCursor: args.cursor,
      };
    }

    processed++;
    const name = bidCounterName(lot._id);
    const counter = await getCounter(ctx, name);
    const unchanged = counter ? counter.total === valid : valid === 0;
    if (!unchanged) {
      await updateCounter(ctx, name, "total", valid, true);
      updated++;
    }
    afterTs = null;
    skip = 0;
    valid = 0;
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(0, internal.migrations.backfillBidCounts, {
      cursor: page.continueCursor,
    });
  }

  return {
    processed,
    updated,
    bidsCounted,
    isDone: page.isDone,
    continueCursor: page.isDone ? null : page.continueCursor,
  };
}

/**
 * Rebuild every lot's valid-bid counter from `bids`, in bounded reads (see
 * {@link backfillBidCountsHandler}).
 * Run with `bunx convex run migrations:backfillBidCounts`. Idempotent. The
 * `lotIndex`/`afterTimestamp`/`skipAtTimestamp`/`partialValid` arguments are
 * continuation state set by the migration itself; do not pass them by hand.
 */
export const backfillBidCounts = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    lotIndex: v.optional(v.number()),
    afterTimestamp: v.optional(v.union(v.number(), v.null())),
    skipAtTimestamp: v.optional(v.number()),
    partialValid: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    updated: v.number(),
    bidsCounted: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) =>
    backfillBidCountsHandler(ctx, { ...args, cursor: args.cursor ?? null }),
});

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
