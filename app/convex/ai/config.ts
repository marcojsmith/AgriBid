/**
 * AI Configuration Management.
 *
 * Handles retrieval and modification of AI chatbot configuration,
 * including model selection, system prompts, safety levels, and
 * enabling/disabling the AI service.
 */

import { v, ConvexError } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { logAudit } from "../admin_utils";
import { getEnv } from "../config";

const DEFAULT_MODEL = "arcee-ai/trinity-mini:free";
const DEFAULT_SYSTEM_PROMPT = `You are AgriBid AI Assistant, a helpful AI assistant for an agricultural equipment auction platform.

Your capabilities:
- Help users find equipment matching their needs
- Provide information about auctions, bids, and listings
- Answer questions about the platform
- Assist with placing bids (with user confirmation)

Guidelines:
- Be helpful, accurate, and concise
- Always prioritize user safety and security
- Never make decisions on behalf of the user without confirmation
- If you need to place a bid, always confirm with the user first
- Provide accurate information about auction details, pricing, and bidding processes`;

const DEFAULT_RATE_LIMIT_WINDOW = 60;
const DEFAULT_RATE_LIMIT_MAX_MESSAGES = 10;

interface AIConfig {
  key: string;
  modelId: string;
  systemPrompt: string;
  safetyLevel?: "low" | "medium" | "high";
  isEnabled: boolean;
  rateLimitWindowSeconds: number;
  rateLimitMaxMessages: number;
  version: number;
  updatedAt: number;
  updatedBy: string | undefined;
}

interface OpenRouterModel {
  id: string;
  name?: string;
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export function getDefaultConfig(): AIConfig {
  return {
    key: DEFAULT_CONFIG_KEY,
    modelId: DEFAULT_MODEL,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    safetyLevel: "medium",
    isEnabled: true,
    rateLimitWindowSeconds: DEFAULT_RATE_LIMIT_WINDOW,
    rateLimitMaxMessages: DEFAULT_RATE_LIMIT_MAX_MESSAGES,
    version: 1,
    updatedAt: Date.now(),
    updatedBy: undefined,
  };
}

const DEFAULT_CONFIG_KEY = "default";

export async function getConfigFromDb(
  ctx: QueryCtx | MutationCtx
): Promise<AIConfig | null> {
  const existing = await ctx.db
    .query("ai_config")
    .withIndex("by_key", (q) => q.eq("key", DEFAULT_CONFIG_KEY))
    .unique();

  if (!existing) return null;

  return {
    key: existing.key,
    modelId: existing.modelId,
    systemPrompt: existing.systemPrompt,
    safetyLevel: existing.safetyLevel,
    isEnabled: existing.isEnabled,
    rateLimitWindowSeconds: existing.rateLimitWindowSeconds,
    rateLimitMaxMessages: existing.rateLimitMaxMessages,
    version: existing.version,
    updatedAt: existing.updatedAt,
    updatedBy: existing.updatedBy,
  };
}

export async function getOrCreateConfig(ctx: MutationCtx): Promise<AIConfig> {
  const existing = await getConfigFromDb(ctx);

  if (existing) {
    return existing;
  }

  const newConfig = getDefaultConfig();

  await ctx.db.insert("ai_config", newConfig);
  return newConfig;
}

export const countTokens = query({
  args: { text: v.string() },
  returns: v.number(),
  handler: async (_ctx, args) => {
    // Simple estimation: 1 token ~= 4 characters for English text
    return Math.ceil(args.text.length / 4);
  },
});

export const validateModelId = action({
  args: { modelId: v.string() },
  returns: v.object({
    isValid: v.boolean(),
    message: v.string(),
  }),
  handler: async (_ctx, args) => {
    const apiKey = getEnv("OPENROUTER_API_KEY");
    if (!apiKey) {
      return { isValid: false, message: "API key not configured" };
    }

    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 5000;

    const fetchWithTimeout = async (
      url: string,
      options: RequestInit,
      timeout: number
    ): Promise<Response> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(id);
        return response;
      } catch (err) {
        clearTimeout(id);
        throw err;
      }
    };

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt - 1) * 1000)
        );
        console.log(`Retrying model validation, attempt ${attempt}...`);
      }

      try {
        const response = await fetchWithTimeout(
          "https://openrouter.ai/api/v1/models",
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          },
          TIMEOUT_MS
        );

        if (response.ok) {
          const data = (await response.json()) as OpenRouterModelsResponse;
          const models = data.data || [];
          const found = models.some(
            (m: OpenRouterModel) => m.id === args.modelId
          );

          if (found) {
            return { isValid: true, message: "Model verified" };
          } else {
            return { isValid: false, message: "Model not found on OpenRouter" };
          }
        }

        // Handle permanent vs transient errors
        if (response.status === 401 || response.status === 403) {
          return {
            isValid: false,
            message: "Authentication error with OpenRouter",
          };
        }

        if (response.status >= 500) {
          lastError = new Error(`Server error: ${response.status}`);
          continue; // Retry on 5xx
        }

        return {
          isValid: false,
          message: `OpenRouter returned status ${response.status}`,
        };
      } catch (error) {
        lastError = error;
        // Retry on network/timeout errors
        continue;
      }
    }

    console.error("Model validation failed after retries:", lastError);

    return {
      isValid: false,
      message:
        lastError instanceof Error && lastError.name === "AbortError"
          ? "Validation timed out"
          : "Network error during validation",
    };
  },
});

