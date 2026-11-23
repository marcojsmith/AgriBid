import { getBuyerPremiumPct } from "../admin/platformSettings";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Which of the three mutually exclusive premium sources applies to a lot. */
export type BuyerPremiumSource = "snapshot" | "feeRows" | "platformDefault";

/** The single buyer premium that applies to a lot. */
export interface ResolvedBuyerPremium {
  /** Which rule produced the premium. */
  source: BuyerPremiumSource;
  /**
   * Fraction (0.12 = 12%) charged as a derived, non-persisted premium.
   * Undefined when `source` is "feeRows": the active buyer percentage
   * `platformFees` rows are the premium and are recorded in `lotFees`.
   */
  rate: number | undefined;
}

/**
 * Converts a percent (12.5) into a fraction rounded to 4 dp (0.125).
 *
 * @param pct - Percent value (0-100).
 * @returns The equivalent fraction.
 */
export function percentToFraction(pct: number): number {
  return Math.round(pct * 100) / 10000;
}

/**
 * Whether a platform fee is a percentage fee charged to buyers (alone or both
 * sides). Such rows are "premium" rows and are mutually exclusive with the
 * lot's snapshot and the platform default.
 *
 * @param fee - The platform fee row (only `feeType`/`appliesTo` are read).
 * @returns True for an active-or-not percentage fee applying to buyer/both.
 */
export function isBuyerPercentageFee(
  fee: Pick<Doc<"platformFees">, "feeType" | "appliesTo">
): boolean {
  return (
    fee.feeType === "percentage" &&
    (fee.appliesTo === "buyer" || fee.appliesTo === "both")
  );
}

/**
 * Resolves the ONE buyer premium for a lot, so the buyer is never charged
 * twice. Used by settlement and every fee read path.
 *
 * Precedence:
 * 1. The lot's auction snapshot (`premiumSource === "auction"`, or no
 *    `premiumSource` with a snapshot, i.e. legacy lots whose snapshot always
 *    came from the auction). Active buyer percentage fee rows are ignored.
 * 2. Otherwise, if any active percentage fee row applies to buyer/both, only
 *    those rows are used; the snapshot is ignored.
 * 3. Otherwise the platform default (`buyer_premium_pct`) read right now.
 *
 * @param ctx - Query (or mutation) context.
 * @param lot - The lot (only premium fields are read).
 * @returns The resolved premium source and, when derived, its fractional rate.
 */
export async function resolveBuyerPremium(
  ctx: QueryCtx,
  lot: Pick<Doc<"lots">, "premiumSource" | "resolvedBuyerPremiumPct">
): Promise<ResolvedBuyerPremium> {
  const snapshot = lot.resolvedBuyerPremiumPct;
  const snapshotIsFromAuction =
    lot.premiumSource === "auction" || lot.premiumSource === undefined;
  if (snapshot !== undefined && snapshotIsFromAuction) {
    return { source: "snapshot", rate: snapshot };
  }

  const activeFees = await ctx.db
    .query("platformFees")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();
  if (activeFees.some(isBuyerPercentageFee)) {
    return { source: "feeRows", rate: undefined };
  }

  return {
    source: "platformDefault",
    rate: percentToFraction(await getBuyerPremiumPct(ctx)),
  };
}
