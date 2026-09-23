import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { extractImageStorageIds, safeDelete } from "./lib/storage";
import {
  STORAGE_SWEEP_BATCH_SIZE,
  STORAGE_SWEEP_LOOKBACK_MS,
  STORAGE_SWEEP_MIN_AGE_MS,
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
 * as orphans and deleting live data. The scan is bounded on the storage side
 * instead: at most {@link STORAGE_SWEEP_BATCH_SIZE} files from a moving
 * {@link STORAGE_SWEEP_LOOKBACK_MS} window are examined per run. The window
 * overlaps multiple daily runs and excludes ancient referenced files that
 * would otherwise occupy every batch.
 *
 * @param ctx - The mutation context.
 * @returns The number of files examined (`scanned`) and deleted (`deleted`).
 */
export const sweepOrphanedUploadsHandler = async (ctx: MutationCtx) => {
  const cutoff = Date.now() - STORAGE_SWEEP_MIN_AGE_MS;
  const windowStart = cutoff - STORAGE_SWEEP_LOOKBACK_MS;

  const [lots, profiles, auctions] = await Promise.all([
    ctx.db.query("lots").collect(),
    ctx.db.query("profiles").collect(),
    ctx.db.query("auctions").collect(),
  ]);

  const inUse = new Set<string>();

  for (const lot of lots) {
    for (const id of extractImageStorageIds(lot.images)) inUse.add(id);
    if (lot.conditionReportUrl) inUse.add(lot.conditionReportUrl);
  }

  for (const profile of profiles) {
    for (const id of profile.kycDocuments ?? []) inUse.add(id);
  }

  for (const auction of auctions) {
    if (auction.bannerImage) inUse.add(auction.bannerImage);
  }

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
