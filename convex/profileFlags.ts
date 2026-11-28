import { v, ConvexError } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  requireAdmin,
  getAuthenticatedUserId,
  getCallerRole,
  getAuthUser,
  resolveUserId,
} from "./lib/auth";
import { logAudit } from "./admin_utils";
import { resolveDisplayNames } from "./lib/userNames";
import {
  MS_PER_DAY,
  MAX_FLAG_DETAILS_LENGTH,
  PROFILE_REPORT_RATE_LIMIT_WINDOW_MS,
  MAX_PROFILE_REPORTS_PER_WINDOW,
} from "./constants";
import {
  profileFlagReasonValidator,
  profileReportReasonValidator,
  type ProfileReportReason,
} from "./lib/reportReasons";
import { resolvePublicSeller } from "./lib/sellerLookup";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Window (in milliseconds) during which a reporter with an existing pending
 * report against the same user cannot submit another one.
 */
const PROFILE_REPORT_DUPLICATE_WINDOW_MS = 30 * MS_PER_DAY;

/**
 * Handler for reporting a user profile.
 * Rejects self-reports, reports against non-existent profiles, and duplicate
 * pending reports by the same caller within the last 30 days.
 *
 * @param ctx - Mutation context
 * @param args - Arguments for reporting a profile
 * @param args.reportedUserId - The userId of the profile being reported
 * @param args.reason - The reason for reporting
 * @param args.details - Optional additional details
 * @returns Object with success boolean
 */
export const reportProfileHandler = async (
  ctx: MutationCtx,
  args: {
    reportedUserId: string;
    reason: ProfileReportReason;
    details?: string;
  }
) => {
  const reporterId = await getAuthenticatedUserId(ctx);

  if (args.reportedUserId === reporterId) {
    throw new ConvexError("You cannot report your own profile");
  }

  const reportedProfile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", args.reportedUserId))
    .unique();

  if (!reportedProfile) {
    throw new ConvexError("Profile not found");
  }

  const existingReports = await ctx.db
    .query("profileFlags")
    .withIndex("by_reporter", (q) => q.eq("reporterId", reporterId))
    .collect();

  const userHasReported = existingReports.some(
    (report) =>
      report.reportedUserId === args.reportedUserId &&
      report.status === "pending" &&
      Date.now() - report.createdAt < PROFILE_REPORT_DUPLICATE_WINDOW_MS
  );

  if (userHasReported) {
    throw new ConvexError("You have already reported this profile");
  }

  // Length cap on details
  if (args.details !== undefined) {
    const trimmedDetails = args.details.trim();
    if (trimmedDetails.length > MAX_FLAG_DETAILS_LENGTH) {
      throw new ConvexError(
        `Details is too long. Maximum ${MAX_FLAG_DETAILS_LENGTH.toString()} characters allowed.`
      );
    }
  }

  // Rate limiting: max MAX_PROFILE_REPORTS_PER_WINDOW per PROFILE_REPORT_RATE_LIMIT_WINDOW_MS
  const now = Date.now();
  const windowStart = now - PROFILE_REPORT_RATE_LIMIT_WINDOW_MS;
  const recentReports = await ctx.db
    .query("profileFlags")
    .withIndex("by_reporter_createdAt", (q) =>
      q.eq("reporterId", reporterId).gte("createdAt", windowStart)
    )
    .collect();
  if (recentReports.length >= MAX_PROFILE_REPORTS_PER_WINDOW) {
    throw new ConvexError(
      "You're submitting reports too quickly. Please wait before submitting another report."
    );
  }

  await ctx.db.insert("profileFlags", {
    reportedUserId: args.reportedUserId,
    reporterId,
    reason: args.reason,
    details: args.details,
    status: "pending",
    createdAt: Date.now(),
  });

  return { success: true };
};