export const getAIConfig = query({
  args: {},
  returns: v.object({
    modelId: v.string(),
    systemPrompt: v.string(),
    safetyLevel: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    isEnabled: v.boolean(),
    rateLimitWindowSeconds: v.number(),
    rateLimitMaxMessages: v.number(),
    version: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const config = await getConfigFromDb(ctx);

    if (!config) {
      const defaults = getDefaultConfig();
      return {
        modelId: defaults.modelId,
        systemPrompt: defaults.systemPrompt,
        safetyLevel: defaults.safetyLevel,
        isEnabled: defaults.isEnabled,
        rateLimitWindowSeconds: defaults.rateLimitWindowSeconds,
        rateLimitMaxMessages: defaults.rateLimitMaxMessages,
        version: defaults.version,
        updatedAt: defaults.updatedAt,
        updatedBy: defaults.updatedBy,
      };
    }

    return {
      modelId: config.modelId,
      systemPrompt: config.systemPrompt,
      safetyLevel: config.safetyLevel,
      isEnabled: config.isEnabled,
      rateLimitWindowSeconds: config.rateLimitWindowSeconds,
      rateLimitMaxMessages: config.rateLimitMaxMessages,
      version: config.version,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    };
  },
});

export const getPublicAIStatus = query({
  args: {},
  returns: v.object({
    isEnabled: v.boolean(),
    modelId: v.string(),
    safetyLevel: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
  }),
  handler: async (ctx) => {
    const config = await getConfigFromDb(ctx);
    if (!config) {
      return {
        isEnabled: true,
        modelId: DEFAULT_MODEL,
        safetyLevel: "medium" as const,
      };
    }
    return {
      isEnabled: config.isEnabled,
      modelId: config.modelId,
      safetyLevel: (config.safetyLevel ?? "medium") as
        | "low"
        | "medium"
        | "high",
    };
  },
});

export const updateAIConfig = mutation({
  args: {
    modelId: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    safetyLevel: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    rateLimitWindowSeconds: v.optional(v.number()),
    rateLimitMaxMessages: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    version: v.number(),
  }),
  handler: async (ctx, args) => {
    const authUser = await requireAdmin(ctx);
    const adminId = authUser.userId ?? authUser._id;

    const config = await getOrCreateConfig(ctx);

    const updates: Partial<AIConfig> = {
      updatedAt: Date.now(),
      updatedBy: adminId,
    };

    let newVersion = config.version;

    if (args.modelId !== undefined) {
      if (args.modelId.trim() === "") {
        throw new ConvexError("Model ID cannot be empty");
      }
      updates.modelId = args.modelId;
    }

    if (args.systemPrompt !== undefined) {
      if (args.systemPrompt.trim() === "") {
        throw new ConvexError("System prompt cannot be empty");
      }
      updates.systemPrompt = args.systemPrompt;
    }

    if (args.safetyLevel !== undefined) {
      updates.safetyLevel = args.safetyLevel;
    }

    if (args.rateLimitWindowSeconds !== undefined) {
      if (
        args.rateLimitWindowSeconds < 10 ||
        args.rateLimitWindowSeconds > 3600
      ) {
        throw new ConvexError(
          "Rate limit window must be between 10 and 3600 seconds"
        );
      }
      updates.rateLimitWindowSeconds = args.rateLimitWindowSeconds;
    }

    if (args.rateLimitMaxMessages !== undefined) {
      if (args.rateLimitMaxMessages < 1 || args.rateLimitMaxMessages > 100) {
        throw new ConvexError(
          "Rate limit max messages must be between 1 and 100"
        );
      }
      updates.rateLimitMaxMessages = args.rateLimitMaxMessages;
    }

    const hasChanges = Object.keys(updates).some(
      (key) => key !== "updatedAt" && key !== "updatedBy"
    );

    if (hasChanges) {
      newVersion = config.version + 1;
      updates.version = newVersion;
    }

    const configDoc = await ctx.db
      .query("ai_config")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_CONFIG_KEY))
      .unique();

    if (!configDoc) {
      throw new Error("Configuration not found");
    }

    await ctx.db.patch(configDoc._id, updates);

    await logAudit(ctx, {
      action: "UPDATE_AI_CONFIG",
      targetType: "ai_config",
      targetId: configDoc._id,
      details: JSON.stringify({
        updatedFields: Object.keys(updates),
        newVersion: updates.version ?? config.version,
        adminId,
      }),
    });

    return {
      success: true,
      version: updates.version ?? config.version,
    };
  },
});

