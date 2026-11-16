import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { extractImageStorageIds, safeDelete } from "./lib/storage";
import {
  STORAGE_SWEEP_BATCH_SIZE,
  STORAGE_SWEEP_LOOKBACK_MS,
  STORAGE_SWEEP_MAX_REFERENCE_PAGES,
  STORAGE_SWEEP_MIN_AGE_MS,
  STORAGE_SWEEP_REFERENCE_BATCH_SIZE,
} from "./constants";

/** Tables whose rows may reference `_storage` files. */
const referenceTableValidator = v.union(
  v.literal("lots"),
  v.literal("profiles"),
  v.literal("auctions")
);

const REFERENCE_TABLES = ["lots", "profiles", "auctions"] as const;

/** Result of one orphan sweep run. */
export interface SweepResult {
  scanned: number;
  deleted: number;
}

/** Tunables, overridable so tests can exercise pagination with tiny pages. */
export interface SweepOptions {
  referencePageSize?: number;
  maxPagesPerTable?: number;
}

/**
 * Returns the storage IDs referenced by ONE page of a reference table, plus
 * the cursor needed to continue. Only IDs leave the query so an action can
 * accumulate them cheaply.
 *
 * Read-only: callers are responsible for paging until `isDone`.
 */
export const listReferencedStorageIdsPage = internalQuery({
  args: {
    table: referenceTableValidator,
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  returns: v.object({
    ids: v.array(v.string()),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const paginationOpts = { numItems: args.numItems, cursor: args.cursor };
    const ids: string[] = [];
    let page;
    if (args.table === "lots") {
      page = await ctx.db.query("lots").paginate(paginationOpts);
      for (const lot of page.page) {
        ids.push(...extractImageStorageIds(lot.images));
        if (lot.conditionReportUrl) ids.push(lot.conditionReportUrl);
      }
    } else if (args.table === "profiles") {
      page = await ctx.db.query("profiles").paginate(paginationOpts);
      for (const profile of page.page) {
        ids.push(...(profile.kycDocuments ?? []));
      }
    } else {
      page = await ctx.db.query("auctions").paginate(paginationOpts);
      for (const auction of page.page) {
        if (auction.bannerImage) ids.push(auction.bannerImage);
      }
    }
    return {
      ids,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Lists sweep candidates: the newest `_storage` files inside the moving
 * lookback window that are older than the minimum age.
 *
 * Newest-first within an overlapping window so files encountered by earlier
 * runs cannot permanently block newer candidates.
 */
export const listSweepCandidates = internalQuery({
  args: {},
  returns: v.array(v.id("_storage")),
  handler: async (ctx) => {
    const cutoff = Date.now() - STORAGE_SWEEP_MIN_AGE_MS;
    const windowStart = cutoff - STORAGE_SWEEP_LOOKBACK_MS;
    const files = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) =>
        q.gte("_creationTime", windowStart).lt("_creationTime", cutoff)
      )
      .order("desc")
      .take(STORAGE_SWEEP_BATCH_SIZE);
    return files.map((file) => file._id);
  },
});

/**
 * Deletes the given candidate files. Re-reads each from `_storage` inside the
 * transaction, skips files that no longer exist, and re-checks the age cutoff
 * so a candidate can never be younger than {@link STORAGE_SWEEP_MIN_AGE_MS}
 * at deletion time. The caller must already have proven each ID unreferenced.
 *
 * @returns The number of files deleted.
 */
export const deleteOrphanedFiles = internalMutation({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - STORAGE_SWEEP_MIN_AGE_MS;
    let deleted = 0;
    for (const storageId of args.storageIds) {
      const file = await ctx.db.system.get("_storage", storageId);
      if (!file || file._creationTime >= cutoff) continue;
      await safeDelete(ctx, storageId, "orphaned upload");
      deleted++;
    }
    return deleted;
  },
});

/**
 * Orphaned-upload sweep orchestrator.
 *
 * Invariant: a file is deleted ONLY if every row of `lots`, `profiles` and
 * `auctions` was read and none references it. Each table is paged to
 * completion through {@link listReferencedStorageIdsPage}. If any page query
 * throws, or a table needs more than `maxPagesPerTable` pages, the error
 * propagates BEFORE any candidate is selected, so nothing is deleted.
 *
 * Remaining race (accepted): a file older than the minimum age that is
 * attached to a document after the scan passed its table and before the
 * delete mutation runs would be deleted. Fresh uploads are protected by the
 * age cutoff; this needs a >1 day old, previously unreferenced upload to be
 * newly attached within the few seconds a sweep takes. Candidates are listed
 * after the scan and deleted straight away to keep that window minimal.
 *
 * @param ctx - Any context able to run queries and mutations.
 * @param options - Optional page-size / page-count overrides.
 * @returns The number of candidates examined and files deleted.
 */
export async function runOrphanSweep(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  options: SweepOptions = {}
): Promise<SweepResult> {
  const numItems =
    options.referencePageSize ?? STORAGE_SWEEP_REFERENCE_BATCH_SIZE;
  const maxPages =
    options.maxPagesPerTable ?? STORAGE_SWEEP_MAX_REFERENCE_PAGES;
  const inUse = new Set<string>();

  for (const table of REFERENCE_TABLES) {
    let cursor: string | null = null;
    let done = false;
    for (let pageCount = 0; pageCount < maxPages && !done; pageCount++) {
      const page: {
        ids: string[];
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(
        internal.storageCleanup.listReferencedStorageIdsPage,
        { table, cursor, numItems }
      );
      for (const id of page.ids) inUse.add(id);
      done = page.isDone;
      cursor = page.continueCursor;
    }
    if (!done) {
      throw new Error(
        `Orphan sweep aborted: could not finish scanning "${table}" within ${maxPages.toString()} pages; nothing deleted.`
      );
    }
  }

  const candidates: Id<"_storage">[] = await ctx.runQuery(
    internal.storageCleanup.listSweepCandidates,
    {}
  );
  const orphans = candidates.filter((id) => !inUse.has(id));
  const deleted: number =
    orphans.length > 0
      ? await ctx.runMutation(internal.storageCleanup.deleteOrphanedFiles, {
          storageIds: orphans,
        })
      : 0;

  console.warn(
    `Orphaned-upload sweep: scanned ${candidates.length.toString()} file(s), deleted ${deleted.toString()}.`
  );
  return { scanned: candidates.length, deleted };
}

/**
 * Internal (ungated) action that runs the sweep once. The gated cron wrapper
 * lives in `cronJobs.ts`; the optional overrides exist for tests.
 */
export const sweepOrphanedUploads = internalAction({
  args: {
    referencePageSize: v.optional(v.number()),
    maxPagesPerTable: v.optional(v.number()),
  },
  returns: v.object({ scanned: v.number(), deleted: v.number() }),
  handler: async (ctx, args) => await runOrphanSweep(ctx, args),
});
