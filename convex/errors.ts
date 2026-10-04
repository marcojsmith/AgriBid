import { v } from "convex/values";

import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getGitHubConfig, isGitHubReportingEnabled } from "./admin/settings";
import { getAuthUser, requireAdmin } from "./lib/auth";
import { internal } from "./_generated/api";
import { MAX_ERROR_REPORT_FIELD_LENGTH } from "./constants";
import {
  truncate,
  sanitizeText,
  sanitizeAdditionalInfo,
  sanitizeBreadcrumbMetadata,
} from "./lib/errorSanitization";
import {
  generateFingerprint,
  isServerValidationError,
} from "./lib/errorFingerprint";
import { checkRateLimit } from "./lib/errorRateLimit";
import {
  formatIssueBody,
  formatCommentBody,
} from "./lib/githubIssueFormatting";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 5;

export { generateFingerprint, sanitizeText, sanitizeAdditionalInfo };

/**
 * Handler for submitErrorReport.
 *
 * @param ctx - Convex Mutation context
 * @param args - Error report details
 * @param args.errorType - The type of error (e.g., "TypeError")
 * @param args.errorMessage - The user-friendly error message
 * @param args.stackTrace - Optional technical stack trace
 * @param args.userId - Optional ID of the user who encountered the error
 * @param args.userRole - Optional role of the user
 * @param args.additionalInfo - Optional additional context
 * @param args.breadcrumbs - Recent user actions leading to the error
 * @param args.metadata - Environment metadata (URL, user agent, etc.)
 * @param args.metadata.url - The URL where the error occurred
 * @param args.metadata.userAgent - The user agent string
 * @param args.metadata.timestamp - The client-side timestamp
 * @returns Status of the submission
 */
export async function submitErrorReportHandler(
  ctx: MutationCtx,
  args: {
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    userId?: string;
    userRole?: string;
    additionalInfo?: Record<string, string | number>;
    breadcrumbs: {
      timestamp: number;
      type: string;
      description: string;
      metadata?: Record<string, string | number>;
    }[];
    metadata: { url: string; userAgent: string; timestamp: number };
  }
) {
  const sanitizedBreadcrumbs = args.breadcrumbs.map(sanitizeBreadcrumbMetadata);
  const sanitizedErrorMessage = truncate(
    sanitizeText(args.errorMessage),
    MAX_ERROR_REPORT_FIELD_LENGTH
  );
  const sanitizedStackTrace = args.stackTrace
    ? truncate(sanitizeText(args.stackTrace), MAX_ERROR_REPORT_FIELD_LENGTH)
    : args.stackTrace;
  const sanitizedAdditionalInfo = sanitizeAdditionalInfo(args.additionalInfo);
  const authUser = await getAuthUser(ctx);
  const serverUserId = authUser?._id ?? null;

  if (isServerValidationError(sanitizedErrorMessage)) {
    return {
      success: false,
      isDuplicate: false,
      instanceCount: 0,
      reason: "validation_error",
    };
  }

  if (!(await checkRateLimit(ctx))) {
    return {
      success: false,
      isDuplicate: false,
      instanceCount: 0,
      reason: "rate_limited",
    };
  }

  const fingerprint = generateFingerprint(
    args.errorType,
    sanitizedErrorMessage,
    sanitizedStackTrace
  );
  const now = Date.now();
  const twentyFourHoursAgo = now - TWENTY_FOUR_HOURS_MS;

  const existingReports = await ctx.db
    .query("errorReports")
    .withIndex("by_fingerprint")
    .filter((q) => q.eq(q.field("fingerprint"), fingerprint))
    .collect();

  const existingReport = existingReports.find(
    (r) => r.lastOccurredAt >= twentyFourHoursAgo
  );

  if (existingReport) {
    await ctx.db.patch("errorReports", existingReport._id, {
      instanceCount: existingReport.instanceCount + 1,
      lastOccurredAt: now,
      userId: serverUserId ?? existingReport.userId,
      userRole: existingReport.userRole,
      additionalInfo: sanitizedAdditionalInfo ?? existingReport.additionalInfo,
      breadcrumbs: sanitizedBreadcrumbs.slice(-20),
      metadata: args.metadata,
    });
    return {
      success: true,
      isDuplicate: true,
      instanceCount: existingReport.instanceCount + 1,
    };
  }

  await ctx.db.insert("errorReports", {
    fingerprint,
    status: "pending",
    errorType: args.errorType,
    errorMessage: sanitizedErrorMessage,
    stackTrace: sanitizedStackTrace,
    userId: serverUserId ?? undefined,
    userRole: undefined,
    additionalInfo: sanitizedAdditionalInfo,
    breadcrumbs: sanitizedBreadcrumbs.slice(-20),
    metadata: args.metadata,
    githubIssueUrl: undefined,
    githubIssueNumber: undefined,
    instanceCount: 1,
    lastOccurredAt: now,
    createdAt: now,
    errorMessageNormalized: sanitizedErrorMessage
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 100),
  });

  return {
    success: true,
    isDuplicate: false,
    instanceCount: 1,
  };
}

