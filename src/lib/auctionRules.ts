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
