import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { extractImageStorageIds, safeDelete } from "./lib/storage";
import {
  STORAGE_SWEEP_BATCH_SIZE,
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
 * instead: at most {@link STORAGE_SWEEP_BATCH_SIZE} oldest files are examined
 * per run, so a backlog is drained over consecutive daily runs.
 *
 * @param ctx - The mutation context.
 * @returns The number of files examined (`scanned`) and deleted (`deleted`).
 */
export const sweepOrphanedUploadsHandler = async (ctx: MutationCtx) => {
  const cutoff = Date.now() - STORAGE_SWEEP_MIN_AGE_MS;

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

  // Default order is ascending `_creationTime`, so `.take()` returns the
  // oldest qualifying files first.
  const candidates = await ctx.db.system
    .query("_storage")
    .filter((q) => q.lt(q.field("_creationTime"), cutoff))
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
