import { SOFT_CLOSE_THRESHOLD_MS } from "../../convex/constants";

/** Minutes a bid in the final window adds to a lot's close (the soft-close rule). */
export const SOFT_CLOSE_MINUTES = SOFT_CLOSE_THRESHOLD_MS / 60_000;

/** Hours a winner has to pay by EFT. */
export const PAYMENT_WINDOW_HOURS = 48;

/** Days a winner has to collect after paying. */
export const COLLECTION_WINDOW_DAYS = 7;

/**
 * The soft-close rule in words, built from the same constant the backend uses
 * to extend lots: "Bids in the last 2 minutes add 2 minutes".
 *
 * @returns The sentence, without a full stop
 */
export function softCloseRule(): string {
  const minutes = String(SOFT_CLOSE_MINUTES);
  return `Bids in the last ${minutes} minutes add ${minutes} minutes`;
}

/** Shown when a lot is watched. */
export const WATCHING_MESSAGE =
  "Watching. We'll notify you 1 hour before close and if you're outbid.";

/**
 * Shown when a heart is tapped and alerts will not be sent (the admin setting
 * is off, or this browser has no push subscription). It claims only that the
 * lot is saved to the watchlist; `useWatchAlerts` picks `WATCHING_MESSAGE`
 * instead only when the outbid and closing-soon alerts will really arrive.
 */
export const WATCHING_SAVED_MESSAGE =
  "Watching. Find this lot in your watchlist.";
