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
    const tools = createTools(executor);

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

    console.log(`[AI Internal Chat] Session: ${args.sessionId}`);
    console.log(
      `[AI Internal Chat] System Prompt: ${aiConfig.systemPrompt.substring(0, 100)}...`
    );
    console.log(`[AI Internal Chat] Messages: ${messages.length}`);

    // Return streaming response directly using onFinish for persistence
    const result = streamText({
      model,
      system: aiConfig.systemPrompt,
      messages,
      tools,
      maxRetries: 2,
      onFinish: async (event) => {
        const usage = event.usage;
        console.log(
          `[AI Internal Chat] Finished. Tokens: ${usage?.totalTokens}. Text length: ${event.text?.length}`
        );
        if (event.toolCalls && event.toolCalls.length > 0) {
          console.log(
            `[AI Internal Chat] Tool Calls: ${event.toolCalls.map((tc) => tc.toolName).join(", ")}`
          );
        }

        try {
          // Persist assistant message
          await ctx.runMutation(internal.ai.chat.addMessageInternal, {
            sessionId: args.sessionId,
            role: "assistant",
            content: event.text || "",
            auctionId: args.auctionId,
            tokenCount: usage?.totalTokens ?? 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            toolCalls: event.toolCalls?.map((tc: any) => ({
              toolName: tc.toolName,
              args: tc.args,
            })),
          });

          // Update usage stats
          await ctx.runMutation(api.ai.config.updateUsageStats, {
            inputTokens: usage?.promptTokens ?? 0,
            outputTokens: usage?.completionTokens ?? 0,
            isError: false,
          });
        } catch (persistError) {
          console.error("Failed to save assistant response:", persistError);
        }
      },
    });

    return result.toTextStreamResponse();
  },
});
