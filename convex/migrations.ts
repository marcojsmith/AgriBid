import { v } from "convex/values";

import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { countQuery, getCounter, updateCounter } from "./admin_utils";
import {
  auctionLotCounterName,
  bidCounterName,
  issueNextLotNumber,
  lotNumberCounterName,
  recountAuctionLots,
  watcherCounterName,
} from "./lib/lotCounters";
import { encryptBytes } from "./lib/documentCrypto";
import { assignSellerSlug } from "./lib/sellerSlugs";
import { sniffDocumentType } from "./lib/documentSniff";
import { extractImageStorageIds } from "./lib/storage";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";

/** Lots examined per `backfillLotNumbers` batch. */
export const LOT_NUMBER_BACKFILL_BATCH = 100;
/** Lots examined per `backfillWatcherCounts` batch (each does an index count). */
export const WATCHER_BACKFILL_BATCH = 25;

/** Profiles examined per `backfillSellerSlugs` batch (each may read lots and slugs). */
export const SELLER_SLUG_BACKFILL_BATCH = 25;

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

/** Sales recounted per `backfillAuctionLotCounts` batch (each reads all its lots). */
export const AUCTION_LOT_COUNT_BACKFILL_BATCH = 1;

/**
 * One batch of the per-sale visible-lot-count rebuild.
 *
 * Walks the `auctions` table and, for each sale, recounts its buyer-visible lots
 * (status assigned/sold/unsold, not hidden by flags) through
 * `by_status_auctionId` and writes the absolute value to its `lots:<auctionId>`
 * counter. One sale per mutation keeps the reads bounded by that sale's lots.
 * Absolute writes make it idempotent and safe to re-run. Reschedules itself
 * until the table is exhausted.
 *
 * @param ctx - Mutation context.
 * @param args - Batch arguments.
 * @param args.cursor - Pagination cursor, `null` for the first batch.
 * @returns Counts for this batch and whether the migration finished.
 */
export async function backfillAuctionLotCountsHandler(
  ctx: MutationCtx,
  args: { cursor: string | null }
): Promise<BatchResult> {
  const page = await ctx.db.query("auctions").paginate({
    numItems: AUCTION_LOT_COUNT_BACKFILL_BATCH,
    cursor: args.cursor,
  });

  let updated = 0;
  for (const auction of page.page) {
    const before = await getCounter(ctx, auctionLotCounterName(auction._id));
    const count = await recountAuctionLots(ctx, auction._id);
    if (before?.total !== count) updated++;
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.migrations.backfillAuctionLotCounts,
      { cursor: page.continueCursor }
    );
  }

  return {
    processed: page.page.length,
    updated,
    isDone: page.isDone,
    continueCursor: page.isDone ? null : page.continueCursor,
  };
}

/**
 * Rebuild every sale's visible-lot counter from `lots`.
 * Run with `bunx convex run migrations:backfillAuctionLotCounts` after
 * `bunx convex deploy`. Idempotent. Until a sale is reached, its lot count
 * falls back to the capped read.
 */
export const backfillAuctionLotCounts = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    processed: v.number(),
    updated: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) =>
    backfillAuctionLotCountsHandler(ctx, { cursor: args.cursor ?? null }),
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

/**
 * One batch of the seller slug backfill.
 *
 * Walks `profiles`; every profile with no slug that owns at least one lot gets a
 * public name and slug (`assignSellerSlug`, which handles clashes with `-2`,
 * `-3`). Profiles that already have a slug, and users who never listed, are
 * left alone, so re-running is safe. Reschedules itself until the table is
 * exhausted.
 *
 * @param ctx - Mutation context.
 * @param args - Batch arguments.
 * @param args.cursor - Pagination cursor, `null` for the first batch.
 * @returns Counts for this batch and whether the migration finished.
 */
