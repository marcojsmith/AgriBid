import { formatRand } from "@/lib/currency";
import { formatRemaining } from "@/lib/countdown";
import { formatSastDate } from "@/lib/dates";
import { PHOTO_ANGLE_LABELS, type PhotoAngle } from "@/lib/lotSpecs";
import {
  calculateBuyerTotal,
  premiumFromRate,
  vatBaseForSeller,
  type SellerVatKind,
} from "@/lib/vat";
import { URGENT_MS } from "@/lib/auction-badges";

/**
 * Spaces out thousands the way the rest of the app does: `4 850`.
 *
 * @param n - A number
 * @returns The rounded number with spaces between thousands
 */
export function groupDigits(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** The lot facts the key-facts line reads. */
export interface KeyFactsLot {
  year?: number | null;
  operatingHours?: number | null;
  drive?: "2wd" | "4wd" | "tracks" | null;
  powerKw?: number | null;
  location?: string | null;
  province?: string | null;
}

const DRIVE_TEXT: Record<"2wd" | "4wd" | "tracks", string> = {
  "2wd": "2WD",
  "4wd": "4WD",
  tracks: "Tracks",
};

/**
 * Where the machine stands: "Malmesbury, Western Cape". A trailing country
 * ("ZA", "South Africa") on the stored town is dropped.
 *
 * @param location - The stored town or place
 * @param province - The province's display name, if known
 * @returns The place text, or an empty string
 */
export function lotPlace(
  location?: string | null,
  province?: string | null
): string {
  const town = (location ?? "")
    .replace(/,\s*(ZA|South Africa)\s*$/i, "")
    .trim();
  return [town, province?.trim()].filter((part) => !!part).join(", ");
}

/**
 * The one-line summary under the title: "2016 · 4 850 hrs · 4WD · 104 kW ·
 * Malmesbury, Western Cape". Unknown or zero values are left out.
 *
 * @param lot - The lot facts
 * @returns The line, or an empty string when nothing is known
 */
export function lotKeyFacts(lot: KeyFactsLot): string {
  const place = lotPlace(lot.location, lot.province);
  return [
    lot.year ? String(lot.year) : null,
    lot.operatingHours ? `${groupDigits(lot.operatingHours)} hrs` : null,
    lot.drive ? DRIVE_TEXT[lot.drive] : null,
    lot.powerKw ? `${groupDigits(lot.powerKw)} kW` : null,
    place || null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

/**
 * The smallest bid the server accepts: the opening price for the first bid,
 * then the current bid plus one increment (see `validateBid` in
 * `convex/auctions/proxy_bidding.ts`).
 *
 * @param lot - Current price, increment and bid count
 * @param lot.currentPrice - The current (or opening) price
 * @param lot.minIncrement - The bid increment
 * @param lot.bidCount - Valid bids so far
 * @returns The minimum bid in rand
 */
export function nextMinimumBid(lot: {
  currentPrice: number;
  minIncrement: number;
  bidCount: number;
}): number {
  return lot.bidCount === 0
    ? lot.currentPrice
    : lot.currentPrice + lot.minIncrement;
}

/**
 * The three quick-bid amounts: the minimum, then one and two increments more.
 *
 * @param minimum - The minimum bid
 * @param increment - The bid increment
 * @returns Three amounts, ascending
 */
export function quickBidAmounts(
  minimum: number,
  increment: number
): [number, number, number] {
  return [minimum, minimum + increment, minimum + 2 * increment];
}

/** One photo of the gallery. */
export interface GalleryPhoto {
  url: string;
  angle?: PhotoAngle;
}

/** One slide of the gallery: a photo or the cold-start video. */
export interface GallerySlide {
  kind: "photo" | "video";
  url: string;
  /** The caption: "Cold-start video" or the angle ("Hour meter"). */
  caption?: string;
}

/**
 * Builds the gallery slides: the cold-start video first when there is one,
 * then the photos in order with their angle captions.
 *
 * @param photos - The lot's photos
 * @param videoUrl - The cold-start video, if any
 * @returns The slides
 */
export function buildSlides(
  photos: readonly GalleryPhoto[],
  videoUrl?: string
): GallerySlide[] {
  const slides: GallerySlide[] = photos.map((photo) => ({
    kind: "photo",
    url: photo.url,
    caption: photo.angle ? PHOTO_ANGLE_LABELS[photo.angle] : undefined,
  }));
  return videoUrl
    ? [{ kind: "video", url: videoUrl, caption: "Cold-start video" }, ...slides]
    : slides;
}

/**
 * Finds the hour-meter photo among the slides, for "See meter photo".
 *
 * @param slides - The gallery slides
 * @returns The slide index, or -1 when there is no hour-meter photo
 */
export function meterPhotoIndex(slides: readonly GallerySlide[]): number {
  return slides.findIndex((slide) => slide.caption === "Hour meter");
}

/**
 * Converts the lot's stored premium fraction (0.12) to the percentage the
 * copy shows (12), without float noise.
 *
 * @param fraction - The premium as a fraction
 * @returns The percentage
 */
export function premiumPct(fraction: number): number {
  return Number((fraction * 100).toFixed(4));
}

/** One line of the confirm sheet. */
export interface ConfirmRow {
  label: string;
  amount: number;
}

/** What the confirm sheet shows for a bid. */
export interface ConfirmBreakdown {
  rows: ConfirmRow[];
  /** "If you win, you pay". */
  total: number;
}

/**
 * The confirm-sheet maths: bid, buyer's premium, VAT and what the winner pays.
 * Uses `calculateBuyerTotal`, so rounding matches the rest of the app; the
 * VAT row is "VAT 15%" for a VAT-registered seller and "VAT 15% on the
 * premium" for a private one. The server stays authoritative.
 *
 * @param input - The bid and the lot's fee facts
 * @param input.bid - The bid in rand
 * @param input.premiumFraction - The lot's buyer premium as a fraction
 * @param input.fixedFees - Fixed buyer fees in rand, charged before VAT
 * @param input.vatRatePct - The VAT rate as a percentage
 * @param input.seller - The seller's VAT kind
 * @returns The rows and the total
 */
export function confirmBreakdown(input: {
  bid: number;
  premiumFraction: number;
  fixedFees?: number;
  vatRatePct: number;
  seller: SellerVatKind;
}): ConfirmBreakdown {
  const fixed = input.fixedFees ?? 0;
  const { bid, premium, vat, total } = calculateBuyerTotal({
    bid: input.bid,
    premium: premiumFromRate(input.bid, input.premiumFraction) + fixed,
    vatRatePct: input.vatRatePct,
    vatBase: vatBaseForSeller(input.seller),
  });
  const premiumOnly = Math.round(premiumFromRate(bid, input.premiumFraction));
  const otherFees = premium - premiumOnly;
  const rate = String(Number(input.vatRatePct.toFixed(2)));
  return {
    rows: [
      { label: "Your bid", amount: bid },
      {
        label: `Buyer's premium ${String(premiumPct(input.premiumFraction))}%`,
        amount: premiumOnly,
      },
      ...(otherFees > 0
        ? [{ label: "Other buyer fees", amount: otherFees }]
        : []),
      {
        label:
          input.seller === "private"
            ? `VAT ${rate}% on the premium`
            : `VAT ${rate}%`,
        amount: vat,
      },
    ],
    total,
  };
}

/** What went wrong with a bid, so the sheet can say it in plain words. */
export type BidErrorKind =
  "outbid" | "below-minimum" | "closed" | "unverified" | "cooldown" | "other";

/** A bid error ready to show. */
export interface BidError {
  kind: BidErrorKind;
  message: string;
  /** The new minimum, when the server said it. */
  minimum?: number;
}

/**
 * Turns a failed `placeBid` message into something a bidder can act on.
 * "Bid amount must be at least R x" after the user confirmed a bid at least
 * the minimum they saw means someone bid in the meantime (outbid); a bid below
 * the minimum they saw is a plain "below minimum".
 *
 * @param message - The error text from the server
 * @param attempt - The amount that was submitted
 * @param shownMinimum - The minimum the user saw when they confirmed
 * @returns The classified error
 */
export function classifyBidError(
  message: string,
  attempt: number,
  shownMinimum: number
): BidError {
  const text = message.toLowerCase();
  const atLeast = /at least r\s?([\d\s,]+)/i.exec(message);
  const minimum = atLeast
    ? Number(atLeast[1].replace(/[^\d]/g, ""))
    : undefined;

  if (minimum !== undefined && Number.isFinite(minimum)) {
    if (attempt >= shownMinimum) {
      return {
        kind: "outbid",
        minimum,
        message: `Someone bid before you. The minimum is now ${formatRand(minimum)}.`,
      };
    }
    return {
      kind: "below-minimum",
      minimum,
      message: `The minimum bid is ${formatRand(minimum)}.`,
    };
  }
  if (
    text.includes("auction ended") ||
    text.includes("has not started") ||
    text.includes("not active") ||
    text.includes("not assigned")
  ) {
    return {
      kind: "closed",
      message: text.includes("not started")
        ? "Bidding hasn't opened yet."
        : "Bidding on this lot has closed.",
    };
  }
  if (text.includes("verification") || text.includes("kyc")) {
    return {
      kind: "unverified",
      message: "Verify your account before you bid.",
    };
  }
  if (text.includes("too fast")) {
    return { kind: "cooldown", message };
  }
  return { kind: "other", message: message || "Couldn't place your bid." };
}

/** Where the viewer stands on a lot. */
export type ViewerBidState = "guest" | "registered" | "leading" | "outbid";

/**
 * The viewer's panel state. A guest is signed out; a signed-in user is
 * `registered` until they have bid, then `leading` or `outbid`.
 *
 * @param signedIn - Whether the viewer is signed in
 * @param bidState - The server's leading/outbid/none answer
 * @returns The panel state
 */
export function viewerState(
  signedIn: boolean,
  bidState: "none" | "leading" | "outbid" | undefined
): ViewerBidState {
  if (!signedIn) return "guest";
  if (bidState === "leading") return "leading";
  if (bidState === "outbid") return "outbid";
  return "registered";
}

/** Everything the sticky bar needs to render. */
export interface StickyModel {
  title: string;
  sub: string;
  subTone: "default" | "ok" | "warn";
  urgent: boolean;
}

/**
 * The sticky phone bar's two lines. Line 1 is the price and time left
 * ("R 400 000 · 2d 3h"); line 2 the state ("Opening bid", "You're leading",
 * "Outbid"). Under 10 minutes the countdown leads and turns red:
 * "1m 52s left" over "R 428 000 · Outbid".
 *
 * @param input - Price, time left and the viewer's state
 * @param input.price - The price shown (opening or current bid)
 * @param input.remainingMs - Milliseconds until close
 * @param input.hasBids - Whether any bid exists
 * @param input.viewer - The viewer's state
 * @returns The bar's lines and tone
 */
export function stickyModel(input: {
  price: number;
  remainingMs: number;
  hasBids: boolean;
  viewer: ViewerBidState;
}): StickyModel {
  const state =
    input.viewer === "leading"
      ? "You're leading"
      : input.viewer === "outbid"
        ? "Outbid"
        : input.hasBids
          ? "Current bid"
          : "Opening bid";
  const tone =
    input.viewer === "leading"
      ? "ok"
      : input.viewer === "outbid"
        ? "warn"
        : "default";
  const price = formatRand(input.price);
  if (input.remainingMs > 0 && input.remainingMs < URGENT_MS) {
    return {
      title: `${formatRemaining(input.remainingMs)} left`,
      sub: `${price} · ${state}`,
      subTone: tone,
      urgent: true,
    };
  }
  return {
    title:
      input.remainingMs > 0
        ? `${price} · ${formatRemaining(input.remainingMs)}`
        : price,
    sub: state,
    subTone: tone,
    urgent: false,
  };
}

/**
 * Whether the lot is in its soft-close extension: the lot's own end moved
 * past the sale's end.
 *
 * @param lot - End times and the extension flag
 * @param lot.isExtended - The lot's extension flag
 * @param lot.extendedEndTime - The lot's own end time, when extended
 * @param now - Current time (ms)
 * @returns True while an extended lot is still open
 */
export function isInExtension(
  lot: { isExtended?: boolean; extendedEndTime?: number },
  now: number
): boolean {
  return (
    lot.isExtended === true &&
    lot.extendedEndTime !== undefined &&
    lot.extendedEndTime > now
  );
}

/**
 * A bid's age in the history: "just now", "2 min ago", "1 h ago", and the
 * date once it is a day old.
 *
 * @param timestamp - When the bid was placed (ms)
 * @param now - Current time (ms)
 * @returns The text
 */
export function formatBidTime(timestamp: number, now: number): string {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${String(minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)} h ago`;
  return formatSastDate(timestamp);
}
