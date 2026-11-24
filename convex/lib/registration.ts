/**
 * Registration helpers: input validation, deposit references and the
 * document-driven KYC status sync.
 *
 * The pure helpers (everything except {@link syncKycStatus}) have no Convex
 * runtime dependencies and can be imported from `src/`.
 */

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { updateCounter } from "../admin_utils";
import { REG_REFERENCE_PREFIX } from "../constants";

/** Which identity document the buyer registers with. */
export type IdType = "sa_id" | "passport";

/** A registration document kind. */
export type RegDocKind =
  "id_front" | "id_back" | "passport_photo" | "proof_of_address";

/** Alphabet of deposit references: no 0, 1, I, L or O, so they read clearly. */
export const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Characters after the prefix in a deposit reference. */
export const REFERENCE_SUFFIX_LENGTH = 5;

/**
 * Whether `yy`/`mm`/`dd` form a real calendar date in the given full year.
 *
 * @param year - Full four-digit year
 * @param month - Month, 1-12
 * @param day - Day of month
 * @returns True for a real date
 */
function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates a South African ID number: 13 digits, a real YYMMDD birth date
 * (either century) and a correct Luhn check digit.
 *
 * @param value - Candidate ID number
 * @returns True when valid
 */
export function isValidSaId(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;

  const yy = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (
    !isRealDate(1900 + yy, month, day) &&
    !isRealDate(2000 + yy, month, day)
  ) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let digit = Number(value[12 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * Validates a passport number: 6 to 9 letters or digits.
 *
 * @param value - Candidate passport number
 * @returns True when valid
 */
export function isValidPassportNumber(value: string): boolean {
  return /^[A-Z0-9]{6,9}$/i.test(value);
}

/**
 * Validates a postal code: 3 to 10 letters, digits, spaces or hyphens.
 *
 * @param value - Candidate postal code
 * @returns True when valid
 */
export function isValidPostalCode(value: string): boolean {
  return /^[A-Za-z0-9 -]{3,10}$/.test(value);
}

/**
 * Generates a deposit reference such as `AB-7K3F2`.
 *
 * @param rand - Random source returning [0, 1); injectable for tests
 * @returns The reference
 */
export function generateReference(rand: () => number = Math.random): string {
  let suffix = "";
  for (let i = 0; i < REFERENCE_SUFFIX_LENGTH; i++) {
    const index = Math.min(
      REFERENCE_ALPHABET.length - 1,
      Math.floor(rand() * REFERENCE_ALPHABET.length)
    );
    suffix += REFERENCE_ALPHABET[index];
  }
  return `${REG_REFERENCE_PREFIX}${suffix}`;
}

/**
 * The document kinds a buyer must upload for their ID type.
 *
 * @param idType - The ID type
 * @returns The required kinds
 */
export function requiredKinds(idType: IdType): RegDocKind[] {
  return idType === "sa_id"
    ? ["id_front", "id_back", "proof_of_address"]
    : ["passport_photo", "proof_of_address"];
}

/**
 * Brings `kycStatus`, `isVerified` and the profile counters in line with the
 * user's registration documents:
 * - any required document rejected: `rejected`, not verified;
 * - every required document approved: `verified`;
 * - otherwise, once submitted: `pending`.
 * Does nothing when the profile has no ID type, or when nothing was submitted
 * and nothing was rejected or approved.
 *
 * @param ctx - Mutation context
 * @param profile - The user's profile
 */
export async function syncKycStatus(
  ctx: MutationCtx,
  profile: Doc<"profiles">
): Promise<void> {
  if (profile.idType === undefined) return;

  const rows = await ctx.db
    .query("registrationDocuments")
    .withIndex("by_userId_and_kind", (q) => q.eq("userId", profile.userId))
    .take(10);
  const byKind = new Map(rows.map((row) => [row.kind, row]));
  const required = requiredKinds(profile.idType).map((kind) =>
    byKind.get(kind)
  );

  const rejected = required.find((row) => row?.status === "rejected");
  const allApproved = required.every((row) => row?.status === "approved");

  let kycStatus: "pending" | "verified" | "rejected";
  if (rejected) kycStatus = "rejected";
  else if (allApproved) kycStatus = "verified";
  else if (profile.registrationSubmittedAt !== undefined) kycStatus = "pending";
  else return;

  const isVerified = kycStatus === "verified";
  const wasPending = profile.kycStatus === "pending";

  await ctx.db.patch("profiles", profile._id, {
    kycStatus,
    isVerified,
    kycRejectionReason:
      kycStatus === "rejected" ? rejected?.rejectionReason : undefined,
    updatedAt: Date.now(),
  });

  if (isVerified && !profile.isVerified) {
    await updateCounter(ctx, "profiles", "verified", 1);
  } else if (!isVerified && profile.isVerified) {
    await updateCounter(ctx, "profiles", "verified", -1);
  }
  if (kycStatus === "pending" && !wasPending) {
    await updateCounter(ctx, "profiles", "pending", 1);
  } else if (kycStatus !== "pending" && wasPending) {
    await updateCounter(ctx, "profiles", "pending", -1);
  }
}
