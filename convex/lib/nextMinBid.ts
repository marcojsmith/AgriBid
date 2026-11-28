import type { Doc } from "../_generated/dataModel";
import { getMinIncrement } from "../auctions/proxy_bidding";

/**
 * The lowest amount the next bid on a lot may be, by the same rules the bid
 * path enforces: the first bid may equal the current price (the starting
 * price), every later bid must beat it by the lot's minimum increment.
 *
 * @param lot - The lot (only price and increment fields are read)
 * @param hasBids - Whether the lot already has a valid (non-voided) bid
 * @returns The minimum next bid in rand
 */
export function nextMinBid(
  lot: Pick<Doc<"lots">, "currentPrice" | "startingPrice" | "minIncrement">,
  hasBids: boolean
): number {
  if (!hasBids) return lot.currentPrice;
  return lot.currentPrice + getMinIncrement(lot);
}