export const reportProfile = mutation({
  args: {
    reportedUserId: v.string(),
    reason: profileReportReasonValidator,
    details: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: reportProfileHandler,
});

/**
 * Handler for reporting a seller from their public page, addressed by slug.
 * Resolves the slug (current or renamed) and applies the same rules as
 * {@link reportProfileHandler}: no self-report, one pending report per reporter
 * per 30 days, and the report rate limit.
 *
 * @param ctx - Mutation context
 * @param args - Arguments for reporting a seller
 * @param args.slug - The seller's page slug
 * @param args.reason - The reason for reporting
 * @param args.details - Optional additional details
 * @returns Object with success boolean
 */
export const reportSellerBySlugHandler = async (
  ctx: MutationCtx,
  args: { slug: string; reason: ProfileReportReason; details?: string }
) => {
  // Sign-in first, so a signed-out caller learns nothing about which slugs exist.
  await getAuthenticatedUserId(ctx);

  // Same lookup as the public page: a slug whose page is "not found" cannot be reported.
  const resolved = await resolvePublicSeller(ctx, args.slug);
  if (!resolved) {
    throw new ConvexError("Seller not found");
  }
  const { profile } = resolved;

  return await reportProfileHandler(ctx, {
    reportedUserId: profile.userId,
    reason: args.reason,
    details: args.details,
  });
};

export const reportSellerBySlug = mutation({
  args: {
    slug: v.string(),
    reason: profileReportReasonValidator,
    details: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: reportSellerBySlugHandler,
});

/**
 * Returns all pending profile reports with reporter and reported user display
 * names attached (admin only).
 *
 * @param ctx - Convex Query context
 * @returns Array of pending profile reports with reporter and reported user names
 */
export const getAllPendingProfileFlagsHandler = async (ctx: QueryCtx) => {
  await requireAdmin(ctx);

  const flags = await ctx.db
    .query("profileFlags")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .order("desc")
    .collect();

  const [reporterNames, reportedUserNames] = await Promise.all([
    resolveDisplayNames(
      ctx,
      flags.map((f: Doc<"profileFlags">) => f.reporterId)
    ),
    resolveDisplayNames(
      ctx,
      flags.map((f: Doc<"profileFlags">) => f.reportedUserId)
    ),
  ]);

  return flags.map((flag: Doc<"profileFlags">) => ({
    ...flag,
    reporterName: reporterNames.get(flag.reporterId) ?? "Unknown Reporter",
    reportedUserName:
      reportedUserNames.get(flag.reportedUserId) ?? "Unknown User",
  }));
};

/**
 * Query: Get all pending profile reports (admin only).
 * Args: (none)
 *
 * @returns Array of pending profile reports with reporter and reported user names
 */
export const getAllPendingProfileFlags = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("profileFlags"),
      _creationTime: v.number(),
      reportedUserId: v.string(),
      reporterId: v.string(),
      // Includes the retired reasons that old reports still carry.
      reason: profileFlagReasonValidator,
      details: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("reviewed"),
        v.literal("dismissed")
      ),
      adminNotes: v.optional(v.string()),
      createdAt: v.number(),
      reporterName: v.string(),
      reportedUserName: v.string(),
    })
  ),
  handler: getAllPendingProfileFlagsHandler,
});

/**
 * Review a pending profile report (admin only).
 * Marks the report as reviewed or dismissed, optionally attaching admin notes.
 * @param ctx - The mutation context.
 * @param args - The arguments for reviewing a profile report.
 * @param args.flagId - The ID of the profile report to review
 * @param args.status - The new status ("reviewed" or "dismissed")
 * @param args.adminNotes - Optional admin notes
 * @returns Promise<{ success: boolean }>
 */
export const reviewProfileFlagHandler = async (
  ctx: MutationCtx,
  args: {
    flagId: Id<"profileFlags">;
    status: "reviewed" | "dismissed";
    adminNotes?: string;
  }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new Error("Not authorized: Admin privileges required");
  }

  const flag = await ctx.db.get("profileFlags", args.flagId);
  if (!flag) {
    throw new ConvexError("Flag not found");
  }

  if (flag.status !== "pending") {
    throw new ConvexError("Flag has already been reviewed");
  }

  await ctx.db.patch("profileFlags", args.flagId, {
    status: args.status,
    adminNotes: args.adminNotes,
  });

  const authUser = await getAuthUser(ctx);
  const adminId = authUser ? resolveUserId(authUser) : "unknown";

  await logAudit(ctx, {
    action: "REVIEW_PROFILE_FLAG",
    targetId: args.flagId,
    targetType: "profileFlag",
    details: JSON.stringify({
      adminId,
      reportedUserId: flag.reportedUserId,
      reason: flag.reason,
      status: args.status,
      adminNotes: args.adminNotes,
    }),
  });

  return { success: true };
};

export const reviewProfileFlag = mutation({
  args: {
    flagId: v.id("profileFlags"),
    status: v.union(v.literal("reviewed"), v.literal("dismissed")),
    adminNotes: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: reviewProfileFlagHandler,
});
