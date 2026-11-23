/** How a seller's sales are treated for VAT on the buyer's estimate. */
export type SellerVatKind = "vat" | "private";

/**
 * Resolves the VAT treatment of a seller from their profile.
 *
 * Only an explicit `vatRegistered === false` yields "private". A registered,
 * unset or unknown seller is treated as VAT-registered (worst case), matching
 * the client-side rule in `src/lib/vat.ts`.
 *
 * @param profile - The seller's profile (or null when it is missing)
 * @returns "private" when explicitly not VAT-registered, otherwise "vat"
 */
export function resolveSellerVatKind(
  profile: { vatRegistered?: boolean } | null | undefined
): SellerVatKind {
  return profile?.vatRegistered === false ? "private" : "vat";
}
