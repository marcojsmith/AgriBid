import { formatRand } from "../../src/lib/currency.js";
import { formatSastDate } from "../../src/lib/dates.js";
import { lotTitle } from "../../src/lib/lotTitle.js";

/** The tags a share page carries. */
export interface ShareMeta {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  imageAlt: string;
}

/** Public lot fields from `share.getLotShare`, plus the lot's id. */
export interface LotShareData {
  id: string;
  make: string;
  model: string;
  title: string;
  lotNumber?: number;
  status: "assigned" | "under_consideration" | "sold" | "unsold";
  startingPrice: number;
  currentPrice: number;
  bidCount: number;
  place: string;
  auctionStartTime?: number;
  closeTime?: number;
  imageUrl?: string;
}

/** Public sale fields from `share.getSaleShare`, plus the sale's id. */
export interface SaleShareData {
  id: string;
  title: string;
  status: "published" | "closed";
  startTime: number;
  effectiveEndTime: number;
  lotCount: number;
  soldCount?: number;
  imageUrls: string[];
}

/** Public home fields from `share.getHomeShare`. */
export interface HomeShareData {
  title: string;
  phase: "live" | "upcoming";
  startTime: number;
  effectiveEndTime: number;
  lotCount: number;
  imageUrl?: string;
}

/** The title every non-lot, non-sale page shares. */
export const HOME_TITLE = "AgriBid · Farm equipment auctions";

/** The description when no sale is live or upcoming. */
export const HOME_FALLBACK_DESCRIPTION =
  "Online farm equipment auctions in South Africa";

/** How a lot reads in its preview. */
export type LotShareState =
  "opening" | "current" | "upcoming" | "sold" | "closed";

/**
 * Works out which state a lot's preview shows.
 *
 * @param lot - The lot
 * @param now - Current time in ms
 * @returns The state
 */
export function lotShareState(lot: LotShareData, now: number): LotShareState {
  if (lot.status === "sold") return "sold";
  if (lot.status !== "assigned") return "closed";
  if (lot.closeTime !== undefined && lot.closeTime <= now) return "closed";
  if (lot.auctionStartTime !== undefined && lot.auctionStartTime > now) {
    return "upcoming";
  }
  return lot.bidCount === 0 ? "opening" : "current";
}

/**
 * Joins description parts, leaving out empty ones.
 *
 * @param parts - The parts
 * @returns The parts joined with " · "
 */
function join(...parts: string[]): string {
  return parts.filter((part) => part !== "").join(" · ");
}

/**
 * Builds the absolute og:image URL.
 *
 * @param origin - Site origin
 * @param kind - Card kind
 * @param id - Entity id, when there is one
 * @param key - Cache-busting key
 * @returns The URL
 */
function imageUrl(
  origin: string,
  kind: "lot" | "sale" | "home",
  id: string | undefined,
  key: string
): string {
  const idPart = id ? `&id=${encodeURIComponent(id)}` : "";
  return `${origin}/api/og?kind=${kind}${idPart}&v=${encodeURIComponent(key)}`;
}

/**
 * Tags for the home page and every page without its own preview.
 *
 * @param sale - The live or next sale, or null when there is none
 * @param path - The page path
 * @param origin - Site origin
 * @returns The tags
 */
function homeMeta(
  sale: HomeShareData | null,
  path: string,
  origin: string
): ShareMeta {
  let description = HOME_FALLBACK_DESCRIPTION;
  if (sale?.phase === "live") {
    description = `${sale.title} is live · ${String(sale.lotCount)} lots · Closes ${formatSastDate(sale.effectiveEndTime)}`;
  } else if (sale) {
    description = `Next sale: ${sale.title} · Opens ${formatSastDate(sale.startTime)}`;
  }
  const key = sale
    ? `${String(sale.startTime)}-${String(sale.effectiveEndTime)}`
    : "none";
  return {
    title: HOME_TITLE,
    description,
    url: `${origin}${path}`,
    imageUrl: imageUrl(origin, "home", undefined, key),
    imageAlt: sale
      ? `AgriBid: ${sale.title}`
      : "AgriBid farm equipment auctions",
  };
}

