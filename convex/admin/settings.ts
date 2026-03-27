import { v } from "convex/values";

import { mutation, query } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { logAudit, decryptPII, encryptPII } from "../admin_utils";
import * as constants from "../constants";

interface SettingsSchema {
  pagination_default_limit: number;
  max_results_cap: number;
  equipment_metadata_limit: number;
  bid_history_limit: number;
  github_error_reporting_enabled: boolean;
  github_api_token: string;
  github_repo_owner: string;
  github_repo_name: string;
  github_error_labels: string;
}

interface GitHubConfig {
  enabled: boolean;
  token: string | null;
  repoOwner: string | null;
  repoName: string | null;
  labels: string | null;
}

type SettingsKey = keyof SettingsSchema;

/**
 * Fetch a specific system setting by key.
 *
 * Falls back to hardcoded constants if the setting is not found in the database.
 * @param ctx - Convex Query context
 * @param key - The unique identifier/key of the setting to retrieve
 * @param defaultValue - Fallback value to return if the setting is missing or invalid
 * @returns The resolved setting value or the provided default.
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
 * Fetch GitHub configuration for error reporting.
 *
 * @param ctx - Convex Query context
 * @returns GitHub config object with enabled flag and settings (token is decrypted if present)
 */
export async function getGitHubConfig(ctx: QueryCtx): Promise<GitHubConfig> {
  const [
    enabledSetting,
    tokenSetting,
    repoOwnerSetting,
    repoNameSetting,
    labelsSetting,
  ] = await Promise.all([
    ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "github_error_reporting_enabled"))
      .unique(),
    ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "github_api_token"))
      .unique(),
    ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "github_repo_owner"))
      .unique(),
    ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "github_repo_name"))
      .unique(),
    ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "github_error_labels"))
      .unique(),
  ]);

  const enabled = enabledSetting?.value === true;

  let decryptedToken: string | null = null;
  if (tokenSetting?.value && typeof tokenSetting.value === "string") {
    try {
      const decrypted = await decryptPII(tokenSetting.value);
      decryptedToken = decrypted ?? null;
    } catch {
      console.warn("Failed to decrypt GitHub API token");
    }
  }

  return {
    enabled,
    token: decryptedToken,
    repoOwner:
      typeof repoOwnerSetting?.value === "string"
        ? repoOwnerSetting.value
        : null,
    repoName:
      typeof repoNameSetting?.value === "string" ? repoNameSetting.value : null,
    labels:
      typeof labelsSetting?.value === "string"
        ? labelsSetting.value
        : "bug,auto-reported",
  };
}

/**
 * Check if GitHub error reporting is enabled.
 *
 * @param ctx - Convex Query context
 * @returns True if enabled, false otherwise
 */
export async function isGitHubReportingEnabled(
  ctx: QueryCtx
): Promise<boolean> {
  const config = await getGitHubConfig(ctx);
  return (
    config.enabled &&
    config.token !== null &&
    config.repoOwner !== null &&
    config.repoName !== null
  );
}

/**
 * Handler for getSystemConfig.
 *
 * @param ctx - Convex Query context
 * @returns Full system configuration
 */
export async function getSystemConfigHandler(ctx: QueryCtx) {
  await requireAdmin(ctx);

  const dbSettings = await ctx.db.query("settings").collect();
  const githubConfig = await getGitHubConfig(ctx);

  const sensitiveKeys = ["github_api_token"];
  const filteredDbSettings = dbSettings.map((setting) => {
    if (sensitiveKeys.includes(setting.key)) {
      return { ...setting, value: "***REDACTED***" as const };
    }
    return setting;
  });

  const [defaultLimit, maxResultsCap, equipmentMetadataLimit, bidHistoryLimit] =
    await Promise.all([
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
    dbSettings: filteredDbSettings,
    githubConfig: {
      enabled: githubConfig.enabled,
      tokenMasked: githubConfig.token
        ? `****${githubConfig.token.slice(-4)}`
        : "",
      repoOwner: githubConfig.repoOwner,
      repoName: githubConfig.repoName,
      labels: githubConfig.labels ?? "bug,auto-reported",
    },
  };
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
    githubConfig: v.object({
      enabled: v.boolean(),
      tokenMasked: v.string(),
      repoOwner: v.union(v.string(), v.null()),
      repoName: v.union(v.string(), v.null()),
      labels: v.union(v.string(), v.null()),
    }),
  }),
  handler: getSystemConfigHandler,
});