/**
 * Submit an error report to the queue.
 *
 * This mutation checks for duplicate fingerprints within 24 hours and either
 * increments the instance count or creates a new pending report.
 */
export const submitErrorReport = mutation({
  args: {
    errorType: v.string(),
    errorMessage: v.string(),
    stackTrace: v.optional(v.string()),
    userId: v.optional(v.string()),
    userRole: v.optional(v.string()),
    additionalInfo: v.optional(
      v.record(v.string(), v.union(v.string(), v.number()))
    ),
    breadcrumbs: v.array(
      v.object({
        timestamp: v.number(),
        type: v.string(),
        description: v.string(),
        metadata: v.optional(
          v.record(v.string(), v.union(v.string(), v.number()))
        ),
      })
    ),
    metadata: v.object({
      url: v.string(),
      userAgent: v.string(),
      timestamp: v.number(),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    isDuplicate: v.boolean(),
    instanceCount: v.number(),
  }),
  handler: submitErrorReportHandler,
});

/**
 * Internal mutation to fetch pending reports and mark them as processing.
 */
export const getPendingReportsToProcess = internalMutation({
  args: {},
  handler: async (ctx) => {
    const pendingReports = await ctx.db
      .query("errorReports")
      .withIndex("by_status")
      .filter((r) => r.eq(r.field("status"), "pending" as const))
      .take(BATCH_SIZE);

    for (const report of pendingReports) {
      await ctx.db.patch("errorReports", report._id, { status: "processing" });
    }

    return pendingReports;
  },
});

/**
 * Internal mutation to update a report's status and GitHub information.
 */
export const updateReportStatus = internalMutation({
  args: {
    id: v.id("errorReports"),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    githubIssueUrl: v.optional(v.string()),
    githubIssueNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("errorReports", args.id, {
      status: args.status,
      githubIssueUrl: args.githubIssueUrl,
      githubIssueNumber: args.githubIssueNumber,
    });
  },
});

/**
 * Proxy query to check if GitHub reporting is enabled.
 */
export const isGitHubReportingEnabledProxy = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await isGitHubReportingEnabled(ctx);
  },
});

/**
 * Proxy query to get GitHub configuration.
 */
export const getGitHubConfigProxy = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await getGitHubConfig(ctx);
  },
});

/**
 * Handler for processErrorReports.
 * Maintained for backward compatibility and testing.
 *
 * @param ctx - Mutation context (mocked in tests)
 * @returns Summary of processing
 */
