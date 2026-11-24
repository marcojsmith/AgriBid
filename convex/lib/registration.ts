/**
 * Registration helpers: input validation, deposit references and the
 * document-driven KYC status sync.
 *
 * The pure validators live in `registrationValidators.ts` (importable from
 * `src/`); this module also pulls in server code.
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

export {
  isValidPassportNumber,
  isValidPostalCode,
  isValidSaId,
} from "./registrationValidators";

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