/**
 * Handler for updateSystemConfig.
 *
 * @param ctx - Convex Mutation context
 * @param args - Key, value, and optional description
 * @param args.key - The unique identifier/key of the setting to update
 * @param args.value - The new value for the setting
 * @param args.description - Optional documentation for what this setting controls
 * @returns Success object
 */
export async function updateSystemConfigHandler(
  ctx: MutationCtx,
  args: {
    key: string;
    value: string | number | boolean;
    description?: string;
  }
) {
  await requireAdmin(ctx);

  if (args.key.startsWith("github_")) {
    throw new Error(
      "Use updateGitHubErrorReportingConfig for GitHub error-reporting settings"
    );
  }

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

  const finalValue: string | number | boolean = args.value;

  const existing = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", args.key))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      value: finalValue,
      description: args.description ?? existing.description,
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("settings", {
      key: args.key,
      value: finalValue,
      description: args.description,
      updatedAt: Date.now(),
    });
  }

  const sensitiveKeyPattern = /token|secret|password/i;
  const maskedValue = sensitiveKeyPattern.test(args.key)
    ? "***"
    : String(args.value);

  await logAudit(ctx, {
    action: "UPDATE_SETTING",
    targetId: args.key,
    targetType: "setting",
    details: `Updated ${args.key} to ${maskedValue}`,
  });

  return { success: true };
}

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
  handler: updateSystemConfigHandler,
});

type GitHubErrorReportingConfig = {
  enabled: boolean;
  token?: string;
  repoOwner: string;
  repoName: string;
  labels: string;
};

/**
 * Updates the GitHub error reporting configuration.
 *
 * @param ctx - The mutation context.
 * @param args - The configuration arguments.
 * @returns An object indicating success.
 */
export async function updateGitHubErrorReportingConfigHandler(
  ctx: MutationCtx,
  args: GitHubErrorReportingConfig
): Promise<{ success: boolean }> {
  await requireAdmin(ctx);

  const repoOwner = args.repoOwner.trim();
  const repoName = args.repoName.trim();

  // If enabling, validate that we have all required fields
  if (args.enabled) {
    if (!repoOwner || !repoName) {
      throw new Error(
        "Repository owner and name are required when enabling GitHub error reporting"
      );
    }

    // Check if a new token is provided
    const hasNewToken =
      args.token && !args.token.startsWith("****") && args.token.trim() !== "";

    if (!hasNewToken) {
      // No new token, check if we have an existing stored token
      const existingTokenSetting = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "github_api_token"))
        .unique();

      if (!existingTokenSetting || !existingTokenSetting.value) {
        throw new Error(
          "GitHub API token is required when enabling error reporting"
        );
      }
    }
  }

  const settingsToUpdate: Array<{
    key: string;
    value: string | boolean;
  }> = [
    { key: "github_error_reporting_enabled", value: args.enabled },
    { key: "github_repo_owner", value: repoOwner },
    { key: "github_repo_name", value: repoName },
    { key: "github_error_labels", value: args.labels.trim() },
  ];

  if (
    args.token &&
    !args.token.startsWith("****") &&
    args.token.trim() !== ""
  ) {
    const encrypted = await encryptPII(args.token);
    if (!encrypted) {
      throw new Error("Failed to encrypt GitHub token. Operation aborted.");
    }
    settingsToUpdate.push({ key: "github_api_token", value: encrypted });
  }

  for (const setting of settingsToUpdate) {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", setting.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: setting.value,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        key: setting.key,
        value: setting.value,
        description: "",
        updatedAt: Date.now(),
      });
    }
  }

  await logAudit(ctx, {
    action: "UPDATE_GITHUB_ERROR_REPORTING_CONFIG",
    targetId: "github-error-reporting",
    targetType: "settings",
    details: `Updated GitHub error reporting config: enabled=${args.enabled}, repo=${args.repoOwner}/${args.repoName}`,
  });

  return { success: true };
}

