import type { SellerType } from "./lotSpecs";

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

/** The lot fields that record a snapshot of the seller's VAT facts. */
export interface LotSellerVatSnapshot {
  premiumSource?: "auction" | "platform";
  sellerVatRegistered?: boolean;
  sellerType?: SellerType;
}

/** The seller VAT facts a lot displays. */
export interface LotSellerVat {
  vatKind: SellerVatKind;
  sellerType: SellerType | undefined;
}

/**
 * Resolves a lot's seller VAT treatment and type.
 *
 * Once a lot has been assigned (its premium source, VAT status or seller type
 * is snapshotted) the lot's own snapshot is authoritative, so later profile
 * edits cannot change a live or settled lot. Lots that were never assigned
 * (drafts, pending review, legacy lots) fall back to the live seller profile.
 *
 * @param lot - The lot's snapshot fields
 * @param profile - The seller's live profile (or null when it is missing)
 * @returns The VAT kind and seller type to display
 */
export function resolveLotSellerVat(
  lot: LotSellerVatSnapshot,
  profile:
    { vatRegistered?: boolean; sellerType?: SellerType } | null | undefined
): LotSellerVat {
  const snapshotted =
    lot.premiumSource !== undefined ||
    lot.sellerVatRegistered !== undefined ||
    lot.sellerType !== undefined;
  const source = snapshotted
    ? { vatRegistered: lot.sellerVatRegistered, sellerType: lot.sellerType }
    : profile;
  return {
    vatKind: resolveSellerVatKind(source),
    sellerType: source?.sellerType,
  };
}
