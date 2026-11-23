/**
 * Imports the webuytractors.shop catalogue into a Convex deployment for the
 * demo. Run with bun:
 *
 *   bun scripts/import-wbt.ts <path-to-wbt-data.json>
 *   bun scripts/import-wbt.ts <path> --retire-old-demo          (dry run)
 *   bun scripts/import-wbt.ts <path> --retire-old-demo --apply  (deletes)
 *
 * Environment (never printed):
 *   CONVEX_URL        deployment URL (falls back to VITE_CONVEX_URL)
 *   CONVEX_ADMIN_KEY  that deployment's admin key
 *
 * It calls only `internal` functions in `convex/wbtImport.ts`, which are
 * reachable with the admin key and nothing else. It is idempotent: sales and
 * lots are keyed on `seedId`, and photos are only downloaded and uploaded for
 * lots that do not already have them. See docs/runbooks/import-wbt.md.
 */
import { readFile } from "node:fs/promises";

import sharp from "sharp";

import {
  MAX_PHOTOS_PER_LOT,
  assignLotNumbers,
  buildLotInput,
  isEquipmentLot,
  lotSeedId,
  selectSales,
  usablePhotos,
  type LotInput,
  type RawData,
  type SelectedSale,
} from "../convex/lib/wbtImport.ts";

/** The longest edge of a stored photo (px). */
const MAX_EDGE_PX = 1600;

/** Lots per `upsertLots` call (the backend caps it at 20). */
const LOTS_PER_CALL = 20;

/** Photos downloaded and uploaded in parallel. */
const PHOTO_CONCURRENCY = 6;

/** Counts reported at the end. */
interface Stats {
  sales: number;
  lotsCreated: number;
  lotsUpdated: number;
  lotsSkippedNoPhoto: number;
  filteredOut: number;
  photosUploaded: number;
  photosFailed: number;
  lotsWithExistingPhotos: number;
}

/** Calls an internal Convex function over HTTP with the admin key. */
class ConvexAdmin {
  private readonly url: string;
  private readonly adminKey: string;

  /**
   * Creates the client.
   *
   * @param url - The deployment URL
   * @param adminKey - The deployment's admin key (never logged)
   */
  constructor(url: string, adminKey: string) {
    this.url = url;
    this.adminKey = adminKey;
  }

  /**
   * Calls a function and returns its value.
   *
   * @param kind - "query" or "mutation"
   * @param path - `file:function`
   * @param args - JSON arguments
   * @returns The function's return value
   */
  async call<T>(
    kind: "query" | "mutation",
    path: string,
    args: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${this.url}/api/${kind}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Convex ${this.adminKey}`,
      },
      body: JSON.stringify({ path, args, format: "json" }),
    });
    const body = (await response.json()) as {
      status: string;
      value?: T;
      errorMessage?: string;
    };
    if (body.status !== "success") {
      throw new Error(
        `${path} failed: ${body.errorMessage ?? response.statusText}`
      );
    }
    return body.value as T;
  }

  /**
   * Uploads image bytes through a one-time upload URL.
   *
   * @param bytes - JPEG bytes
   * @returns The Convex storage id
   */
  async uploadJpeg(bytes: Uint8Array): Promise<string> {
    const uploadUrl = await this.call<string>(
      "mutation",
      "wbtImport:generateUploadUrl",
      {}
    );
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: bytes,
    });
    if (!response.ok)
      throw new Error(`upload failed: ${response.status.toString()}`);
    const body = (await response.json()) as { storageId: string };
    return body.storageId;
  }
}

/**
 * Downloads a photo and resizes it to at most {@link MAX_EDGE_PX} px as JPEG.
 *
 * @param url - The photo URL
 * @returns The JPEG bytes
 */
async function fetchResized(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`download failed: ${response.status.toString()}`);
  const input = Buffer.from(await response.arrayBuffer());
  return await sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_EDGE_PX,
      height: MAX_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

/**
 * Runs `task` over `items` with at most `limit` in flight.
 *
 * @param items - Work items
 * @param limit - Concurrency
 * @param task - The async task
 * @returns Results in item order
 */
async function pool<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await task(items[index], index);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

/**
 * Reads a required environment variable.
 *
 * @param names - Names to try, in order
 * @returns The value
 */
function requireEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Set ${names[0]} (never commit it)`);
}

