import type { Doc } from "../_generated/dataModel";

/** Which of the two mutually exclusive seller commission sources applies. */
export type SellerCommissionSource = "snapshot" | "feeRows";

/** The single seller commission that applies to a lot. */
export interface ResolvedSellerCommission {
  /** Which rule produced the commission. */
  source: SellerCommissionSource;
  /**
   * Fraction (0.05 = 5%) charged as a derived, non-persisted commission.
   * Undefined when `source` is "feeRows": the active seller percentage
   * `platformFees` rows are the commission and are recorded in `lotFees`.
   */
  rate: number | undefined;
}

/**
 * Whether a platform fee is a percentage fee charged to sellers (alone or both
 * sides). Such rows are "commission" rows and are mutually exclusive with the
 * lot's auction snapshot. Fixed-amount seller fees are never commission rows.
 *
 * @param fee - The platform fee row (only `feeType`/`appliesTo` are read).
 * @returns True for a percentage fee applying to seller/both.
 */
export function isSellerPercentageFee(
  fee: Pick<Doc<"platformFees">, "feeType" | "appliesTo">
): boolean {
  return (
    fee.feeType === "percentage" &&
    (fee.appliesTo === "seller" || fee.appliesTo === "both")
  );
}

/**
 * Resolves the ONE seller commission for a lot, so the seller is never charged
 * twice. Used by settlement and every fee read path.
 *
 * A snapshot (`resolvedSellerCommissionPct`) only exists when the auction set
 * `defaultSellerCommissionPct`, so any snapshot is auction-sourced (lots
 * without `commissionSource` are legacy lots whose snapshot always came from
 * the auction). There is no platform commission default.
 *
 * Precedence:
 * 1. The lot's auction snapshot. Active seller/both percentage fee rows are
 *    ignored.
 * 2. Otherwise the active seller/both percentage fee rows apply as before.
 *
 * Fixed-amount seller fee rows are additive in both cases.
 *
 * @param lot - The lot (only commission fields are read).
 * @returns The resolved commission source and, when derived, its fractional rate.
 */
export function resolveSellerCommission(
  lot: Pick<Doc<"lots">, "resolvedSellerCommissionPct">
): ResolvedSellerCommission {
  // `commissionSource` can only be "auction" (or unset on legacy lots), so the
  // snapshot's presence alone decides; no source check is needed.
  const snapshot = lot.resolvedSellerCommissionPct;
  if (snapshot !== undefined) {
    return { source: "snapshot", rate: snapshot };
  }
  return { source: "feeRows", rate: undefined };
}
