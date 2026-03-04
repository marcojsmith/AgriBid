import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { logAudit } from "../admin_utils";
import * as constants from "../constants";

type SettingsSchema = {
  pagination_default_limit: number;
  max_results_cap: number;
  equipment_metadata_limit: number;
  bid_history_limit: number;
};

type SettingsKey = keyof SettingsSchema;

/**
 * Fetch a specific system setting by key.
 *
 * Falls back to hardcoded constants if the setting is not found in the database.
 */
export async function getSetting<K extends SettingsKey>(
  ctx: QueryCtx,
  key: K,
  defaultValue: SettingsSchema[K]
): Promise<SettingsSchema[K]> {
  const setting = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key as string))
    .unique();

  if (setting && typeof setting.value === typeof defaultValue) {
    return setting.value as SettingsSchema[K];
  }

  return defaultValue;
}

/**
 * Query all system settings.
 *
 * Returns both database-stored settings and hardcoded defaults for comparison.
 * Only accessible to admin users.
 */
export const getSystemConfig = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const dbSettings = await ctx.db.query("settings").collect();

    // Map of current settings for easy lookup
    const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));

    return {
      pagination: {
        defaultLimit: {
          current:
            settingsMap.get("pagination_default_limit") ??
            constants.PAGINATION_DEFAULT_LIMIT,
          default: constants.PAGINATION_DEFAULT_LIMIT,
          key: "pagination_default_limit",
        },
        maxResultsCap: {
          current:
            settingsMap.get("max_results_cap") ?? constants.MAX_RESULTS_CAP,
          default: constants.MAX_RESULTS_CAP,
          key: "max_results_cap",
        },
        equipmentMetadataLimit: {
          current:
            settingsMap.get("equipment_metadata_limit") ??
            constants.EQUIPMENT_METADATA_LIMIT,
          default: constants.EQUIPMENT_METADATA_LIMIT,
          key: "equipment_metadata_limit",
        },
        bidHistoryLimit: {
          current:
            settingsMap.get("bid_history_limit") ?? constants.BID_HISTORY_LIMIT,
          default: constants.BID_HISTORY_LIMIT,
          key: "bid_history_limit",
        },
      },
      dbSettings, // Raw settings for management
    };
  },
});

/**
 * Update or create a system setting.
 *
 * Logs the action for audit.
 * Only accessible to admin users.
 */
export const updateSystemConfig = mutation({
  args: {
    key: v.string(),
    value: v.union(v.string(), v.number(), v.boolean()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const allowedKeys: Record<string, "string" | "number" | "boolean"> = {
      pagination_default_limit: "number",
      max_results_cap: "number",
      equipment_metadata_limit: "number",
      bid_history_limit: "number",
    };

    if (!(args.key in allowedKeys)) {
      throw new Error(`Invalid setting key: ${args.key}`);
    }
    if (typeof args.value !== allowedKeys[args.key]) {
      throw new Error(
        `Invalid type for setting ${args.key}: expected ${allowedKeys[args.key]}`
      );
    }

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        description: args.description ?? existing.description,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        key: args.key,
        value: args.value,
        description: args.description,
        updatedAt: Date.now(),
      });
    }

    await logAudit(ctx, {
      action: "UPDATE_SETTING",
      targetId: args.key,
      targetType: "setting",
      details: `Updated ${args.key} to ${args.value}`,
    });

    return { success: true };
  },
});
