// app/convex/migrations/multiLotAuctions.ts
//
// Step 2/7 of the multi-lot auction rework (issue #318).
//
// Step 1 renamed `auctions` -> `lots`, added a new `auctions` container table,
// and renamed `auctionId` -> `lotId` on every FK table. Convex does NOT
// auto-rename tables or document fields, so when this migration was written the
// deployment still held every row under the OLD table/field names and the new
// `lots` table was empty. This migration therefore performs the table/field
// rename as a data operation *and* creates one `auctions` container per legacy
// per-item auction, as specified in the task.
//
// It is intended to be run once with schema validation temporarily disabled
// (renames cannot be validated mid-flight), and can be deleted afterwards.
//
// Run (dev):
//   bunx convex run migrations/multiLotAuctions:inspect
//   bunx convex run migrations/multiLotAuctions:migrate '{"batchSize":50}'
//   bunx convex run migrations/multiLotAuctions:verify
//
// Re-running `migrate` is safe: legacy auctions are deleted as they are
// converted, and only documents whose `auctionId` still maps to a legacy
// auction are touched.

import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const MS_PER_DAY = 86_400_000;
const DEFAULT_DURATION_DAYS = 7;
const SYSTEM_CREATOR = "system:migration";
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_SCAN_LIMIT = 5_000;

const CLOSED_LOT_STATUSES = new Set(["sold", "unsold", "rejected"]);

const LOT_STATUS_MAP: Record<string, string> = {
  active: "approved", // stored "active" is no longer a lot status; liveness is derived
  draft: "draft",
  pending_review: "pending_review",
  approved: "approved",
  assigned: "assigned",
  sold: "sold",
  unsold: "unsold",
  rejected: "rejected",
};

/** FK tables that referenced the legacy `auctions` table via `auctionId`. */
const FK_TABLES = [
  "bids",
  "proxy_bids",
  "watchlist",
  "reviews",
  "conversations",
  "supportTickets",
] as const;

/**
 * Structural view of a legacy (pre-step-1) `auctions` row — i.e. an
 * individual piece of equipment, which is now a `lots` row.
 */
interface LegacyAuction {
  _id: string;
  _creationTime: number;
  title: string;
  make: string;
  model: string;
  year: number;
  operatingHours: number;
  location: string;
  categoryId?: string;
  reservePrice: number;
  startingPrice: number;
  currentPrice: number;
  minIncrement: number;
  startTime?: number;
  endTime?: number;
  settledAt?: number;
  durationDays?: number;
  sellerId: string;
  status: string;
  images: unknown;
  description?: string;
  conditionReportUrl?: string;
  isExtended?: boolean;
  hiddenByFlags?: boolean;
  seedId?: string;
  conditionChecklist?: unknown;
}

/** A legacy FK row whose `auctionId` still points at the old `auctions` table. */
interface LegacyForeignKeyDoc {
  _id: string;
  auctionId?: string;
  [key: string]: unknown;
}

/**
 * A deliberately untyped view of the mutation database, needed because the
 * migration reads tables (`auctionFees`, `auctionFlags`) and fields
 * (`auctionId`) that the new schema no longer declares. Runtime access is
 * still safe — schema validation is disabled while this runs.
 */
interface RawDatabase {
  query(table: string): {
    take(limit: number): Promise<Record<string, unknown>[]>;
    collect(): Promise<Record<string, unknown>[]>;
  };
  insert(table: string, value: Record<string, unknown>): Promise<string>;
  patch(
    table: string,
    id: string,
    value: Record<string, unknown>
  ): Promise<void>;
  delete(table: string, id: string): Promise<void>;
}

/**
 * Return the mutation database through the permissive migration view.
 *
 * @param ctx - Convex mutation context.
 * @returns The database accessed via raw table/field names.
 */
function rawDb(ctx: MutationCtx): RawDatabase {
  return ctx.db as unknown as RawDatabase;
}

/**
 * Return the query database through the permissive migration view.
 *
 * @param ctx - Convex query context.
 * @returns The database accessed via raw table/field names.
 */
function rawQueryDb(ctx: QueryCtx): RawDatabase {
  return ctx.db as unknown as RawDatabase;
}

