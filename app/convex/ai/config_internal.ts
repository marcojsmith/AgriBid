// convex/ai/config_internal.ts
// TypeScript type inference issues with Convex generated types

import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

interface AIConfigResponse {
  modelId: string;
  systemPrompt: string;
  safetyLevel: "low" | "medium" | "high" | undefined;
  isEnabled: boolean;
}

export const getDefaultAIConfig = internalQuery({
  args: {},
  returns: v.object({
    modelId: v.string(),
    systemPrompt: v.string(),
    safetyLevel: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    isEnabled: v.boolean(),
  }),
  handler: async (ctx): Promise<AIConfigResponse> => {
    const config = await ctx.db
      .query("ai_config")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();

    if (config) {
      return {
        modelId: config.modelId,
        systemPrompt: config.systemPrompt,
        safetyLevel: config.safetyLevel as
          | "low"
          | "medium"
          | "high"
          | undefined,
        isEnabled: config.isEnabled,
      };
    }

    // Return default config if none exists in DB
    return {
      modelId: "arcee-ai/trinity-mini:free",
      systemPrompt:
        "You are a helpful agricultural equipment auction assistant for AgriBid. Help users find equipment, check bids, and answer questions about the auction platform.",
      safetyLevel: "medium",
      isEnabled: true,
    };
  },
});
