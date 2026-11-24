/**
 * Bid eligibility: what stands between a signed-in user and placing a bid.
 *
 * This module is pure (types, a validator and {@link computeBidEligibility}) so
 * `src/` can import it. The database-backed parts live in `bidGuard.ts`.
 */

import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";

/** The slice of a profile that decides bid eligibility. */
export type EligibilityProfile = Pick<
  Doc<"profiles">,
  | "isVerified"
  | "kycStatus"
  | "idType"
  | "fullName"
  | "phoneNumber"
  | "idNumber"
  | "passportNumber"
  | "countryOfIssue"
  | "streetAddress"
  | "town"
  | "postalCode"
  | "registrationSubmittedAt"
>;

/** The slice of a registration document that decides bid eligibility. */
export type EligibilityDocument = Pick<
  Doc<"registrationDocuments">,
  "kind" | "status"
>;

/** Where a user stands on the way to bidding. */
export type BidEligibility =
  | { kind: "ok" }
  | { kind: "incomplete"; step: 1 | 2 | 3; totalSteps: 3 | 4 }
  | { kind: "under_review"; depositReceived: boolean }
  | { kind: "needs_replacing"; count: number }
  | { kind: "deposit_due"; amount: number };

/** Validator matching {@link BidEligibility}. */
export const bidEligibilityValidator = v.union(
  v.object({ kind: v.literal("ok") }),
  v.object({
    kind: v.literal("incomplete"),
    step: v.union(v.literal(1), v.literal(2), v.literal(3)),
    totalSteps: v.union(v.literal(3), v.literal(4)),
  }),
  v.object({ kind: v.literal("under_review"), depositReceived: v.boolean() }),
  v.object({ kind: v.literal("needs_replacing"), count: v.number() }),
  v.object({ kind: v.literal("deposit_due"), amount: v.number() })
);

/**
 * Whether every personal and address detail needed for the chosen ID type is
 * present.
 *
 * @param profile - The profile slice
 * @returns True when nothing is missing
 */
export function hasAllDetails(profile: EligibilityProfile): boolean {
  if (
    profile.idType === undefined ||
    !profile.fullName ||
    !profile.phoneNumber ||
    !profile.streetAddress ||
    !profile.town ||
    !profile.postalCode
  ) {
    return false;
  }
  return profile.idType === "sa_id"
    ? Boolean(profile.idNumber)
    : Boolean(profile.passportNumber) && Boolean(profile.countryOfIssue);
}

/**
 * Works out a user's bid eligibility from plain data.
 *
 * Order of checks: verified and deposit satisfied is `ok`; verified without
 * the deposit is `deposit_due`; a rejected document is `needs_replacing`; a
 * submitted (or legacy pending) registration is `under_review`; otherwise the
 * first unfinished step is `incomplete`.
 *
 * @param input - Profile, documents, deposit row and the deposit setting
 * @param input.profile - The profile slice
 * @param input.documents - The user's registration documents
 * @param input.deposit - The user's deposit row, or null
 * @param input.depositSetting - Whether a deposit is required, and its amount
 * @param input.depositSetting.enabled - Whether a deposit is required
 * @param input.depositSetting.amount - The deposit amount in rand
 * @returns The eligibility
 */
export function computeBidEligibility(input: {
  profile: EligibilityProfile;
  documents: readonly EligibilityDocument[];
  deposit: Pick<Doc<"registrationDeposits">, "status" | "amount"> | null;
  depositSetting: { enabled: boolean; amount: number };
}): BidEligibility {
  const { profile, documents, deposit, depositSetting } = input;
  const depositReceived = deposit?.status === "received";

  if (profile.isVerified) {
    return !depositSetting.enabled || depositReceived
      ? { kind: "ok" }
      : {
          kind: "deposit_due",
          amount: deposit?.amount ?? depositSetting.amount,
        };
  }

  const rejected = documents.filter((doc) => doc.status === "rejected").length;
  if (rejected > 0) return { kind: "needs_replacing", count: rejected };

  if (
    profile.registrationSubmittedAt !== undefined ||
    profile.kycStatus === "pending"
  ) {
    return { kind: "under_review", depositReceived };
  }

  const totalSteps = depositSetting.enabled ? 4 : 3;
  if (!hasAllDetails(profile))
    return { kind: "incomplete", step: 1, totalSteps };

  const kinds = new Set(documents.map((doc) => doc.kind));
  const hasId =
    profile.idType === "sa_id"
      ? kinds.has("id_front") && kinds.has("id_back")
      : kinds.has("passport_photo");
  if (!hasId) return { kind: "incomplete", step: 2, totalSteps };

  return { kind: "incomplete", step: 3, totalSteps };
}
