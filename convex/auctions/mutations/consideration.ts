import { ConvexError, v } from "convex/values";

import { mutation } from "../../_generated/server";
import { getAuthWithProfile } from "../../lib/auth";
import { resolveConsideration, type ConsiderationActor } from "../internal";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/**
 * What a seller decision returns. `expired` is true when the deadline had
 * already passed, so the lot was settled as not sold instead of the decision.
 */
const decisionResult = v.object({
  status: v.union(v.literal("sold"), v.literal("unsold")),
  expired: v.boolean(),
});

/**
 * Shared body of {@link acceptTopBid} and {@link declineTopBid}. Only the lot's
 * seller or an admin may decide, only while the lot is `under_consideration`
 * and, for a real decision, before its deadline (after it the lot is settled
 * as expired). Convex mutations are serialisable, so two callers
 * (a double accept, or an accept racing the expiry job) cannot both pass the
 * status check: the loser sees a non-`under_consideration` lot and is rejected,
 * and fees are settled by exactly one of them.
 *
 * @param ctx - The mutation context.
 * @param lotId - The lot to decide.
 * @param outcome - `accepted` or `declined`.
 * @param expectedAmount - The top bid the caller saw; accept is refused if it changed.
 * @returns The resulting lot status.
 */
async function decide(
  ctx: MutationCtx,
  lotId: Id<"lots">,
  outcome: "accepted" | "declined",
  expectedAmount?: number
): Promise<{ status: "sold" | "unsold"; expired: boolean }> {
  const auth = await getAuthWithProfile(ctx);
  if (!auth) throw new ConvexError("Not authenticated");

  const lot = await ctx.db.get("lots", lotId);
  if (!lot) throw new ConvexError("Lot not found");

  const isAdmin = auth.profile?.role === "admin";
  const isSeller =
    lot.sellerId === auth.userId || lot.sellerId === auth.authUser._id;
  if (!isAdmin && !isSeller) {
    throw new ConvexError("Only the seller or an admin can decide on this lot");
  }

  if (lot.status !== "under_consideration") {
    throw new ConvexError("This lot is no longer awaiting a decision");
  }
  const now = Date.now();
  const actor: ConsiderationActor = {
    kind: "user",
    userId: auth.userId,
    role: isAdmin ? "admin" : "seller",
  };

  // Past the deadline the lot can no longer be accepted. Rather than leave it
  // stuck when the expiry cron is off or missed a run, settle it as expired
  // right here (idempotent: the expiry job skips it afterwards) and tell the
  // caller. Both accept and decline land here, so an admin can always clear it.
  if (
    lot.considerationDeadline === undefined ||
    lot.considerationDeadline <= now
  ) {
    const expiredStatus = await resolveConsideration(
      ctx,
      lot._id,
      "expired",
      actor,
      now
    );
    if (expiredStatus === null) {
      throw new ConvexError("This lot is no longer awaiting a decision");
    }
    return { status: expiredStatus, expired: true };
  }

  const status = await resolveConsideration(
    ctx,
    lot._id,
    outcome,
    actor,
    now,
    expectedAmount
  );
  if (status === null) {
    throw new ConvexError("This lot is no longer awaiting a decision");
  }
  return { status, expired: false };
}

/**
 * Seller (or admin) accepts the top bid of an `under_consideration` lot: the
 * lot becomes `sold` to the top bidder at that bid and fees are settled once.
 */
export const acceptTopBid = mutation({
  args: { lotId: v.id("lots"), expectedAmount: v.number() },
  returns: decisionResult,
  handler: async (ctx, args) =>
    await decide(ctx, args.lotId, "accepted", args.expectedAmount),
});

/**
 * Seller (or admin) declines the top bid of an `under_consideration` lot: the
 * lot becomes `unsold` and no fees are charged.
 */
export const declineTopBid = mutation({
  args: { lotId: v.id("lots") },
  returns: decisionResult,
  handler: async (ctx, args) => await decide(ctx, args.lotId, "declined"),
});