export async function backfillSellerSlugsHandler(
  ctx: MutationCtx,
  args: { cursor: string | null }
): Promise<BatchResult> {
  const page = await ctx.db
    .query("profiles")
    .paginate({ numItems: SELLER_SLUG_BACKFILL_BATCH, cursor: args.cursor });

  let updated = 0;
  for (const profile of page.page) {
    if (profile.slug !== undefined) continue;
    const lot = await ctx.db
      .query("lots")
      .withIndex("by_seller", (q) => q.eq("sellerId", profile.userId))
      .first();
    if (!lot) continue;
    if ((await assignSellerSlug(ctx, profile)) !== null) updated++;
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(0, internal.migrations.backfillSellerSlugs, {
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
 * Give every seller with a lot a public name and slug.
 * Run with `bunx convex run migrations:backfillSellerSlugs`. Idempotent.
 */
export const backfillSellerSlugs = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    processed: v.number(),
    updated: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) =>
    backfillSellerSlugsHandler(ctx, { cursor: args.cursor ?? null }),
});

// ---------------------------------------------------------------------------
// R1b: encrypt personal documents that were stored in plain text
// ---------------------------------------------------------------------------

/** Profiles / document rows examined per `encryptLegacyKycDocuments` batch. */
export const DOCUMENT_ENCRYPT_BATCH = 5;

const documentPhaseValidator = v.union(
  v.literal("kyc"),
  v.literal("registration")
);

/**
 * One page of profiles that still hold plain legacy KYC files.
 * Profiles already marked encrypted, or without files, are left out.
 */
export const listLegacyKycBatch = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    items: v.array(
      v.object({
        profileId: v.id("profiles"),
        storageIds: v.array(v.id("_storage")),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("profiles")
      .paginate({ numItems: DOCUMENT_ENCRYPT_BATCH, cursor: args.cursor });
    const items = page.page.flatMap((profile) =>
      (profile.kycDocuments ?? []).length > 0 &&
      profile.kycDocumentsEncrypted !== true
        ? [{ profileId: profile._id, storageIds: profile.kycDocuments ?? [] }]
        : []
    );
    return {
      items,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

/**
 * One page of registration document rows that are not yet encrypted
 * (created by R1/R3 before encryption existed).
 */
export const listPlainRegistrationDocuments = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    items: v.array(
      v.object({
        documentId: v.id("registrationDocuments"),
        storageId: v.id("_storage"),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("registrationDocuments")
      .paginate({ numItems: DOCUMENT_ENCRYPT_BATCH, cursor: args.cursor });
    const items = page.page
      .filter((row) => row.encrypted !== true)
      .map((row) => ({ documentId: row._id, storageId: row.storageId }));
    return {
      items,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

/**
 * Swaps a profile's plain legacy files for their encrypted copies and marks
 * it encrypted. Refuses (returns false) when the profile's list changed since
 * it was read, so a concurrent edit is never overwritten.
 */
export const commitEncryptedKycDocuments = internalMutation({
  args: {
    profileId: v.id("profiles"),
    oldIds: v.array(v.id("_storage")),
    newIds: v.array(v.id("_storage")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("profiles", args.profileId);
    const current = profile?.kycDocuments ?? [];
    const unchanged =
      current.length === args.oldIds.length &&
      current.every((id, i) => id === args.oldIds[i]);
    if (!profile || profile.kycDocumentsEncrypted === true || !unchanged) {
      return false;
    }
    await ctx.db.patch("profiles", args.profileId, {
      kycDocuments: args.newIds,
      kycDocumentsEncrypted: true,
    });
    // Queue the plain originals in the same transaction as the swap, so a
    // crash after this point can never leave one that nothing will delete.
    for (const storageId of new Set(args.oldIds)) {
      await ctx.db.insert("pendingPlainDeletes", {
        storageId,
        source: "kyc",
        createdAt: Date.now(),
      });
    }
    return true;
  },
});

/**
 * Points a registration document at its encrypted copy and records the real
 * content type. Refuses when the row already moved on (replaced or encrypted).
 */
export const commitEncryptedRegistrationDocument = internalMutation({
  args: {
    documentId: v.id("registrationDocuments"),
    oldStorageId: v.id("_storage"),
    newStorageId: v.id("_storage"),
    contentType: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("registrationDocuments", args.documentId);
    if (!row || row.encrypted === true || row.storageId !== args.oldStorageId) {
      return false;
    }
    await ctx.db.patch("registrationDocuments", args.documentId, {
      storageId: args.newStorageId,
      contentType: args.contentType,
      encrypted: true,
    });
    await ctx.db.insert("pendingPlainDeletes", {
      storageId: args.oldStorageId,
      source: "registration",
      createdAt: Date.now(),
    });
    return true;
  },
});

/** Most rows read per table when checking whether a file is still in use. */
export const REFERENCE_SCAN_CAP = 2000;

/** Queue entries handled per run. */
export const PENDING_DELETE_BATCH = 50;

/** How a stored file is still used: by another row, by none, or not known. */
const referenceStateValidator = v.union(
  v.literal("referenced"),
  v.literal("free"),
  v.literal("unknown")
);

/**
 * Whether any row still points at a stored file (a registration document, a
 * profile's KYC list, a lot or a sale). The old `submitKYC` accepted any
 * storage id, so a "KYC file" can really be someone else's document or a
 * public image; the migration must not delete it.
 *
 * Registration documents use the `by_storageId` index. The other tables have
 * no index on file ids, so each is read up to `REFERENCE_SCAN_CAP` rows; a
 * table that fills the cap without a match gives "unknown", and the caller
 * keeps the file rather than risk deleting one that is in use.
 */
export const isStorageReferencedElsewhere = internalQuery({
  args: { storageId: v.id("_storage") },
  returns: referenceStateValidator,
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("registrationDocuments")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .first();
    if (doc) return "referenced";

    const profiles = await ctx.db.query("profiles").take(REFERENCE_SCAN_CAP);
    if (profiles.some((p) => (p.kycDocuments ?? []).includes(args.storageId))) {
      return "referenced";
    }
    const lots = await ctx.db.query("lots").take(REFERENCE_SCAN_CAP);
    if (
      lots.some(
        (lot) =>
          extractImageStorageIds(lot.images).includes(args.storageId) ||
          lot.conditionReportUrl === args.storageId ||
          lot.coldStartVideo === args.storageId
      )
    ) {
      return "referenced";
    }
    const auctions = await ctx.db.query("auctions").take(REFERENCE_SCAN_CAP);
    if (auctions.some((a) => a.bannerImage === args.storageId)) {
      return "referenced";
    }
    const capped = [profiles, lots, auctions].some(
      (rows) => rows.length >= REFERENCE_SCAN_CAP
    );
    return capped ? "unknown" : "free";
  },
});

/** Oldest queued plain-file deletions, for `processPendingPlainDeletes`. */
export const listPendingPlainDeletes = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("pendingPlainDeletes"),
      storageId: v.id("_storage"),
    })
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("pendingPlainDeletes")
      .withIndex("by_createdAt")
      .take(PENDING_DELETE_BATCH);
    return rows.map((row) => ({ _id: row._id, storageId: row.storageId }));
  },
});

/** Removes a handled entry from the plain-file deletion queue. */
export const removePendingPlainDelete = internalMutation({
  args: { id: v.id("pendingPlainDeletes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete("pendingPlainDeletes", args.id);
    return null;
  },
});

/** One queued plain-file deletion. */
interface PendingDelete {
  _id: Id<"pendingPlainDeletes">;
  storageId: Id<"_storage">;
}

/** The parts of an action context that `processPendingPlainDeletes` uses. */
export interface PendingDeleteCtx {
  listPending: () => Promise<PendingDelete[]>;
  checkReference: (
    storageId: Id<"_storage">
  ) => Promise<"referenced" | "free" | "unknown">;
  removeEntry: (id: Id<"pendingPlainDeletes">) => Promise<void>;
  storage: {
    get: (id: Id<"_storage">) => Promise<Blob | null>;
    delete: (id: Id<"_storage">) => Promise<void>;
  };
}

/**
 * Deletes the plain files queued by the migration. For each entry: a file
 * still used elsewhere is kept (entry dropped; the other owner's own
 * migration queues it again); a file whose use cannot be confirmed is kept
 * and retried next run; a missing file just clears the entry. Any failure
 * leaves the entry for the next run and never stops the rest of the batch.
 *
 * @param ctx - Queue listing, reference check, queue removal and storage access
 * @returns How many plain files were deleted
 */
export async function processPendingPlainDeletes(
  ctx: PendingDeleteCtx
): Promise<number> {
  const entries = await ctx.listPending();
  let deleted = 0;
  for (const entry of entries) {
    try {
      const state = await ctx.checkReference(entry.storageId);
      if (state === "unknown") {
        console.warn(
          `Kept plain file ${entry.storageId}: could not confirm it is unused`
        );
        continue;
      }
      if (state === "referenced") {
        console.warn(
          `Kept plain file ${entry.storageId}: referenced elsewhere`
        );
        await ctx.removeEntry(entry._id);
        continue;
      }
      if ((await ctx.storage.get(entry.storageId)) !== null) {
        await ctx.storage.delete(entry.storageId);
        deleted++;
      }
      await ctx.removeEntry(entry._id);
    } catch (err) {
      console.warn(`Could not delete plain file ${entry.storageId}`, err);
    }
  }
  return deleted;
}

/**
 * Binds an action context to the queue helpers.
 *
 * @param ctx - The migration action's context
 * @returns The context `processPendingPlainDeletes` needs
 */
function pendingDeleteCtx(ctx: ActionCtx): PendingDeleteCtx {
  return {
    listPending: () =>
      ctx.runQuery(internal.migrations.listPendingPlainDeletes, {}),
    checkReference: async (storageId) => {
      try {
        return await ctx.runQuery(
          internal.migrations.isStorageReferencedElsewhere,
          { storageId }
        );
      } catch {
        // A scan too large for one query counts as "cannot confirm".
        return "unknown";
      }
    },
    removeEntry: async (id) => {
      await ctx.runMutation(internal.migrations.removePendingPlainDelete, {
        id,
      });
    },
    storage: ctx.storage,
  };
}

/**
 * Reads a plain stored file, encrypts it and stores the ciphertext.
 *
 * @param ctx - Action context (storage access)
 * @param ctx.storage - File storage
 * @param ctx.storage.get - Reads a stored file
 * @param ctx.storage.store - Stores a new file
 * @param storageId - The plain file
 * @returns The new storage id and the sniffed type, or null when the file is gone
 */
async function sealStoredFile(
  ctx: {
    storage: {
      get: (id: Id<"_storage">) => Promise<Blob | null>;
      store: (blob: Blob) => Promise<Id<"_storage">>;
    };
  },
  storageId: Id<"_storage">
): Promise<{ newId: Id<"_storage">; contentType: string } | null> {
  const blob = await ctx.storage.get(storageId);
  if (blob === null) return null;
  const plain = await blob.arrayBuffer();
  const contentType =
    sniffDocumentType(new Uint8Array(plain)) ?? "application/octet-stream";
  const newId = await ctx.storage.store(
    new Blob([await encryptBytes(plain)], { type: "application/octet-stream" })
  );
  return { newId, contentType };
}

/**
 * Encrypts every personal document stored in plain text: first the legacy
 * `profiles.kycDocuments` files, then `registrationDocuments` rows without
 * `encrypted: true`. Run with `bunx convex run migrations:encryptLegacyKycDocuments`
 * after setting `DOCUMENT_ENCRYPTION_KEY`.
 *
 * Batched: each call handles one page, then schedules itself for the next, so
 * it resumes from the profile (or row) cursor. Idempotent: encrypted
 * profiles/rows are skipped, the id swap commits before the plain file is
 * deleted, and a swap that lost a race removes its own new copy.
 */
export const encryptLegacyKycDocuments = internalAction({
  args: {
    phase: v.optional(documentPhaseValidator),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    phase: documentPhaseValidator,
    processed: v.number(),
    encrypted: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const phase = args.phase ?? "kyc";
    const cursor = args.cursor ?? null;
    let processed = 0;
    let encrypted = 0;
    let isDone = false;
    let next: { phase: "kyc" | "registration"; cursor: string | null } | null =
      null;

    // Finish any deletions a previous run left queued before doing more.
    const pending = pendingDeleteCtx(ctx);
    await processPendingPlainDeletes(pending);

    if (phase === "kyc") {
      const page = await ctx.runQuery(internal.migrations.listLegacyKycBatch, {
        cursor,
      });
      for (const item of page.items) {
        processed++;
        const sealed: {
          oldId: Id<"_storage">;
          newId: Id<"_storage">;
        }[] = [];
        // A file already gone from storage is dropped from the list.
        for (const oldId of item.storageIds) {
          const result = await sealStoredFile(ctx, oldId);
          if (result) sealed.push({ oldId, newId: result.newId });
        }
        const committed = await ctx.runMutation(
          internal.migrations.commitEncryptedKycDocuments,
          {
            profileId: item.profileId,
            oldIds: item.storageIds,
            newIds: sealed.map((entry) => entry.newId),
          }
        );
        if (committed) {
          encrypted++;
        } else {
          for (const entry of sealed) await ctx.storage.delete(entry.newId);
        }
      }
      next = page.isDone
        ? { phase: "registration", cursor: null }
        : { phase: "kyc", cursor: page.continueCursor };
    } else {
      const page = await ctx.runQuery(
        internal.migrations.listPlainRegistrationDocuments,
        { cursor }
      );
      for (const item of page.items) {
        processed++;
        const result = await sealStoredFile(ctx, item.storageId);
        if (result === null) continue;
        const committed = await ctx.runMutation(
          internal.migrations.commitEncryptedRegistrationDocument,
          {
            documentId: item.documentId,
            oldStorageId: item.storageId,
            newStorageId: result.newId,
            contentType: result.contentType,
          }
        );
        if (committed) {
          encrypted++;
        } else {
          await ctx.storage.delete(result.newId);
        }
      }
      if (page.isDone) isDone = true;
      else next = { phase: "registration", cursor: page.continueCursor };
    }

    await processPendingPlainDeletes(pending);
    if (next) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.encryptLegacyKycDocuments,
        next
      );
    }
    return { phase, processed, encrypted, isDone };
  },
});
