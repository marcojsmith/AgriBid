import { v } from "convex/values";
import { mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getGitHubHeaders, getRepoOwnerAndName, GITHUB_API_ENABLED } from "./github_config";

function normalizeMessage(msg: string) {
  return msg.replace(/\s+/g, " ").trim().toLowerCase();
}

async function computeFingerprint(errorType: string, message: string, topFrame?: { file?: string; fn?: string }) {
  const encoder = new TextEncoder();
  const parts = [errorType, normalizeMessage(message), topFrame?.file ?? "", topFrame?.fn ?? ""].join("|");
  const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(parts));
  const arr = Array.from(new Uint8Array(hashBuf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseTopFrame(stack?: string) {
  if (!stack) return undefined;
  const lines = stack.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const atMatch = line.match(/at\s+(.*?)\s+\((.*?):\d+/);
    if (atMatch) {
      return { fn: atMatch[1], file: atMatch[2] };
    }
    const altMatch = line.match(/(.*?)@(.+?):\d+/);
    if (altMatch) {
      return { fn: altMatch[1], file: altMatch[2] };
    }
  }
  return undefined;
}

export const submitErrorReport = mutation({
  args: {
    errorType: v.string(),
    message: v.string(),
    stackTrace: v.optional(v.string()),
    userContext: v.optional(
      v.object({ userId: v.optional(v.string()), role: v.optional(v.string()), kycStatus: v.optional(v.string()) }),
    ),
    breadcrumbs: v.optional(v.array(v.object({ timestamp: v.number(), type: v.string(), description: v.string(), metadata: v.optional(v.string()) }))),
    metadata: v.object({ browser: v.optional(v.string()), url: v.optional(v.string()), timestamp: v.number() }),
  },
  handler: async (ctx: MutationCtx, args) => {
    try {
      const top = parseTopFrame(args.stackTrace);
      const fingerprint = await computeFingerprint(args.errorType, args.message, top);

      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const existing = await ctx.db.query("errorReports").withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint)).collect();

      for (const e of existing) {
        if (e.status === "completed" && e.createdAt >= dayAgo) {
          await ctx.db.insert("errorReports", {
            status: "duplicate",
            fingerprint,
            errorType: args.errorType,
            message: args.message,
            stackTrace: args.stackTrace,
            userContext: args.userContext ?? {},
            breadcrumbs: args.breadcrumbs ?? [],
            metadata: args.metadata,
            githubIssueUrl: e.githubIssueUrl,
            retryCount: 0,
            lastError: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          return { status: "duplicate", fingerprint, githubIssueUrl: e.githubIssueUrl };
        }
      }

      const inserted = await ctx.db.insert("errorReports", {
        status: "pending",
        fingerprint,
        errorType: args.errorType,
        message: args.message,
        stackTrace: args.stackTrace,
        userContext: args.userContext ?? {},
        breadcrumbs: args.breadcrumbs ?? [],
        metadata: args.metadata,
        githubIssueUrl: undefined,
        retryCount: 0,
        lastError: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // ctx.db.insert returns the Id for the inserted document
      return { status: "pending", id: inserted, fingerprint };
    } catch (err) {
      console.error("submitErrorReport failed", err);
      return { status: "error", message: err instanceof Error ? err.message : String(err) };
    }
  },
});

export const createGitHubIssue = internalAction({
  args: { title: v.string(), body: v.string(), labels: v.optional(v.array(v.string())) },
  handler: async (_ctx, args) => {
    if (!GITHUB_API_ENABLED) {
      throw new Error("GitHub API disabled");
    }

    const headers = getGitHubHeaders();
    const { owner, repo } = getRepoOwnerAndName();

    const payload = {
      title: args.title,
      body: args.body,
      labels: args.labels ?? ["bug", "auto-reported", "production"],
    };

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: headers.Authorization,
        Accept: headers.Accept,
        "X-GitHub-Api-Version": headers["X-GitHub-Api-Version"],
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 403 || res.status === 429) {
      const details = await res.text().catch(() => "");
      const err = new Error(`RETRYABLE: GitHub rate limited: ${res.status} ${details}`);
      (err as Record<string, unknown>).retryable = true;
      throw err;
    }

    if (!res.ok) {
      const details = await res.text().catch(() => "");
      throw new Error(`GitHub issue creation failed: ${res.status} ${details}`);
    }

    const body = await res.json();
    return { issueUrl: body.html_url };
  },
});

// Internal query to fetch pending reports (limit 5)
export const fetchPendingReports = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("errorReports"),
      _creationTime: v.number(),
      status: v.string(),
      fingerprint: v.string(),
      errorType: v.optional(v.string()),
      message: v.optional(v.string()),
      stackTrace: v.optional(v.string()),
      userContext: v.optional(v.object({ userId: v.optional(v.string()), role: v.optional(v.string()), kycStatus: v.optional(v.string()) })),
      breadcrumbs: v.optional(v.array(v.object({ timestamp: v.number(), type: v.string(), description: v.string(), metadata: v.optional(v.string()) }))),
      metadata: v.optional(v.object({ browser: v.optional(v.string()), url: v.optional(v.string()), timestamp: v.number() })),
      retryCount: v.optional(v.number()),
    }),
  ),
  handler: async (ctx: QueryCtx) => {
    return await ctx.db.query("errorReports").withIndex("by_status", (q) => q.eq("status", "pending")).order("asc").take(5);
  },
});