export async function processErrorReportsHandler(ctx: MutationCtx) {
  const enabled = await isGitHubReportingEnabled(ctx);
  if (!enabled) {
    return { processed: 0, created: 0, commented: 0, failed: 0 };
  }

  const githubConfig = await getGitHubConfig(ctx);
  if (
    !githubConfig.enabled ||
    !githubConfig.token ||
    !githubConfig.repoOwner ||
    !githubConfig.repoName
  ) {
    return { processed: 0, created: 0, commented: 0, failed: 0 };
  }

  const pendingReports = await ctx.db
    .query("errorReports")
    .withIndex("by_status")
    .filter((r) => r.eq(r.field("status"), "pending" as const))
    .take(BATCH_SIZE);

  let processed = 0;
  let created = 0;
  let commented = 0;
  let failed = 0;

  const apiUrl = `https://api.github.com/repos/${githubConfig.repoOwner}/${githubConfig.repoName}`;
  const headers = {
    Authorization: `Bearer ${githubConfig.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  for (const report of pendingReports) {
    await ctx.db.patch("errorReports", report._id, { status: "processing" });

    try {
      const isNewIssue = !report.githubIssueNumber;

      if (isNewIssue) {
        const issueBody = formatIssueBody(report);
        const response = await fetch(`${apiUrl}/issues`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: `[Production Error] ${report.errorType}: ${report.errorMessage.substring(0, 60)}`,
            body: issueBody,
            labels: (githubConfig.labels ?? "bug,auto-reported").split(","),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 403 || response.status === 429) {
            await ctx.db.patch("errorReports", report._id, {
              status: "pending",
            });
            failed++;
            continue;
          }
          throw new Error(
            `GitHub API error: ${String(response.status)} - ${errorText}`
          );
        }

        const issueData = (await response.json()) as {
          number: number;
          html_url: string;
        };
        await ctx.db.patch("errorReports", report._id, {
          status: "completed",
          githubIssueUrl: issueData.html_url,
          githubIssueNumber: issueData.number,
        });
        created++;
      } else if (report.githubIssueNumber) {
        const commentBody = formatCommentBody(report);
        const response = await fetch(
          `${apiUrl}/issues/${String(report.githubIssueNumber)}/comments`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              body: commentBody,
            }),
          }
        );

        if (response.status === 403 || response.status === 429) {
          await ctx.db.patch("errorReports", report._id, { status: "pending" });
          failed++;
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `GitHub API error: ${String(response.status)} - ${errorText}`
          );
        }

        await ctx.db.patch("errorReports", report._id, {
          status: "completed",
        });
        commented++;
      }

      processed++;
    } catch (error) {
      console.error("Error processing GitHub issue:", error);
      await ctx.db.patch("errorReports", report._id, { status: "failed" });
      failed++;
    }
  }

  return { processed, created, commented, failed };
}

/**
 * Process pending error reports and create GitHub issues.
 * This is an action because it performs external fetch() calls.
 */
export const processErrorReportsAction = internalAction({
  args: {},
  handler: async (ctx) => {
    const enabled = await ctx.runQuery(
      internal.errors.isGitHubReportingEnabledProxy
    );
    if (!enabled) {
      console.warn("GitHub error reporting not enabled, skipping processing");
      return { processed: 0, created: 0, commented: 0, failed: 0 };
    }

    const githubConfig = (await ctx.runQuery(
      internal.errors.getGitHubConfigProxy
    )) as {
      enabled: boolean;
      token: string | null;
      repoOwner: string | null;
      repoName: string | null;
      labels: string | null;
    };

    if (
      !githubConfig.enabled ||
      !githubConfig.token ||
      !githubConfig.repoOwner ||
      !githubConfig.repoName
    ) {
      console.warn("GitHub reporting not configured, skipping processing");
      return { processed: 0, created: 0, commented: 0, failed: 0 };
    }

    const pendingReports = await ctx.runMutation(
      internal.errors.getPendingReportsToProcess
    );

    let processed = 0;
    let created = 0;
    let commented = 0;
    let failed = 0;

    const apiUrl = `https://api.github.com/repos/${githubConfig.repoOwner}/${githubConfig.repoName}`;
    const headers = {
      Authorization: `Bearer ${githubConfig.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };

    for (const report of pendingReports) {
      try {
        const isNewIssue = !report.githubIssueNumber;

        if (isNewIssue) {
          const issueBody = formatIssueBody(report);
          const response = await fetch(`${apiUrl}/issues`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              title: `[Production Error] ${report.errorType}: ${report.errorMessage.substring(0, 60)}`,
              body: issueBody,
              labels: (githubConfig.labels ?? "bug,auto-reported").split(","),
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 403 || response.status === 429) {
              console.warn("GitHub API rate limited, will retry later");
              await ctx.runMutation(internal.errors.updateReportStatus, {
                id: report._id,
                status: "pending",
              });
              failed++;
              continue;
            }
            throw new Error(
              `GitHub API error: ${String(response.status)} - ${errorText}`
            );
          }

          const issueData = (await response.json()) as {
            number: number;
            html_url: string;
          };
          await ctx.runMutation(internal.errors.updateReportStatus, {
            id: report._id,
            status: "completed",
            githubIssueUrl: issueData.html_url,
            githubIssueNumber: issueData.number,
          });
          created++;
        } else if (report.githubIssueNumber) {
          const commentBody = formatCommentBody(report);
          const response = await fetch(
            `${apiUrl}/issues/${String(report.githubIssueNumber)}/comments`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                body: commentBody,
              }),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 403 || response.status === 429) {
              console.warn(
                "GitHub API rate limited for comments, will retry later"
              );
              await ctx.runMutation(internal.errors.updateReportStatus, {
                id: report._id,
                status: "pending",
              });
              failed++;
              continue;
            }
            throw new Error(
              `GitHub API error: ${String(response.status)} - ${errorText}`
            );
          }

          await ctx.runMutation(internal.errors.updateReportStatus, {
            id: report._id,
            status: "completed",
          });
          commented++;
        }

        processed++;
      } catch (error) {
        console.error("Error processing GitHub issue:", error);
        await ctx.runMutation(internal.errors.updateReportStatus, {
          id: report._id,
          status: "failed",
        });
        failed++;
      }
    }

    return { processed, created, commented, failed };
  },
});

/**
 * Handler for getErrorReports.
 *
 * @param ctx - Convex Query context
 * @param args - Status and limit
 * @param args.status - Filter by status
 * @param args.limit - Maximum number of reports to return
 * @returns Paginated reports
 */
export async function getErrorReportsHandler(
  ctx: QueryCtx,
  args: {
    status?: "pending" | "processing" | "completed" | "failed";
    limit?: number;
  }
) {
  await requireAdmin(ctx);

  let q = ctx.db.query("errorReports");

  if (args.status) {
    q = q.filter((r) => r.eq(r.field("status"), args.status));
  }

  const reports = await q.order("desc").take(args.limit ?? 50);

  return {
    reports: reports.map((r) => ({
      _id: r._id,
      _creationTime: r._creationTime,
      fingerprint: r.fingerprint,
      status: r.status,
      errorType: r.errorType,
      errorMessage: r.errorMessage,
      userId: r.userId,
      userRole: r.userRole,
      instanceCount: r.instanceCount,
      lastOccurredAt: r.lastOccurredAt,
      githubIssueUrl: r.githubIssueUrl,
      githubIssueNumber: r.githubIssueNumber,
    })),
  };
}

/**
 * Get paginated error reports (admin only).
 */
export const getErrorReports = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await getErrorReportsHandler(ctx, args);
  },
});

/**
 * Handler for getErrorReportStats.
 *
 * @param ctx - Convex Query context
 * @returns Statistics
 */
export async function getErrorReportStatsHandler(ctx: QueryCtx) {
  await requireAdmin(ctx);

  const allReports = await ctx.db.query("errorReports").collect();

  return {
    pending: allReports.filter((r) => r.status === "pending").length,
    processing: allReports.filter((r) => r.status === "processing").length,
    completed: allReports.filter((r) => r.status === "completed").length,
    failed: allReports.filter((r) => r.status === "failed").length,
    total: allReports.length,
  };
}

/**
 * Get error report statistics (admin only).
 */
export const getErrorReportStats = query({
  args: {},
  handler: getErrorReportStatsHandler,
});
