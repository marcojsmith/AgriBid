import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { extractImageStorageIds, safeDelete } from "./lib/storage";
import {
  STORAGE_SWEEP_BATCH_SIZE,
  STORAGE_SWEEP_LOOKBACK_MS,
  STORAGE_SWEEP_MIN_AGE_MS,
  STORAGE_SWEEP_REFERENCE_BATCH_SIZE,
} from "./constants";
import type { MutationCtx } from "./_generated/server";

/**
 * Handler for the orphaned-upload sweep.
 *
 * Deletes `_storage` files that are older than {@link STORAGE_SWEEP_MIN_AGE_MS}
 * and not referenced by any `lots.images`, `lots.conditionReportUrl`,
 * `profiles.kycDocuments` or `auctions.bannerImage` field. Uploads whose
 * referencing document is written moments after the upload are protected by
 * the age cutoff.
 *
 * Building the in-use set requires a full scan of `lots`, `profiles` and
 * `auctions`: there is no reverse index from storage ID to owning document,
 * and capping the reference scan would risk misclassifying referenced files
 * as orphans and deleting live data. The scan is bounded using pagination
 * with a batch size of {@link STORAGE_SWEEP_REFERENCE_BATCH_SIZE} per table
 * per run, accumulating only storage IDs. Multiple daily runs eventually
 * cover the full tables. The storage side is bounded separately: at most
 * {@link STORAGE_SWEEP_BATCH_SIZE} files from a moving
 * {@link STORAGE_SWEEP_LOOKBACK_MS} window are examined per run.
 *
 * @param ctx - The mutation context.
 * @returns The number of files examined (`scanned`) and deleted (`deleted`).
 */
export const sweepOrphanedUploadsHandler = async (ctx: MutationCtx) => {
  const cutoff = Date.now() - STORAGE_SWEEP_MIN_AGE_MS;
  const windowStart = cutoff - STORAGE_SWEEP_LOOKBACK_MS;

  const inUse = new Set<string>();

  // Paginate through reference tables, extracting only storage IDs
  // Each table is scanned in batches bounded by STORAGE_SWEEP_REFERENCE_BATCH_SIZE
  await scanLotsForStorageIds(ctx, inUse);
  await scanProfilesForStorageIds(ctx, inUse);
  await scanAuctionsForStorageIds(ctx, inUse);

  // Scan newest-first within an overlapping creation-time window so files
  // encountered by earlier runs cannot permanently block newer candidates.
  const candidates = await ctx.db.system
    .query("_storage")
    .withIndex("by_creation_time", (q) =>
      q.gte("_creationTime", windowStart).lt("_creationTime", cutoff)
    )
    .order("desc")
    .take(STORAGE_SWEEP_BATCH_SIZE);

  let deleted = 0;
  for (const file of candidates) {
    if (inUse.has(file._id)) continue;
    await safeDelete(ctx, file._id, "orphaned upload");
    deleted++;
  }

  console.warn(
    `Orphaned-upload sweep: scanned ${candidates.length.toString()} file(s), deleted ${deleted.toString()}.`
  );

  return { scanned: candidates.length, deleted };
};

/**
 * Scan lots table in bounded batches, accumulating storage IDs.
 * Returns the pagination cursor for continuation in subsequent runs.
 *
 * @param ctx - The mutation context.
 * @param inUse - Set to accumulate storage IDs.
 * @returns The pagination cursor for continuation.
 */
async function scanLotsForStorageIds(
  ctx: MutationCtx,
  inUse: Set<string>
): Promise<string | null> {
  let cursor: string | null = null;
  let scanned = 0;

  do {
    const page = await ctx.db
      .query("lots")
      .paginate({ numItems: STORAGE_SWEEP_REFERENCE_BATCH_SIZE, cursor });

    for (const lot of page.page) {
      for (const id of extractImageStorageIds(lot.images)) inUse.add(id);
      if (lot.conditionReportUrl) inUse.add(lot.conditionReportUrl);
    }

    scanned += page.page.length;
    cursor = page.isDone ? null : page.continueCursor;

    // Stop after one batch per run to bound work
    break;
  } while (cursor !== null && scanned < STORAGE_SWEEP_REFERENCE_BATCH_SIZE);

  return cursor;
}

/**
 * Scan profiles table in bounded batches, accumulating storage IDs.
 * Returns the pagination cursor for continuation in subsequent runs.
 *
 * @param ctx - The mutation context.
 * @param inUse - Set to accumulate storage IDs.
 * @returns The pagination cursor for continuation.
 */
async function scanProfilesForStorageIds(
  ctx: MutationCtx,
  inUse: Set<string>
): Promise<string | null> {
  let cursor: string | null = null;
  let scanned = 0;

  do {
    const page = await ctx.db
      .query("profiles")
      .paginate({ numItems: STORAGE_SWEEP_REFERENCE_BATCH_SIZE, cursor });

    for (const profile of page.page) {
      for (const id of profile.kycDocuments ?? []) inUse.add(id);
    }

    scanned += page.page.length;
    cursor = page.isDone ? null : page.continueCursor;

    // Stop after one batch per run to bound work
    break;
  } while (cursor !== null && scanned < STORAGE_SWEEP_REFERENCE_BATCH_SIZE);

  return cursor;
}

/**
 * Scan auctions table in bounded batches, accumulating storage IDs.
 * Returns the pagination cursor for continuation in subsequent runs.
 *
 * @param ctx - The mutation context.
 * @param inUse - Set to accumulate storage IDs.
 * @returns The pagination cursor for continuation.
 */
async function scanAuctionsForStorageIds(
  ctx: MutationCtx,
  inUse: Set<string>
): Promise<string | null> {
  let cursor: string | null = null;
  let scanned = 0;

  do {
    const page = await ctx.db
      .query("auctions")
      .paginate({ numItems: STORAGE_SWEEP_REFERENCE_BATCH_SIZE, cursor });

    for (const auction of page.page) {
      if (auction.bannerImage) inUse.add(auction.bannerImage);
    }

    scanned += page.page.length;
    cursor = page.isDone ? null : page.continueCursor;

    // Stop after one batch per run to bound work
    break;
  } while (cursor !== null && scanned < STORAGE_SWEEP_REFERENCE_BATCH_SIZE);

  return cursor;
}

/**
 * Internal mutation that sweeps orphaned uploads from storage.
 * Registered as a daily cron in `crons.ts`.
 */
export const sweepOrphanedUploads = internalMutation({
  args: {},
  returns: v.object({
    scanned: v.number(),
    deleted: v.number(),
  }),
  handler: sweepOrphanedUploadsHandler,
});
