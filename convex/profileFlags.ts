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
import { MS_PER_DAY } from "./constants";
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
    reason:
      | "fake_account"
      | "fraudulent_listings"
      | "abusive_behaviour"
      | "identity_misrepresentation"
      | "other";
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
    reason: v.union(
      v.literal("fake_account"),
      v.literal("fraudulent_listings"),
      v.literal("abusive_behaviour"),
      v.literal("identity_misrepresentation"),
      v.literal("other")
    ),
    details: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: reportProfileHandler,
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

  const uniqueReporterIds = Array.from(
    new Set(flags.map((f: Doc<"profileFlags">) => f.reporterId))
  );
  const reporterNames = new Map<string, string>();
  const uniqueReportedUserIds = Array.from(
    new Set(flags.map((f: Doc<"profileFlags">) => f.reportedUserId))
  );
  const reportedUserNames = new Map<string, string>();

  await Promise.all([
    ...uniqueReporterIds.map(async (reporterId) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", reporterId))
        .unique();
      reporterNames.set(reporterId, profile?.name ?? "Unknown User");
    }),
    ...uniqueReportedUserIds.map(async (reportedUserId) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", reportedUserId))
        .unique();
      reportedUserNames.set(reportedUserId, profile?.name ?? "Unknown User");
    }),
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
      reason: v.union(
        v.literal("fake_account"),
        v.literal("fraudulent_listings"),
        v.literal("abusive_behaviour"),
        v.literal("identity_misrepresentation"),
        v.literal("other")
      ),
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

  const flag = await ctx.db.get(args.flagId);
  if (!flag) {
    throw new ConvexError("Flag not found");
  }

  if (flag.status !== "pending") {
    throw new ConvexError("Flag has already been reviewed");
  }

  await ctx.db.patch(args.flagId, {
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
