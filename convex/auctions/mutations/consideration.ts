import { ConvexError, v } from "convex/values";

import { mutation } from "../../_generated/server";
import { getAuthWithProfile } from "../../lib/auth";
import { resolveConsideration, type ConsiderationActor } from "../internal";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/** What a seller decision returns. */
const decisionResult = v.object({
  status: v.union(v.literal("sold"), v.literal("unsold")),
});

/**
 * Shared body of {@link acceptTopBid} and {@link declineTopBid}. Only the lot's
 * seller or an admin may decide, only while the lot is `under_consideration`
 * and before its deadline. Convex mutations are serialisable, so two callers
 * (a double accept, or an accept racing the expiry job) cannot both pass the
 * status check: the loser sees a non-`under_consideration` lot and is rejected,
 * and fees are settled by exactly one of them.
 *
 * @param ctx - The mutation context.
 * @param lotId - The lot to decide.
 * @param outcome - `accepted` or `declined`.
 * @returns The resulting lot status.
 */
async function decide(
  ctx: MutationCtx,
  lotId: Id<"lots">,
  outcome: "accepted" | "declined"
): Promise<{ status: "sold" | "unsold" }> {
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
  if (
    lot.considerationDeadline === undefined ||
    lot.considerationDeadline <= now
  ) {
    // The expiry job turns it into unsold; the seller can no longer accept.
    throw new ConvexError("The 48 hours to decide have passed");
  }

  const actor: ConsiderationActor = {
    kind: "user",
    userId: auth.userId,
    role: isAdmin ? "admin" : "seller",
  };
  const status = await resolveConsideration(ctx, lot._id, outcome, actor, now);
  if (status === null) {
    throw new ConvexError("This lot is no longer awaiting a decision");
  }
  return { status };
}

/**
 * Seller (or admin) accepts the top bid of an `under_consideration` lot: the
 * lot becomes `sold` to the top bidder at that bid and fees are settled once.
 */
export const acceptTopBid = mutation({
  args: { lotId: v.id("lots") },
  returns: decisionResult,
  handler: async (ctx, args) => await decide(ctx, args.lotId, "accepted"),
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
