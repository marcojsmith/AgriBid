import { v } from "convex/values";

import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { logAudit } from "./admin_utils";
import {
  cleanupDraftsHandler,
  settleExpiredLotsHandler,
} from "./auctions/internal";
import { CRON_JOBS, cronSettingKey, findCronJob } from "./cronRegistry";
import type { CronJobKey } from "./cronRegistry";
import { requireAdmin } from "./lib/auth";
import { sweepOrphanedUploadsHandler } from "./storageCleanup";

/**
 * Resolve whether a background job is enabled.
 *
 * Reads the job's `cron_enabled_<key>` setting; a missing or non-boolean row
 * falls back to the registry default.
 *
 * @param ctx - Query or mutation context
 * @param key - The job identifier
 * @returns True when the job should run
 */
export async function isCronJobEnabled(
  ctx: QueryCtx | MutationCtx,
  key: CronJobKey
): Promise<boolean> {
  const job = findCronJob(key);
  const setting = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", cronSettingKey(key)))
    .unique();
  if (typeof setting?.value === "boolean") return setting.value;
  return job?.defaultEnabled ?? false;
}

/**
 * Admin: list every toggleable background job with its enabled state.
 */
export const getCronJobs = query({
  args: {},
  returns: v.array(
    v.object({
      key: v.string(),
      label: v.string(),
      description: v.string(),
      schedule: v.string(),
      enabled: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await Promise.all(
      CRON_JOBS.map(async (job) => ({
        key: job.key,
        label: job.label,
        description: job.description,
        schedule: job.schedule,
        enabled: await isCronJobEnabled(ctx, job.key),
      }))
    );
  },
});

/**
 * Admin: switch a background job on or off.
 *
 * Takes effect on the job's next scheduled run. Audit-logged.
 */
export const setCronJobEnabled = mutation({
  args: { key: v.string(), enabled: v.boolean() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const job = findCronJob(args.key);
    if (!job) {
      throw new Error(`Unknown background job: ${args.key}`);
    }

    const settingKey = cronSettingKey(job.key);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", settingKey))
      .unique();

    if (existing) {
      await ctx.db.patch("settings", existing._id, {
        value: args.enabled,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        key: settingKey,
        value: args.enabled,
        description: `Whether the "${job.label}" background job runs`,
        updatedAt: Date.now(),
      });
    }

    await logAudit(ctx, {
      action: "UPDATE_SETTING",
      targetId: settingKey,
      targetType: "setting",
      details: `Set background job "${job.label}" to ${
        args.enabled ? "enabled" : "disabled"
      }`,
    });

    return { success: true };
  },
});

/**
 * Internal: switch every background job on or off at once.
 *
 * Intended for the CLI, e.g.
 * `bunx convex run cronJobs:setAllCronJobsEnabled '{"enabled":false}' --prod`.
 */
export const setAllCronJobsEnabled = internalMutation({
  args: { enabled: v.boolean() },
  returns: v.number(),
  handler: async (ctx, args) => {
    for (const job of CRON_JOBS) {
      const settingKey = cronSettingKey(job.key);
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", settingKey))
        .unique();
      if (existing) {
        await ctx.db.patch("settings", existing._id, {
          value: args.enabled,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("settings", {
          key: settingKey,
          value: args.enabled,
          description: `Whether the "${job.label}" background job runs`,
          updatedAt: Date.now(),
        });
      }
    }
    return CRON_JOBS.length;
  },
});

/**
 * Cron wrapper: settle expired lots unless the job is disabled.
 */
export const settleExpiredAuctions = internalMutation({
  args: {},
  returns: v.object({ settled: v.number(), hasMore: v.boolean() }),
  handler: async (ctx) => {
    if (!(await isCronJobEnabled(ctx, "settle_expired_auctions"))) {
      return { settled: 0, hasMore: false };
    }
    return await settleExpiredLotsHandler(ctx);
  },
});

/**
 * Cron wrapper: delete abandoned drafts unless the job is disabled.
 */
export const cleanupAbandonedDrafts = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), errors: v.number() }),
  handler: async (ctx) => {
    if (!(await isCronJobEnabled(ctx, "cleanup_abandoned_drafts"))) {
      return { deleted: 0, errors: 0 };
    }
    return await cleanupDraftsHandler(ctx);
  },
});

/**
 * Cron wrapper: clean up presence records unless the job is disabled.
 */
export const cleanupPresenceRecords = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!(await isCronJobEnabled(ctx, "cleanup_presence_records"))) {
      return null;
    }
    await ctx.runMutation(internal.presence.cleanup, {});
    return null;
  },
});

/**
 * Cron wrapper: sweep orphaned uploads unless the job is disabled.
 */
export const sweepOrphanedUploads = internalMutation({
  args: {},
  returns: v.object({ scanned: v.number(), deleted: v.number() }),
  handler: async (ctx) => {
    if (!(await isCronJobEnabled(ctx, "sweep_orphaned_uploads"))) {
      return { scanned: 0, deleted: 0 };
    }
    return await sweepOrphanedUploadsHandler(ctx);
  },
});

/**
 * Cron wrapper: reset mock data unless the job is disabled.
 */
export const weeklyMockDataReset = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!(await isCronJobEnabled(ctx, "weekly_mock_data_reset"))) {
      return null;
    }
    await ctx.runMutation(internal.seed.weeklyReset, {});
    return null;
  },
});

/**
 * Internal query used by the action wrapper below, since actions cannot read
 * the database directly.
 */
export const isJobEnabled = internalQuery({
  args: { key: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const job = findCronJob(args.key);
    if (!job) return false;
    return await isCronJobEnabled(ctx, job.key);
  },
});

/**
 * Cron wrapper: process error reports unless the job is disabled.
 */
export const processErrorReports = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const enabled: boolean = await ctx.runQuery(
      internal.cronJobs.isJobEnabled,
      { key: "process_error_reports" }
    );
    if (!enabled) return null;
    await ctx.runAction(internal.errors.processErrorReportsAction, {});
    return null;
  },
});