/**
 * Tags for the home page and every page without its own preview.
 *
 * @param sale - The live or next sale, or null when there is none
 * @param path - The page path
 * @param _now - Current time in ms (kept so every builder shares a signature)
 * @param origin - Site origin
 * @returns The tags
 */
export function buildHomeMeta(
  sale: HomeShareData | null,
  path: string,
  _now: number,
  origin: string
): ShareMeta {
  return homeMeta(sale, path, origin);
}

/**
 * Tags for a lot page. A missing lot falls back to the home tags but keeps the
 * lot's own URL.
 *
 * @param lot - The lot, or null when it is not public
 * @param path - The page path
 * @param now - Current time in ms
 * @param origin - Site origin
 * @returns The tags
 */
export function buildLotMeta(
  lot: LotShareData | null,
  path: string,
  now: number,
  origin: string
): ShareMeta {
  if (!lot) return homeMeta(null, path, origin);
  const name = lotTitle(lot);
  const state = lotShareState(lot, now);
  const close =
    lot.closeTime === undefined ? "" : formatSastDate(lot.closeTime);
  const start =
    lot.auctionStartTime === undefined
      ? ""
      : formatSastDate(lot.auctionStartTime);

  let label: string;
  let timing: string;
  switch (state) {
    case "opening":
      label = `Opening bid ${formatRand(lot.startingPrice)}`;
      timing = close && `Closes ${close}`;
      break;
    case "current":
      label = `Current bid ${formatRand(lot.currentPrice)}`;
      timing = close && `Closes ${close}`;
      break;
    case "upcoming":
      label = `Opening bid ${formatRand(lot.startingPrice)}`;
      timing = start && `Opens ${start}`;
      break;
    case "sold":
      label = `Sold for ${formatRand(lot.currentPrice)}`;
      timing = close && `Closed ${close}`;
      break;
    case "closed":
      label = "Bidding closed";
      timing = close && `Closed ${close}`;
      break;
  }
  const lotPart =
    lot.lotNumber === undefined ? "" : ` · Lot ${String(lot.lotNumber)}`;
  const key = `${state}-${String(lot.currentPrice)}-${String(lot.closeTime ?? 0)}`;
  return {
    title: `${name}${lotPart} · AgriBid`,
    description: join(label, timing, lot.place),
    url: `${origin}${path}`,
    imageUrl: imageUrl(origin, "lot", lot.id, key),
    imageAlt: `${name}: ${label}`,
  };
}

/**
 * Tags for a sale page. A missing sale falls back to the home tags but keeps
 * the sale's own URL.
 *
 * @param sale - The sale, or null when it is not public
 * @param path - The page path
 * @param now - Current time in ms
 * @param origin - Site origin
 * @returns The tags
 */
export function buildSaleMeta(
  sale: SaleShareData | null,
  path: string,
  now: number,
  origin: string
): ShareMeta {
  if (!sale) return homeMeta(null, path, origin);
  const lots = `${String(sale.lotCount)} lots`;
  let description: string;
  if (sale.status === "closed" || sale.effectiveEndTime <= now) {
    const day = formatSastDate(sale.effectiveEndTime).split(",")[0];
    description = join(
      lots,
      `Closed ${day}`,
      sale.soldCount === undefined ? "" : `${String(sale.soldCount)} sold`
    );
  } else if (sale.startTime > now) {
    description = `${lots} · Opens ${formatSastDate(sale.startTime)} · Online`;
  } else {
    description = `${lots} · Closes ${formatSastDate(sale.effectiveEndTime)} · Online`;
  }
  const key = `${sale.status}-${String(sale.lotCount)}-${String(sale.soldCount ?? 0)}-${String(sale.effectiveEndTime)}`;
  return {
    title: sale.title,
    description,
    url: `${origin}${path}`,
    imageUrl: imageUrl(origin, "sale", sale.id, key),
    imageAlt: `${sale.title}: ${lots}`,
  };
}
