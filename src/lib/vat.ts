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

/** What VAT is charged on: bid plus premium, or the premium alone. */
export type VatBase = "bid-and-premium" | "premium";

/** The seller kinds a cost estimate can be shown for. `any` = seller not known yet. */
export type SellerVatKind = "vat" | "private" | "any";

/**
 * Maps a seller kind to its VAT base. A private seller charges no VAT on the
 * bid, so VAT applies to the premium only. A VAT-registered seller, and the
 * generic "any seller" example on Home and Event, use bid plus premium.
 *
 * @param seller - The seller kind
 * @returns The VAT base
 */
export function vatBaseForSeller(seller: SellerVatKind): VatBase {
  return seller === "private" ? "premium" : "bid-and-premium";
}

/** The amounts a buyer pays on a lot, each rounded to whole rand. */
export interface BuyerTotal {
  /** The hammer price / bid. */
  bid: number;
  /** Buyer's premium and other buyer fees, before VAT. */
  premium: number;
  /** VAT on `bid + premium`, or on `premium` alone for a private seller. */
  vat: number;
  /** `bid + premium + vat`. */
  total: number;
}

/** Inputs for {@link calculateBuyerTotal}. */
export interface BuyerTotalInput {
  /** The hammer price / bid in rand. */
  bid: number;
  /** Buyer's premium and other buyer fees in rand (before VAT). */
  premium: number;
  /** VAT rate as a percentage from 0 to 100 (15 = 15%). */
  vatRatePct: number;
  /** What VAT applies to. Defaults to `bid-and-premium`. */
  vatBase?: VatBase;
}

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

/**
 * Converts the buyer's premium rate stored on a lot into rand.
 *
 * `lots.resolvedBuyerPremiumPct` and `auctions.defaultBuyerPremiumPct` are
 * named "Pct" but hold a fraction (`0.05` = 5%), matching how the backend
 * multiplies them straight onto the price.
 *
 * @param bid - The hammer price in rand
 * @param premiumFraction - The stored premium rate as a fraction (0.05 = 5%)
 * @returns The premium in rand, not yet rounded
 */
export function premiumFromRate(bid: number, premiumFraction: number): number {
  return bid * premiumFraction;
}

/**
 * Splits what a buyer pays into bid, premium, VAT and total, all in whole rand.
 *
 * Rounding happens only here: the premium is rounded first, VAT is then
 * rounded on `bid + premium`, and the total is the sum of the three rounded
 * parts so the displayed lines always add up. Non-finite or negative inputs
 * are treated as 0, and the VAT rate is clamped to 0-100.
 *
 * VAT base: hammer price plus buyer's premium by default, or the premium
 * alone with `vatBase: "premium"` (private seller; see the module note).
 *
 * @param input - Bid, premium and VAT rate
 * @returns The rounded breakdown
 */
export function calculateBuyerTotal(input: BuyerTotalInput): BuyerTotal {
  const clean = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

  const bid = Math.round(clean(input.bid));
  const premium = Math.round(clean(input.premium));
  const rate = Math.min(100, clean(input.vatRatePct));
  const base = input.vatBase === "premium" ? premium : bid + premium;
  const vat = Math.round((base * rate) / 100);

  return { bid, premium, vat, total: bid + premium + vat };
}
