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

  if (setting) {
    // Validate type compatibility before returning
    if (typeof setting.value === typeof defaultValue) {
      return setting.value as SettingsSchema[K];
    }
    console.warn(
      `System setting type mismatch for "${key}": expected ${typeof defaultValue}, got ${typeof setting.value}. Using default.`
    );
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
  returns: v.object({
    pagination: v.object({
      defaultLimit: v.object({
        current: v.number(),
        default: v.number(),
        key: v.string(),
      }),
      maxResultsCap: v.object({
        current: v.number(),
        default: v.number(),
        key: v.string(),
      }),
      equipmentMetadataLimit: v.object({
        current: v.number(),
        default: v.number(),
        key: v.string(),
      }),
      bidHistoryLimit: v.object({
        current: v.number(),
        default: v.number(),
        key: v.string(),
      }),
    }),
    dbSettings: v.array(
      v.object({
        _id: v.id("settings"),
        _creationTime: v.number(),
        key: v.string(),
        value: v.union(v.string(), v.number(), v.boolean()),
        description: v.optional(v.string()),
        updatedAt: v.number(),
      })
    ),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const dbSettings = await ctx.db.query("settings").collect();

    const [
      defaultLimit,
      maxResultsCap,
      equipmentMetadataLimit,
      bidHistoryLimit,
    ] = await Promise.all([
      getSetting(
        ctx,
        "pagination_default_limit",
        constants.PAGINATION_DEFAULT_LIMIT
      ),
      getSetting(ctx, "max_results_cap", constants.MAX_RESULTS_CAP),
      getSetting(
        ctx,
        "equipment_metadata_limit",
        constants.EQUIPMENT_METADATA_LIMIT
      ),
      getSetting(ctx, "bid_history_limit", constants.BID_HISTORY_LIMIT),
    ]);

    return {
      pagination: {
        defaultLimit: {
          current: defaultLimit,
          default: constants.PAGINATION_DEFAULT_LIMIT,
          key: "pagination_default_limit",
        },
        maxResultsCap: {
          current: maxResultsCap,
          default: constants.MAX_RESULTS_CAP,
          key: "max_results_cap",
        },
        equipmentMetadataLimit: {
          current: equipmentMetadataLimit,
          default: constants.EQUIPMENT_METADATA_LIMIT,
          key: "equipment_metadata_limit",
        },
        bidHistoryLimit: {
          current: bidHistoryLimit,
          default: constants.BID_HISTORY_LIMIT,
          key: "bid_history_limit",
        },
      },
      dbSettings,
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

    const expectedType = allowedKeys[args.key];
    if (typeof args.value !== expectedType) {
      throw new Error(
        `Invalid type for setting ${args.key}: expected ${expectedType}`
      );
    }

    // Numeric domain validation for limits
    if (expectedType === "number") {
      const val = args.value as number;
      if (!Number.isInteger(val) || val <= 0) {
        throw new Error(`Setting ${args.key} must be a positive integer`);
      }
      if (val > 5000) {
        throw new Error(`Setting ${args.key} cannot exceed 5000`);
      }
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