/**
 * Imports one sale: upserts it, uploads missing photos, upserts its lots.
 *
 * @param admin - The admin client
 * @param sale - The selected sale
 * @param existing - seedId -> stored photo count
 * @param stats - Counters to update
 */
async function importSale(
  admin: ConvexAdmin,
  sale: SelectedSale,
  existing: Map<string, number>,
  stats: Stats
): Promise<void> {
  const raws = sale.lots.filter(isEquipmentLot);
  stats.filteredOut += sale.lots.length - raws.length;
  const auctionId = await admin.call<string>(
    "mutation",
    "wbtImport:upsertSale",
    {
      seedId: sale.seedId,
      role: sale.role,
      closedOrder: sale.closedOrder,
      title: sale.title,
      description: sale.description,
    }
  );
  stats.sales++;
  const numbers = assignLotNumbers(raws);

  const inputs = await pool(raws, PHOTO_CONCURRENCY, async (raw, index) => {
    const seedId = lotSeedId(raw, sale.seedId);
    const urls = usablePhotos(raw).slice(0, MAX_PHOTOS_PER_LOT);
    const wanted = urls.length;
    const stored = existing.get(seedId) ?? 0;
    let photos: string[] = [];
    if (stored >= wanted && stored > 0) {
      stats.lotsWithExistingPhotos++;
    } else {
      for (const url of urls) {
        try {
          photos.push(await admin.uploadJpeg(await fetchResized(url)));
          stats.photosUploaded++;
        } catch (error) {
          stats.photosFailed++;
          console.warn(
            `  photo skipped (${raw.title}): ${(error as Error).message}`
          );
        }
      }
      if (photos.length === 0 && stored === 0) {
        stats.lotsSkippedNoPhoto++;
        photos = [];
        return null;
      }
    }
    return buildLotInput(raw, sale, index, raws.length, numbers[index], photos);
  });

  const ready = inputs.filter((input): input is LotInput => input !== null);
  for (let i = 0; i < ready.length; i += LOTS_PER_CALL) {
    const result = await admin.call<{ created: number; updated: number }>(
      "mutation",
      "wbtImport:upsertLots",
      { auctionId, lots: ready.slice(i, i + LOTS_PER_CALL) }
    );
    stats.lotsCreated += result.created;
    stats.lotsUpdated += result.updated;
  }
  console.log(
    `${sale.role} sale "${sale.title}": ${ready.length.toString()} lots`
  );
}

/** Entry point. */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const path = args.find((arg) => !arg.startsWith("--"));
  const retire = args.includes("--retire-old-demo");
  const apply = args.includes("--apply");
  const url = requireEnv("CONVEX_URL", "VITE_CONVEX_URL");
  const admin = new ConvexAdmin(url, requireEnv("CONVEX_ADMIN_KEY"));

  if (retire) {
    const report = await admin.call<{
      applied: boolean;
      rows: { kind: string; id: string; title: string; seedId?: string }[];
    }>("mutation", "wbtImport:retireOldDemo", { apply });
    for (const row of report.rows) {
      console.log(
        `${report.applied ? "deleted" : "would delete"} ${row.kind}: ${row.title}${row.seedId ? ` [${row.seedId}]` : ""}`
      );
    }
    console.log(
      report.applied
        ? `Deleted ${report.rows.length.toString()} rows.`
        : `Dry run: ${report.rows.length.toString()} rows. Re-run with --apply to delete.`
    );
    return;
  }

  if (!path)
    throw new Error("Usage: bun scripts/import-wbt.ts <wbt-data.json>");
  const data = JSON.parse(await readFile(path, "utf8")) as RawData;
  const sales = selectSales(data);
  const stats: Stats = {
    sales: 0,
    lotsCreated: 0,
    lotsUpdated: 0,
    lotsSkippedNoPhoto: 0,
    filteredOut: 0,
    photosUploaded: 0,
    photosFailed: 0,
    lotsWithExistingPhotos: 0,
  };

  await admin.call<string>("mutation", "wbtImport:ensureSeller", {});
  const rows = await admin.call<{ seedId: string; photoCount: number }[]>(
    "query",
    "wbtImport:listImportedLots",
    {}
  );
  const existing = new Map(rows.map((row) => [row.seedId, row.photoCount]));

  for (const sale of sales) {
    await importSale(admin, sale, existing, stats);
  }
  await admin.call<null>("mutation", "wbtImport:finalizeImport", {});
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
