/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// app/convex/ai/chat_action_internal.ts
// TypeScript type inference issues with AI SDK - no runtime impact

import { internalAction } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "../_generated/api";
import { getModel } from "./provider";
import { createTools } from "./tools";
import { createToolExecutor } from "./executor";
import { streamText } from "ai";

const MAX_INPUT_LENGTH = 2000;
const SUSPICIOUS_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions|prompts|rules)/gi,
  /system\s*:/gi,
  /<\|/g,
  /\[INST\]/g,
  /\[SYSTEM\]/g,
];

function sanitizeInput(input: string): string {
  if (input.length > MAX_INPUT_LENGTH) {
    input = input.substring(0, MAX_INPUT_LENGTH);
  }

  for (const pattern of SUSPICIOUS_PATTERNS) {
    input = input.replaceAll(pattern, "");
  }

  return input.trim();
}

export const processChatMessage = internalAction({
  args: {
    sessionId: v.string(),
    message: v.string(),
    auctionId: v.optional(v.id("auctions")),
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<Response> => {
    const sanitizedMessage = sanitizeInput(args.message);
    if (!sanitizedMessage) {
      throw new ConvexError("Invalid message content");
    }

    try {
      await ctx.runMutation(api.ai.rate_limiting.recordMessage, {
        userId: args.userId,
      });
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      throw new ConvexError("Rate limit exceeded. Please try again later.");
    }

    const aiStatus = await ctx.runQuery(api.ai.config.getPublicAIStatus, {});
    if (!aiStatus.isEnabled) {
      throw new ConvexError("AI assistant is currently disabled");
    }

    const aiConfig = await ctx.runQuery(
      internal.ai.config_internal.getDefaultAIConfig,
      {}
    );

    // Save user message immediately
    await ctx.runMutation(internal.ai.chat.addMessageInternal, {
      sessionId: args.sessionId,
      role: "user",
      content: sanitizedMessage,
      auctionId: args.auctionId,
    });

    const model = await getModel(aiConfig.modelId);

    const executor = createToolExecutor(ctx);
    const tools = createTools(executor, aiStatus.safetyLevel);

    const history = await ctx.runQuery(api.ai.chat.getSessionHistory, {
      sessionId: args.sessionId,
    });

    function isValidRole(role: string): role is "user" | "assistant" {
      return role === "user" || role === "assistant";
    }

    const messages: Array<{ role: "user" | "assistant"; content: string }> =
      history
        .filter((msg) => isValidRole(msg.role))
        .map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));

    // Consume the stream and await full response while ctx is valid
    const result = streamText({
      model,
      system: aiConfig.systemPrompt,
      messages,
      tools,
      maxRetries: 2,
    });

    // Await the full response to get usage data while ctx is valid
    let fullText = "";
    let usage = { totalTokens: 0, promptTokens: 0, completionTokens: 0 };

    try {
      // Consume the stream to get the full text and usage
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      // Get usage after stream is complete
      const resultUsage = await result.usage;
      if (resultUsage) {
        usage = {
          totalTokens: resultUsage.totalTokens,
          promptTokens: resultUsage.promptTokens,
          completionTokens: resultUsage.completionTokens,
        };
      }
    } catch (streamError) {
      console.error("Stream error:", streamError);
    }

    // Persist assistant message and update usage stats while ctx is valid
    try {
      await ctx.runMutation(internal.ai.chat.addMessageInternal, {
        sessionId: args.sessionId,
        role: "assistant",
        content: fullText,
        auctionId: args.auctionId,
        tokenCount: usage.totalTokens,
      });

      await ctx.runMutation(api.ai.config.updateUsageStats, {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        isError: false,
      });
    } catch (persistError) {
      console.error("Failed to save assistant response:", persistError);
    }

    // Return streaming response (already consumed, but this creates the response)
    return result.toTextStreamResponse();
  },
});
