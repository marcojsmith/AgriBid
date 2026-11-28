/**
 * Admin review of seller About text. A seller's edit waits in
 * `profiles.bioPending`; the live `bio` only changes when an admin approves it.
 */

import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import type { Doc } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { logAudit } from "../admin_utils";
import { requireAdmin } from "../lib/auth";
import { notifyUser } from "../lib/notify";

/** Longest accepted rejection reason. */
export const MAX_BIO_REJECTION_REASON_LENGTH = 300;

/** Where a seller sees their About text and its review outcome. */
const ACCOUNT_LINK = "/settings";

/**
 * Loads a profile whose About edit is waiting for review.
 *
 * @param ctx - Mutation context
 * @param userId - The seller's user id
 * @param reviewedSubmittedAt - The `bioSubmittedAt` of the row the admin read
 * @returns The profile, with its pending text
 * @throws ConvexError when there is no profile, nothing is pending, or the
 *   seller edited the text after the admin opened it
 */
async function loadPendingBio(
  ctx: MutationCtx,
  userId: string,
  reviewedSubmittedAt: number
): Promise<Doc<"profiles"> & { bioPending: string }> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) throw new ConvexError("Profile not found");
  if (profile.bioStatus !== "pending" || profile.bioPending === undefined) {
    throw new ConvexError("There is no About text waiting for review");
  }
  // The seller can edit while the admin is reading: only the exact text the
  // admin saw may be approved or rejected.
  if (profile.bioSubmittedAt !== reviewedSubmittedAt) {
    throw new ConvexError(
      "This About text changed since you opened it. Reload and review it again."
    );
  }
  return { ...profile, bioPending: profile.bioPending };
}

/**
 * Admin: About edits waiting for review, oldest first.
 */
export const listPendingBios = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        userId: v.string(),
        publicName: v.string(),
        bioPending: v.string(),
        bioSubmittedAt: v.optional(v.number()),
        currentBio: v.optional(v.string()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const results = await ctx.db
      .query("profiles")
      .withIndex("by_bioStatus_and_bioSubmittedAt", (q) =>
        q.eq("bioStatus", "pending")
      )
      .order("asc")
      .paginate(args.paginationOpts);

    const page = results.page.flatMap((profile) =>
      profile.bioPending === undefined
        ? []
        : [
            {
              userId: profile.userId,
              publicName:
                profile.publicName ??
                profile.companyName ??
                profile.name ??
                "Unnamed seller",
              bioPending: profile.bioPending,
              bioSubmittedAt: profile.bioSubmittedAt,
              currentBio: profile.bio,
            },
          ]
    );

    return {
      page,
      isDone: results.isDone,
      continueCursor: results.continueCursor,
    };
  },
});

/**
 * Admin: publish a seller's pending About text. `bioSubmittedAt` is the value
 * from `listPendingBios`; the call fails if the seller changed the text since.
 */
export const approveBio = mutation({
  args: { userId: v.string(), bioSubmittedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const profile = await loadPendingBio(ctx, args.userId, args.bioSubmittedAt);

    await ctx.db.patch("profiles", profile._id, {
      bio: profile.bioPending,
      bioPending: undefined,
      bioStatus: "approved",
      bioRejectionReason: undefined,
      bioSubmittedAt: undefined,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "APPROVE_SELLER_BIO",
      targetId: args.userId,
      targetType: "user",
      details: JSON.stringify({ bio: profile.bioPending }),
    });
    return null;
  },
});

/**
 * Admin: turn down a seller's pending About text, with a reason the seller sees.
 * `bioSubmittedAt` is the value from `listPendingBios`; the call fails if the
 * seller changed the text since.
 */
export const rejectBio = mutation({
  args: {
    userId: v.string(),
    reason: v.string(),
    bioSubmittedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const reason = args.reason.trim();
    if (reason.length === 0) {
      throw new ConvexError("Give a reason for rejecting the About text");
    }
    if (reason.length > MAX_BIO_REJECTION_REASON_LENGTH) {
      throw new ConvexError(
        `Reason is too long. Maximum ${MAX_BIO_REJECTION_REASON_LENGTH.toString()} characters allowed.`
      );
    }
    const profile = await loadPendingBio(ctx, args.userId, args.bioSubmittedAt);

    await ctx.db.patch("profiles", profile._id, {
      bioPending: undefined,
      bioStatus: "rejected",
      bioRejectionReason: reason,
      bioSubmittedAt: undefined,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "REJECT_SELLER_BIO",
      targetId: args.userId,
      targetType: "user",
      details: JSON.stringify({ bio: profile.bioPending, reason }),
    });

    await notifyUser(ctx, {
      recipientId: args.userId,
      type: "warning",
      title: "About text not approved",
      message: `Your About text wasn't approved: ${reason}`,
      link: ACCOUNT_LINK,
    });
    return null;
  },
});
