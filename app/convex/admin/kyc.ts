/**
 * KYC (Know Your Customer) verification and review operations.
 *
 * Handles user identity verification, document review, and approval/rejection decisions.
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCallerRole } from "../users";
import { UnauthorizedError } from "../lib/auth";
import { logAudit, updateCounter } from "../admin_utils";

/**
 * Query pending KYC submissions for admin review.
 *
 * Returns a paginated list of profiles with pending verification status.
 * Only accessible to admin users.
 */
export const getPendingKYC = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("profiles"),
        _creationTime: v.number(),
        userId: v.string(),
        role: v.string(),
        kycStatus: v.optional(v.string()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new UnauthorizedError();

    // Use Convex pagination to properly handle cursor and limits
    // Only return minimal info for the list. Details are fetched on demand.
    const profilesResult = await ctx.db
      .query("profiles")
      .withIndex("by_kycStatus", (q) => q.eq("kycStatus", "pending"))
      .paginate(args.paginationOpts);

    return {
      ...profilesResult,
      page: profilesResult.page.map((p) => ({
        _id: p._id,
        _creationTime: p._creationTime,
        userId: p.userId,
        role: p.role,
        kycStatus: p.kycStatus,
      })),
    };
  },
});

/**
 * Review and approve or reject a KYC submission.
 *
 * @param userId - The user ID to review
 * @param decision - "approve" or "reject"
 * @param reason - Optional rejection reason (required if rejecting)
 *
 * On approval:
 * - Sets isVerified to true and kycStatus to "verified"
 * - Increments verified seller counter
 * - Sends success notification
 *
 * On rejection:
 * - Sets kycStatus to "rejected"
 * - Stores rejection reason
 * - Sends error notification with reason
 *
 * Only accessible to admin users.
 */
export const reviewKYC = mutation({
  args: {
    userId: v.string(),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    reason: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new UnauthorizedError();

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) throw new Error("Profile not found");

    const wasPending = profile.kycStatus === "pending";

    if (args.decision === "approve") {
      const wasVerified = profile.isVerified;

      await ctx.db.patch(profile._id, {
        kycStatus: "verified",
        isVerified: true,
        // clear any previous rejection reason and record update time
        kycRejectionReason: undefined,
        updatedAt: Date.now(),
      });

      if (!wasVerified) {
        await updateCounter(ctx, "profiles", "verified", 1);
      }
      if (wasPending) {
        await updateCounter(ctx, "profiles", "pending", -1);
      }

      // Send Success Notification
      await ctx.db.insert("notifications", {
        recipientId: args.userId,
        type: "success",
        title: "Verification Approved",
        message:
          "Your seller verification is complete. You can now list equipment.",
        link: "/kyc",
        isRead: false,
        createdAt: Date.now(),
      });
    } else {
      const reason = args.reason?.trim();
      if (!reason) {
        throw new Error("Rejection reason is required");
      }

      const wasVerified = profile.isVerified;

      await ctx.db.patch(profile._id, {
        kycStatus: "rejected",
        kycRejectionReason: reason,
        isVerified: false,
        updatedAt: Date.now(),
      });

      if (wasVerified) {
        await updateCounter(ctx, "profiles", "verified", -1);
      }
      if (wasPending) {
        await updateCounter(ctx, "profiles", "pending", -1);
      }
      // Send Rejection Notification
      await ctx.db.insert("notifications", {
        recipientId: args.userId,
        type: "error",
        title: "Verification Rejected",
        message: reason,
        link: "/kyc",
        isRead: false,
        createdAt: Date.now(),
      });
    }

    await logAudit(ctx, {
      action: `KYC_${args.decision.toUpperCase()}`,
      targetId: args.userId,
      targetType: "user",
      details: args.reason,
    });

    return { success: true };
  },
});