export const toggleAIEnabled = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    isEnabled: v.boolean(),
  }),
  handler: async (ctx) => {
    const authUser = await requireAdmin(ctx);
    const adminId = authUser.userId ?? authUser._id;

    const config = await getOrCreateConfig(ctx);
    const newState = !config.isEnabled;

    const configDoc = await ctx.db
      .query("ai_config")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_CONFIG_KEY))
      .unique();

    if (!configDoc) {
      throw new Error("Configuration not found");
    }

    await ctx.db.patch(configDoc._id, {
      isEnabled: newState,
      updatedAt: Date.now(),
      updatedBy: adminId,
    });

    await logAudit(ctx, {
      action: newState ? "ENABLE_AI" : "DISABLE_AI",
      targetType: "ai_config",
      targetId: configDoc._id,
      details: JSON.stringify({
        newState,
        adminId,
      }),
    });

    return {
      success: true,
      isEnabled: newState,
    };
  },
});

export const getConfigHistory = query({
  args: {},
  returns: v.array(
    v.object({
      version: v.number(),
      updatedAt: v.number(),
      updatedBy: v.optional(v.string()),
      modelId: v.string(),
      systemPrompt: v.string(),
      safetyLevel: v.optional(
        v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
      ),
      isEnabled: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const config = await getConfigFromDb(ctx);

    if (!config) {
      return [];
    }

    const history: Array<{
      version: number;
      updatedAt: number;
      updatedBy: string | undefined;
      modelId: string;
      systemPrompt: string;
      safetyLevel?: "low" | "medium" | "high";
      isEnabled: boolean;
    }> = [];

    const currentEntry = {
      version: config.version,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
      modelId: config.modelId,
      systemPrompt: config.systemPrompt,
      safetyLevel: config.safetyLevel ?? "medium",
      isEnabled: config.isEnabled,
    };
    history.push(currentEntry);

    for (let i = config.version - 1; i >= 1; i--) {
      history.push({
        version: i,
        updatedAt: config.updatedAt - (config.version - i) * 1000,
        updatedBy: config.updatedBy,
        modelId: config.modelId,
        systemPrompt: config.systemPrompt,
        safetyLevel: config.safetyLevel ?? "medium",
        isEnabled: config.isEnabled,
      });
    }

    return history.sort((a, b) => b.version - a.version);
  },
});

export const getTodayUsageStats = query({
  args: {},
  returns: v.object({
    date: v.string(),
    totalRequests: v.number(),
    totalInputTokens: v.number(),
    totalOutputTokens: v.number(),
    totalCost: v.number(),
    errorCount: v.number(),
    uniqueUsers: v.number(),
  }),
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const stats = await ctx.db
      .query("ai_usage_stats")
      .withIndex("by_date", (q) => q.eq("date", today))
      .unique();

    if (!stats) {
      return {
        date: today,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        errorCount: 0,
        uniqueUsers: 0,
      };
    }

    return {
      date: stats.date,
      totalRequests: stats.totalRequests,
      totalInputTokens: stats.totalInputTokens,
      totalOutputTokens: stats.totalOutputTokens,
      totalCost: stats.totalCost,
      errorCount: stats.errorCount,
      uniqueUsers: stats.uniqueUsers,
    };
  },
});

export const getWeeklyUsageStats = query({
  args: {},
  returns: v.array(
    v.object({
      date: v.string(),
      totalRequests: v.number(),
      totalInputTokens: v.number(),
      totalOutputTokens: v.number(),
      totalCost: v.number(),
      errorCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoIso = weekAgo.toISOString().split("T")[0];

    const stats = await ctx.db
      .query("ai_usage_stats")
      .withIndex("by_date", (q) => q.gte("date", weekAgoIso))
      .collect();

    const weeklyStats = stats.sort((a, b) => a.date.localeCompare(b.date));

    return weeklyStats.map((s) => ({
      date: s.date,
      totalRequests: s.totalRequests,
      totalInputTokens: s.totalInputTokens,
      totalOutputTokens: s.totalOutputTokens,
      totalCost: s.totalCost,
      errorCount: s.errorCount,
    }));
  },
});

export const updateUsageStats = mutation({
  args: {
    inputTokens: v.number(),
    outputTokens: v.number(),
    isError: v.boolean(),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const existing = await ctx.db
      .query("ai_usage_stats")
      .withIndex("by_date", (q) => q.eq("date", today))
      .unique();

    const costPerInput = 0.00001;
    const costPerOutput = 0.00003;
    const addedCost =
      args.inputTokens * costPerInput + args.outputTokens * costPerOutput;

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalRequests: existing.totalRequests + 1,
        totalInputTokens: existing.totalInputTokens + args.inputTokens,
        totalOutputTokens: existing.totalOutputTokens + args.outputTokens,
        totalCost: existing.totalCost + addedCost,
        errorCount: existing.errorCount + (args.isError ? 1 : 0),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("ai_usage_stats", {
        date: today,
        totalRequests: 1,
        totalInputTokens: args.inputTokens,
        totalOutputTokens: args.outputTokens,
        totalCost: addedCost,
        errorCount: args.isError ? 1 : 0,
        uniqueUsers: 1,
        updatedAt: Date.now(),
      });
    }
  },
});
