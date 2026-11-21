// app/src/lib/auction-utils.ts

export interface AuctionImages {
  front?: string;
  engine?: string;
  cabin?: string;
  rear?: string;
  additional?: string[];
}

/**
 * Normalizes auction images from various formats into a standard AuctionImages object.
 *
 * @param images - The raw images data (AuctionImages object, string array, or undefined)
 * @returns A standardized AuctionImages object
 */
export function normalizeAuctionImages(
  images: AuctionImages | string[] | undefined
): AuctionImages {
  if (!images) return { additional: [] };
  if (Array.isArray(images)) {
    return {
      front: images[0],
      additional: images.slice(1),
    };
  }
  return {
    ...images,
    additional: images.additional ?? [],
  };
}

/** Event-card bucket: where an auction event sits relative to now. */
export type EventBucket = "live" | "upcoming" | "closed";

/**
 * Derives the live/upcoming/closed bucket of an auction event at `now`.
 *
 * Kept client-side (pure) because a Convex query is cached and never re-runs
 * as time passes. `effectiveEndTime` is the later of the auction end and any
 * lot's soft-close extension, so an event stays live while bidding continues.
 *
 * @param event - Event status and window.
 * @param event.status - Auction container status.
 * @param event.startTime - Window start (ms).
 * @param event.endTime - Scheduled window end (ms).
 * @param event.effectiveEndTime - End including soft-close extensions (ms); falls back to `endTime`.
 * @param now - Current time (ms).
 * @returns `"upcoming"` before the start, `"live"` while open, otherwise `"closed"`.
 */
export function getEventBucket(
  event: {
    status: "draft" | "published" | "closed";
    startTime: number;
    endTime: number;
    effectiveEndTime?: number;
  },
  now: number
): EventBucket {
  if (event.status !== "published") return "closed";
  if (now < event.startTime) return "upcoming";
  return now < (event.effectiveEndTime ?? event.endTime) ? "live" : "closed";
}