export const markReportProcessing = internalMutation({
  args: { reportId: v.id("errorReports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, { status: "processing", updatedAt: Date.now() });
    return null;
  },
});

export const markReportCompleted = internalMutation({
  args: { reportId: v.id("errorReports"), issueUrl: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, { status: "completed", githubIssueUrl: args.issueUrl, updatedAt: Date.now() });
    return null;
  },
});

export const markReportRetry = internalMutation({
  args: { reportId: v.id("errorReports"), lastError: v.string(), retryCount: v.number(), setFailed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.setFailed) {
      await ctx.db.patch(args.reportId, { retryCount: args.retryCount, status: "failed", lastError: args.lastError, updatedAt: Date.now() });
    } else {
      await ctx.db.patch(args.reportId, { retryCount: args.retryCount, status: "pending", lastError: args.lastError, updatedAt: Date.now() });
    }
    return null;
  },
});

export const processPendingErrorReports = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const pending = await ctx.runQuery(internal.errors.fetchPendingReports, {});

    for (const report of pending) {
      await ctx.runMutation(internal.errors.markReportProcessing, { reportId: report._id });

      try {
        const title = `[Auto] ${report.errorType}: ${(report.message || "").slice(0, 120)}`;
        let body = `Error Summary:\n${report.message || ""}\n\n`;
        if (report.stackTrace) body += `Stack Trace:\n\n`;
        if (report.stackTrace) body += "```\n" + (report.stackTrace.slice(0, 2000)) + "\n```\n\n";
        body += `User Context:\n${JSON.stringify(report.userContext || {}, null, 2)}\n\n`;
        body += `Recent Actions (breadcrumbs):\n${(report.breadcrumbs || []).map((b: Record<string, unknown>) => `- [${new Date(b.timestamp as number).toISOString()}] ${b.type}: ${b.description}`).join('\n')}\n\n`;
        body += `Environment:\n${JSON.stringify(report.metadata || {}, null, 2)}\n`;

        const gh = await ctx.runAction(internal.errors.createGitHubIssue, { title, body, labels: ["bug", "auto-reported", "production"] });

        await ctx.runMutation(internal.errors.markReportCompleted, { reportId: report._id, issueUrl: gh.issueUrl });
      } catch (err) {
        const last = err instanceof Error ? err.message : String(err);
        const nextRetry = (report.retryCount || 0) + 1;
        const setFailed = nextRetry > 3;
        await ctx.runMutation(internal.errors.markReportRetry, { reportId: report._id, lastError: last, retryCount: nextRetry, setFailed });
      }
    }

    return null;
  },
});