/**
 * Whether a raw `auctions` document is a pre-step-1 per-item auction, as
 * opposed to a new scheduled-sale container (which has `createdAt`).
 *
 * @param doc - Raw `auctions` document.
 * @returns True if the document is a legacy per-item auction.
 */
function isLegacyAuction(doc: Record<string, unknown>): boolean {
  return doc.createdAt === undefined && typeof doc.make === "string";
}

/** Result shape returned by the migration batch. */
const migrationResultValidator = v.object({
  done: v.boolean(),
  scanned: v.number(),
  legacyFound: v.number(),
  lotsCreated: v.number(),
  containersCreated: v.number(),
  fkPatched: v.number(),
  feesCopied: v.number(),
  flagsCopied: v.number(),
  remainingLegacy: v.number(),
});

/**
 * Read-only snapshot used to understand the deployment's current shape before
 * running the migration. Returns table counts and the raw field names of a
 * sample row from each table the migration cares about.
 */
export const inspect = internalQuery({
  args: {},
  returns: v.object({
    auctionsTotal: v.number(),
    legacyAuctions: v.number(),
    lotsTotal: v.number(),
    lotsMissingAuctionId: v.number(),
    counts: v.record(v.string(), v.number()),
    sampleKeys: v.record(v.string(), v.array(v.string())),
    legacyStatuses: v.record(v.string(), v.number()),
  }),
  handler: async (ctx) => {
    const db = rawQueryDb(ctx);
    const auctions = await db.query("auctions").take(DEFAULT_SCAN_LIMIT);
    const legacy = auctions.filter(isLegacyAuction);

    const tableNames = [
      "auctions",
      "lots",
      "bids",
      "proxy_bids",
      "watchlist",
      "reviews",
      "conversations",
      "supportTickets",
      "auctionFees",
      "lotFees",
      "auctionFlags",
      "lotFlags",
    ];

    const counts: Record<string, number> = {};
    const sampleKeys: Record<string, string[]> = {};
    for (const name of tableNames) {
      const rows = await db.query(name).take(DEFAULT_SCAN_LIMIT);
      counts[name] = rows.length;
      sampleKeys[name] = rows[0] ? Object.keys(rows[0]).sort() : [];
    }

    const lotsRows = await db.query("lots").take(DEFAULT_SCAN_LIMIT);
    const lotsMissingAuctionId = lotsRows.filter(
      (doc) => doc.auctionId === undefined
    ).length;

    const legacyStatuses: Record<string, number> = {};
    for (const doc of legacy) {
      const status = (doc as unknown as LegacyAuction).status;
      legacyStatuses[status] = (legacyStatuses[status] ?? 0) + 1;
    }

    return {
      auctionsTotal: auctions.length,
      legacyAuctions: legacy.length,
      lotsTotal: lotsRows.length,
      lotsMissingAuctionId,
      counts,
      sampleKeys,
      legacyStatuses,
    };
  },
});

/**
 * Convert up to `batchSize` legacy `auctions` rows into `lots`, create one
 * `auctions` container per lot, and repoint every FK from the old auction id
 * to the new lot id. Deletes each legacy auction as it is converted so the
 * `auctions` table holds only containers once complete.
 *
 * If legacy auctions remain after the batch, schedules the next batch.
 */
