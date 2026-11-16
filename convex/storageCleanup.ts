import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
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

/** Max rows re-read per table by the delete mutation's freshness re-check. */
const RECHECK_ROW_CAP = 500;

/**
 * Extracts every storage ID referenced by a reference-table row.
 *
 * @param table - Which reference table the row came from.
 * @param row - The row (shape depends on `table`).
 * @returns Referenced storage IDs.
 */
function idsFromRow(
  table: (typeof REFERENCE_TABLES)[number],
  row: Doc<"lots"> | Doc<"profiles"> | Doc<"auctions">
): string[] {
  if (table === "lots") {
    const lot = row as Doc<"lots">;
    const ids = extractImageStorageIds(lot.images);
    if (lot.conditionReportUrl) ids.push(lot.conditionReportUrl);
    return ids;
  }
  if (table === "profiles") {
    return [...((row as Doc<"profiles">).kycDocuments ?? [])];
  }
  const banner = (row as Doc<"auctions">).bannerImage;
  return banner ? [banner] : [];
}

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
    const table = args.table;
    const page = await ctx.db.query(table).paginate(paginationOpts);
    const ids: string[] = [];
    for (const row of page.page) ids.push(...idsFromRow(table, row));
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
 * at deletion time.
 *
 * Race guard: the caller proved the candidates unreferenced as of the scan,
 * which spans many transactions. Here, in ONE transaction, every row of the
 * three reference tables created at or after `scanStartedAt` is re-read and
 * any candidate it references is spared. If more than
 * {@link RECHECK_ROW_CAP} such rows exist in any table the re-check cannot
 * finish, so nothing is deleted.
 *
 * @returns The number of files deleted.
 */
export const deleteOrphanedFiles = internalMutation({
  args: {
    storageIds: v.array(v.id("_storage")),
    scanStartedAt: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const fresh = new Set<string>();
    for (const table of REFERENCE_TABLES) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_creation_time", (q) =>
          q.gte("_creationTime", args.scanStartedAt)
        )
        .take(RECHECK_ROW_CAP + 1);
      if (rows.length > RECHECK_ROW_CAP) return 0;
      for (const row of rows) {
        for (const id of idsFromRow(table, row)) fresh.add(id);
      }
    }

    const cutoff = Date.now() - STORAGE_SWEEP_MIN_AGE_MS;
    let deleted = 0;
    for (const storageId of args.storageIds) {
      if (fresh.has(storageId)) continue;
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
 * Races: the scan spans many transactions (possibly minutes). Rows CREATED
 * after the scan began are re-checked inside the delete transaction
 * (`scanStartedAt`), which closes the insert race. Remaining (accepted)
 * window: an EXISTING row EDITED mid-scan to reference an >1 day old,
 * previously unreferenced file, after its table's scan pass and before the
 * delete. Fresh uploads are covered by the age cutoff; attaching a day-old
 * upload within a sweep's few minutes is rare, and these tables have no
 * `updatedAt` index to close it cheaply.
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
  if (!Number.isInteger(numItems) || numItems < 1) {
    throw new Error("Orphan sweep: referencePageSize must be an integer >= 1.");
  }
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error("Orphan sweep: maxPagesPerTable must be an integer >= 1.");
  }
  const scanStartedAt = Date.now();
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
          scanStartedAt,
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
