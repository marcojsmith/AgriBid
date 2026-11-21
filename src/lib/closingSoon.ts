import type { FunctionReturnType } from "convex/server";
import type { api } from "convex/_generated/api";

/** One lot as `getClosingSoonLots` returns it. */
export type ClosingSoonLot = FunctionReturnType<
  typeof api.auctions.getClosingSoonLots
>[number];

/**
 * Drops lots that have ended. Convex caches the query result and its server
 * clock does not tick, so a lot can end while the list is still on screen.
 *
 * @param lots - Lots from the query
 * @param now - Current time in ms (from `useNow`)
 * @returns Lots whose effective end is still in the future
 */
export function selectOpenLots(
  lots: readonly ClosingSoonLot[],
  now: number
): ClosingSoonLot[] {
  return lots.filter((lot) => lot.effectiveEndTime > now);
}