export const migrate = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  returns: migrationResultValidator,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
    const db = rawDb(ctx);

    const scanned = await db.query("auctions").take(DEFAULT_SCAN_LIMIT);
    const legacy = scanned.filter(isLegacyAuction);
    const batch = legacy.slice(0, batchSize);

    const auctionToLot = new Map<string, string>();
    let lotsCreated = 0;
    let containersCreated = 0;

    for (const raw of batch) {
      const auction = raw as unknown as LegacyAuction;
      const lotStatus = LOT_STATUS_MAP[auction.status] ?? "approved";
      const createdAt = auction._creationTime;
      const startTime = auction.startTime ?? createdAt;
      const endTime =
        auction.endTime ??
        startTime + (auction.durationDays ?? DEFAULT_DURATION_DAYS) * MS_PER_DAY;

      const containerId = await db.insert("auctions", {
        title: auction.title,
        startTime,
        endTime,
        status: CLOSED_LOT_STATUSES.has(lotStatus) ? "closed" : "published",
        // No real admin created these legacy per-item containers, so a
        // placeholder system identifier is used rather than the seller.
        createdBy: SYSTEM_CREATOR,
        createdAt,
        updatedAt: createdAt,
      });
      containersCreated += 1;

      const lotDoc: Record<string, unknown> = {
        title: auction.title,
        make: auction.make,
        model: auction.model,
        year: auction.year,
        operatingHours: auction.operatingHours,
        location: auction.location,
        reservePrice: auction.reservePrice,
        startingPrice: auction.startingPrice,
        currentPrice: auction.currentPrice,
        minIncrement: auction.minIncrement,
        sellerId: auction.sellerId,
        status: lotStatus,
        images: auction.images ?? [],
        auctionId: containerId,
      };
      if (auction.categoryId !== undefined)
        lotDoc.categoryId = auction.categoryId;
      if (auction.description !== undefined)
        lotDoc.description = auction.description;
      if (auction.settledAt !== undefined) lotDoc.settledAt = auction.settledAt;
      if (auction.durationDays !== undefined)
        lotDoc.durationDays = auction.durationDays;
      if (auction.isExtended !== undefined)
        lotDoc.isExtended = auction.isExtended;
      if (auction.hiddenByFlags !== undefined)
        lotDoc.hiddenByFlags = auction.hiddenByFlags;
      if (auction.seedId !== undefined) lotDoc.seedId = auction.seedId;
      if (auction.conditionReportUrl !== undefined)
        lotDoc.conditionReportUrl = auction.conditionReportUrl;
      if (auction.conditionChecklist !== undefined)
        lotDoc.conditionChecklist = auction.conditionChecklist;
      // Legacy start/end are intentionally retained until a later cleanup task.
      if (auction.startTime !== undefined) lotDoc.startTime = auction.startTime;
      if (auction.endTime !== undefined) lotDoc.endTime = auction.endTime;

      const lotId = await db.insert("lots", lotDoc);
      lotsCreated += 1;
      auctionToLot.set(auction._id, lotId);

      await db.delete("auctions", auction._id);
    }

    let fkPatched = 0;
    if (auctionToLot.size > 0) {
      fkPatched = await remapForeignKeys(ctx, auctionToLot);
    }

    let feesCopied = 0;
    let flagsCopied = 0;
    if (auctionToLot.size > 0) {
      feesCopied = await copyLedgerTable(
        ctx,
        "auctionFees",
        "lotFees",
        auctionToLot
      );
      flagsCopied = await copyLedgerTable(
        ctx,
        "auctionFlags",
        "lotFlags",
        auctionToLot
      );
    }

    const remainingLegacy = legacy.length - batch.length;
    const done = remainingLegacy <= 0;

    if (!done) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.multiLotAuctions.migrate,
        { batchSize }
      );
    }

    return {
      done,
      scanned: scanned.length,
      legacyFound: legacy.length,
      lotsCreated,
      containersCreated,
      fkPatched,
      feesCopied,
      flagsCopied,
      remainingLegacy,
    };
  },
});

/**
 * Repoint every FK row whose `auctionId` matches a converted legacy auction to
 * the new `lotId`. Orphaned references (no matching legacy auction) are left
 * untouched and reported by `verify`.
 *
 * @param ctx - Convex mutation context.
 * @param auctionToLot - Map of legacy auction id -> new lot id.
 * @returns Number of documents patched.
 */
async function remapForeignKeys(
  ctx: MutationCtx,
  auctionToLot: Map<string, string>
): Promise<number> {
  const db = rawDb(ctx);
  let patched = 0;

  for (const table of FK_TABLES) {
    const rows = (await db
      .query(table)
      .take(DEFAULT_SCAN_LIMIT)) as LegacyForeignKeyDoc[];
    for (const row of rows) {
      const oldId = row.auctionId;
      if (oldId === undefined) continue;
      const lotId = auctionToLot.get(oldId);
      if (lotId === undefined) continue;
      await db.patch(table, row._id, { lotId, auctionId: undefined });
      patched += 1;
    }
  }

  return patched;
}

/**
 * Copy a legacy ledger table (e.g. `auctionFees`) into its renamed successor
 * (e.g. `lotFees`), repointing `auctionId` to `lotId` and deleting the source
 * row. Rows without a matching legacy auction are left in place for `verify`.
 *
 * @param ctx - Convex mutation context.
 * @param fromTable - Legacy table name.
 * @param toTable - Renamed table name.
 * @param auctionToLot - Map of legacy auction id -> new lot id.
 * @returns Number of rows copied.
 */
