/**
 * Buyer-side VAT and total estimate helpers.
 *
 * Pure functions with no React or Convex dependencies, so the lot page, the
 * pre-bid panel and the fee breakdown all share one calculation.
 *
 * VAT base depends on the seller (owner decision, 2026-11-23):
 * - VAT-registered seller (and, where the seller is unknown, the worst case):
 *   VAT is charged on the hammer price PLUS the premium,
 *   `vat = (bid + premium) * vatRatePct / 100`.
 * - Private seller: VAT is charged on the premium only,
 *   `vat = premium * vatRatePct / 100`.
 * Nothing else in the codebase applies VAT, so this is the single place that
 * defines the rule.
 */

/** VAT rate (percent) used when no admin has set one. Mirrors `convex/constants.ts`. */
export const DEFAULT_VAT_RATE_PCT = 15;

export {
  calculateBuyerTotal,
  premiumFromRate,
  vatBaseForSeller,
} from "../../convex/lib/buyerTotal";
export type {
  BuyerTotal,
  BuyerTotalInput,
  SellerVatKind,
  VatBase,
} from "../../convex/lib/buyerTotal";

/**
 * Parses an admin's text input into a VAT rate.
 *
 * @param raw - The text typed into the field
 * @returns The rate (0-100), or `null` when the text is not a valid rate
 */
export function parseVatRate(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}
