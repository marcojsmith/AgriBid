/**
 * Database-backed bid eligibility: loads the data
 * {@link computeBidEligibility} needs and enforces it for bidding.
 */

import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getDepositSetting, isDepositEnabled } from "../admin/platformSettings";
import { requireProfile } from "./auth";
import { computeBidEligibility, type BidEligibility } from "./bidEligibility";

/** Registration documents read per user (there are four kinds). */
const DOCUMENT_READ_CAP = 10;

/**
 * Loads a user's registration documents and deposit and computes their bid
 * eligibility. Verified users (the common case when bidding) take a short
 * path: one setting read, plus the deposit row only when a deposit is on.
 *
 * @param ctx - Query or mutation context
 * @param profile - The user's profile
 * @returns The eligibility
 */
export async function getBidEligibility(
  ctx: QueryCtx,
  profile: Doc<"profiles">
): Promise<BidEligibility> {
  if (profile.isVerified) {
    if (!(await isDepositEnabled(ctx))) return { kind: "ok" };
    const deposit = await ctx.db
      .query("registrationDeposits")
      .withIndex("by_userId", (q) => q.eq("userId", profile.userId))
      .unique();
    if (deposit?.status === "received") return { kind: "ok" };
    if (deposit?.status === "refund_requested") {
      return { kind: "refund_requested" };
    }
    const amount = deposit?.amount ?? (await getDepositSetting(ctx)).amount;
    return { kind: "deposit_due", amount };
  }

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
 * Whether a user may bid right now, for checking other people (a standing
 * proxy bid) rather than the caller.
 *
 * @param ctx - Query or mutation context
 * @param userId - The user to check
 * @returns True when the user has a profile and is eligible to bid
 */
export async function canUserBid(
  ctx: QueryCtx,
  userId: string
): Promise<boolean> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) return false;
  return (await getBidEligibility(ctx, profile)).kind === "ok";
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
    case "refund_requested":
      throw new ConvexError(
        "You asked for your deposit back. Cancel the request to bid."
      );
  }
}
