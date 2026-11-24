import { ConvexHttpClient } from "convex/browser";

import { api } from "../../convex/_generated/api.js";
import type { Id } from "../../convex/_generated/dataModel.js";
import type {
  HomeShareData,
  LotShareData,
  SaleShareData,
} from "./shareMeta.js";

/** Milliseconds one Convex call may take before the page falls back. */
export const CONVEX_TIMEOUT_MS = 3000;

/** Shape of a Convex document id. */
const ID_PATTERN = /^[a-z0-9]{20,40}$/;

/** A same-origin path: letters, digits and URL-safe punctuation only. */
const SAFE_PATH = /^\/[A-Za-z0-9\-._~/%]*$/;

/** The kinds of page a preview can describe. */
export type ShareKind = "lot" | "sale" | "home";

/** Loaded preview data, tagged by kind. A null `data` means "not public". */
export type LoadedShare =
  | { kind: "lot"; data: LotShareData | null }
  | { kind: "sale"; data: SaleShareData | null }
  | { kind: "home"; data: HomeShareData | null };

/**
 * Rejects after `ms`.
 *
 * @param promise - The call to bound
 * @param ms - The time limit
 * @returns The promise's value
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Convex call timed out"));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads the public data a preview of the given page needs.
 *
 * @param kind - Page kind
 * @param id - Entity id (lot or sale); ignored for home
 * @param now - Current time in ms, rounded to the minute for caching
 * @returns The loaded data
 * @throws When the id is malformed, Convex is not configured, or a call fails
 */
export async function loadShare(
  kind: ShareKind,
  id: string | null,
  now: number
): Promise<LoadedShare> {
  const url = process.env.VITE_CONVEX_URL;
  if (!url) throw new Error("VITE_CONVEX_URL is not set");
  const client = new ConvexHttpClient(url);
  if (kind === "home") {
    const data = await withTimeout(
      client.query(api.share.getHomeShare, { now }),
      CONVEX_TIMEOUT_MS
    );
    return { kind, data };
  }
  if (id === null || !ID_PATTERN.test(id)) throw new Error("Bad id");
  if (kind === "lot") {
    const lot = await withTimeout(
      client.query(api.share.getLotShare, { lotId: id as Id<"lots"> }),
      CONVEX_TIMEOUT_MS
    );
    return { kind, data: lot ? { id, ...lot } : null };
  }
  const sale = await withTimeout(
    client.query(api.share.getSaleShare, { auctionId: id as Id<"auctions"> }),
    CONVEX_TIMEOUT_MS
  );
  return { kind, data: sale ? { id, ...sale } : null };
}

/**
 * Rounds a timestamp down to the minute.
 *
 * @param ms - Milliseconds since the epoch
 * @returns The rounded timestamp
 */
export function roundToMinute(ms: number): number {
  return Math.floor(ms / 60_000) * 60_000;
}

/**
 * Keeps only a same-origin absolute path.
 *
 * @param raw - The `path` query value
 * @returns A safe path, "/" when the input is unusable
 */
export function safePath(raw: string | null): string {
  if (raw === null || !SAFE_PATH.test(raw) || raw.startsWith("//")) return "/";
  return raw;
}
