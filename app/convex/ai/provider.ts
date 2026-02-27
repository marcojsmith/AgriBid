// app/convex/ai/provider.ts

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { v } from "convex/values";
import { getEnv } from "../config";
import { query } from "../_generated/server";
import type { LanguageModel } from "ai";

let cachedProvider: ReturnType<typeof createOpenRouter> | null = null;

export async function getOpenRouterProvider(): Promise<
  ReturnType<typeof createOpenRouter>
> {
  if (cachedProvider) {
    return cachedProvider;
  }

  const apiKey = getEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  cachedProvider = createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": "https://agribid.auction",
      "X-Title": "AgriBid",
    },
  });

  return cachedProvider;
}

export async function getModel(modelId: string): Promise<LanguageModel> {
  const provider = await getOpenRouterProvider();
  return provider(modelId);
}

export const getCurrentModelId = query({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const config = await ctx.db.query("ai_config").first();
    return config?.modelId ?? "arcee-ai/trinity-mini:free";
  },
});
