import type { Doc } from "../_generated/dataModel";

/** Reserve state of a lot as shown to buyers; the reserve amount is never sent. */
export type ReserveStateValue = "none" | "applies" | "met" | "not_met";

/**
 * The reserve state of a lot, computed on the server so the reserve amount is
 * never sent: `none` without a reserve, `applies` until the first bid, then
 * `met` or `not_met`.
 *
 * @param lot - The lot (only the reserve and current price are read).
 * @param bids - Its bid count.
 * @returns The reserve state.
 */
export function reserveStateOf(
  lot: Pick<Doc<"lots">, "reservePrice" | "currentPrice">,
  bids: number
): ReserveStateValue {
  if (lot.reservePrice <= 0) return "none";
  if (bids === 0) return "applies";
  return lot.currentPrice >= lot.reservePrice ? "met" : "not_met";
}