async function copyLedgerTable(
  ctx: MutationCtx,
  fromTable: string,
  toTable: string,
  auctionToLot: Map<string, string>
): Promise<number> {
  const db = rawDb(ctx);
  const rows = (await db
    .query(fromTable)
    .take(DEFAULT_SCAN_LIMIT)) as LegacyForeignKeyDoc[];
  let copied = 0;

  for (const row of rows) {
    const oldId = row.auctionId;
    if (oldId === undefined) continue;
    const lotId = auctionToLot.get(oldId);
    if (lotId === undefined) continue;

    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === "_id" || key === "_creationTime" || key === "auctionId")
        continue;
      rest[key] = value;
    }
    await db.insert(toTable, { ...rest, lotId });
    await db.delete(fromTable, row._id);
    copied += 1;
  }

  return copied;
}

/**
 * Verify referential integrity after the migration: every `lots` row points at
 * a real `auctions` container, and every FK `lotId` resolves to a real `lots`
 * row. Also reports leftover un-renamed `auctionId` fields and any orphaned
 * legacy ids.
 */
export const verify = internalQuery({
  args: {},
  returns: v.object({
    lotsTotal: v.number(),
    lotsMissingAuctionId: v.number(),
    lotsWithDanglingAuctionId: v.number(),
    legacyAuctionsRemaining: v.number(),
    fkTableCounts: v.record(v.string(), v.number()),
    fkWithLotId: v.record(v.string(), v.number()),
    fkWithOldAuctionId: v.record(v.string(), v.number()),
    fkDanglingLotId: v.record(v.string(), v.number()),
    ledgerTablesWithOldFields: v.record(v.string(), v.number()),
  }),
  handler: async (ctx) => {
    const db = rawQueryDb(ctx);

    const lotRows = await db.query("lots").take(DEFAULT_SCAN_LIMIT);
    const containerRows = await db.query("auctions").take(DEFAULT_SCAN_LIMIT);
    const containerIds = new Set(containerRows.map((doc) => String(doc._id)));
    const lotIds = new Set(lotRows.map((doc) => String(doc._id)));

    let lotsMissingAuctionId = 0;
    let lotsWithDanglingAuctionId = 0;
    for (const lot of lotRows) {
      const auctionId = lot.auctionId;
      if (auctionId === undefined || auctionId === null) {
        lotsMissingAuctionId += 1;
      } else if (!containerIds.has(auctionId as string)) {
        lotsWithDanglingAuctionId += 1;
      }
    }

    const legacyAuctionsRemaining = containerRows.filter(
      (doc) => doc.createdAt === undefined
    ).length;

    const fkTableCounts: Record<string, number> = {};
    const fkWithLotId: Record<string, number> = {};
    const fkWithOldAuctionId: Record<string, number> = {};
    const fkDanglingLotId: Record<string, number> = {};

    for (const table of FK_TABLES) {
      const rows = await db.query(table).take(DEFAULT_SCAN_LIMIT);
      fkTableCounts[table] = rows.length;
      fkWithLotId[table] = rows.filter(
        (doc) => doc.lotId !== undefined
      ).length;
      fkWithOldAuctionId[table] = rows.filter(
        (doc) => doc.auctionId !== undefined
      ).length;
      fkDanglingLotId[table] = rows.filter((doc) => {
        const lotId = doc.lotId;
        return lotId !== undefined && !lotIds.has(lotId as string);
      }).length;
    }

    const ledgerTablesWithOldFields: Record<string, number> = {};
    for (const table of ["auctionFees", "auctionFlags"]) {
      const rows = await db.query(table).take(DEFAULT_SCAN_LIMIT);
      ledgerTablesWithOldFields[table] = rows.length;
    }

    return {
      lotsTotal: lotRows.length,
      lotsMissingAuctionId,
      lotsWithDanglingAuctionId,
      legacyAuctionsRemaining,
      fkTableCounts,
      fkWithLotId,
      fkWithOldAuctionId,
      fkDanglingLotId,
      ledgerTablesWithOldFields,
    };
  },
});
