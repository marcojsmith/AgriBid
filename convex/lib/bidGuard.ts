/**
 * Database-backed bid eligibility: loads the data
 * {@link computeBidEligibility} needs and enforces it for bidding.
 */

import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getDepositSetting } from "../admin/platformSettings";
import { requireProfile } from "./auth";
import { computeBidEligibility, type BidEligibility } from "./bidEligibility";

/** Registration documents read per user (there are four kinds). */
const DOCUMENT_READ_CAP = 10;

/**
 * Loads a user's registration documents and deposit and computes their bid
 * eligibility.
 *
 * @param ctx - Query or mutation context
 * @param profile - The user's profile
 * @returns The eligibility
 */
export async function getBidEligibility(
  ctx: QueryCtx,
  profile: Doc<"profiles">
): Promise<BidEligibility> {
  const [documents, deposit, depositSetting] = await Promise.all([
    ctx.db
      .query("registrationDocuments")
      .withIndex("by_userId_and_kind", (q) => q.eq("userId", profile.userId))
      .take(DOCUMENT_READ_CAP),
    ctx.db
      .query("registrationDeposits")
      .withIndex("by_userId", (q) => q.eq("userId", profile.userId))
      .unique(),
    getDepositSetting(ctx),
  ]);
  return computeBidEligibility({ profile, documents, deposit, depositSetting });
}

/**
 * Requires the caller to be allowed to bid: documents approved and, when the
 * deposit setting is on, the deposit received. Bidding only; seller listing
 * keeps using `requireVerified`.
 *
 * @param ctx - Mutation context
 * @returns The caller's profile and user id
 * @throws ConvexError describing the next step when the caller cannot bid
 */
export async function requireCanBid(
  ctx: MutationCtx
): Promise<{ profile: Doc<"profiles">; userId: string }> {
  const { profile, userId } = await requireProfile(ctx);
  const eligibility = await getBidEligibility(ctx, profile);
  switch (eligibility.kind) {
    case "ok":
      return { profile, userId };
    case "incomplete":
      throw new ConvexError("Finish registration to bid.");
    case "under_review":
      throw new ConvexError(
        "Your documents are under review. You can bid once they're approved."
      );
    case "needs_replacing":
      throw new ConvexError(
        "One of your documents needs replacing before you can bid."
      );
    case "deposit_due":
      throw new ConvexError("Your deposit hasn't been received yet.");
  }
}