/**
 * Update GitHub error reporting configuration atomically.
 *
 * Updates all GitHub-related settings in a single transaction.
 * Only accessible to admin users.
 */
export const updateGitHubErrorReportingConfig = mutation({
  args: {
    enabled: v.boolean(),
    token: v.optional(v.string()),
    repoOwner: v.string(),
    repoName: v.string(),
    labels: v.string(),
  },
  handler: updateGitHubErrorReportingConfigHandler,
});

const SEO_KEYS = {
  ga4MeasurementId: "seo.ga4MeasurementId",
  searchConsoleVerification: "seo.searchConsoleVerification",
  bingVerification: "seo.bingVerification",
} as const;

/**
 * Query SEO and analytics settings.
 *
 * Public query — Layout reads these for all visitors to inject GA4/GSC/Bing scripts.
 * Returns null for each key when not configured.
 */
export const getSeoSettings = query({
  args: {},
  returns: v.object({
    ga4MeasurementId: v.union(v.string(), v.null()),
    searchConsoleVerification: v.union(v.string(), v.null()),
    bingVerification: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const [ga4, gsc, bing] = await Promise.all([
      ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", SEO_KEYS.ga4MeasurementId))
        .unique(),
      ctx.db
        .query("settings")
        .withIndex("by_key", (q) =>
          q.eq("key", SEO_KEYS.searchConsoleVerification)
        )
        .unique(),
      ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", SEO_KEYS.bingVerification))
        .unique(),
    ]);

    return {
      ga4MeasurementId: ga4 && typeof ga4.value === "string" ? ga4.value : null,
      searchConsoleVerification:
        gsc && typeof gsc.value === "string" ? gsc.value : null,
      bingVerification:
        bing && typeof bing.value === "string" ? bing.value : null,
    };
  },
});

/**
 * Update SEO and analytics settings.
 *
 * Upserts each provided key into the settings table.
 * Passing an empty string clears the value (treated as "not set" by getSeoSettings).
 * Only accessible to admin users.
 */
export const updateSeoSettings = mutation({
  args: {
    ga4MeasurementId: v.optional(v.string()),
    searchConsoleVerification: v.optional(v.string()),
    bingVerification: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const updates: Array<{ key: string; value: string; description: string }> =
      [];

    if (args.ga4MeasurementId !== undefined) {
      updates.push({
        key: SEO_KEYS.ga4MeasurementId,
        value: args.ga4MeasurementId,
        description: "Google Analytics 4 Measurement ID (e.g. G-XXXXXXXXXX)",
      });
    }
    if (args.searchConsoleVerification !== undefined) {
      updates.push({
        key: SEO_KEYS.searchConsoleVerification,
        value: args.searchConsoleVerification,
        description: "Google Search Console HTML-tag verification token",
      });
    }
    if (args.bingVerification !== undefined) {
      updates.push({
        key: SEO_KEYS.bingVerification,
        value: args.bingVerification,
        description: "Bing Webmaster Tools verification meta content",
      });
    }

    for (const update of updates) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", update.key))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          value: update.value,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("settings", {
          key: update.key,
          value: update.value,
          description: update.description,
          updatedAt: Date.now(),
        });
      }
    }

    await logAudit(ctx, {
      action: "UPDATE_SETTING",
      targetId: "seo-settings",
      targetType: "setting",
      details: `Updated SEO settings: ${updates.map((u) => u.key).join(", ")}`,
    });

    return { success: true };
  },
});
