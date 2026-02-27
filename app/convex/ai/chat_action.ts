// app/convex/ai/chat_action.ts

import { action } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getModel } from "./provider";
import { createTools } from "./tools";
import { createToolExecutor } from "./executor";
import {
  streamText,
  createUIMessageStreamResponse,
  type LanguageModel,
  stepCountIs,
} from "ai";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Return types matching Convex function definitions
type RateLimitStatus = {
  allowed: boolean;
  currentCount: number;
  maxMessages: number;
  windowSeconds: number;
  resetAt: number;
  remaining: number;
};

type AIConfigResult = {
  modelId: string;
  systemPrompt: string;
  safetyLevel?: "low" | "medium" | "high";
  isEnabled: boolean;
  rateLimitWindowSeconds: number;
  rateLimitMaxMessages: number;
  version: number;
  updatedAt: number;
  updatedBy?: string;
};

const MAX_INPUT_LENGTH = 2000;
const SUSPICIOUS_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions|prompts|rules)/gi,
  /system\s*:/gi,
  /<\|/g,
  /\[INST\]/g,
  /\[SYSTEM\]/g,
] as const;

function sanitizeInput(input: string): string {
  if (input.length > MAX_INPUT_LENGTH) {
    input = input.substring(0, MAX_INPUT_LENGTH);
  }

  for (const pattern of SUSPICIOUS_PATTERNS) {
    input = input.replaceAll(pattern, "");
  }

  return input.trim();
}

const DEFAULT_SYSTEM_PROMPT = `You are AgriBid AI Assistant, an AI helper for an agricultural equipment auction platform.

Your role is to help users:
- Find and browse agricultural equipment auctions
- Get detailed information about specific auctions
- Understand their own bids and watchlists
- Place bids on auctions (with explicit user confirmation)

Guidelines:
- Always be helpful, honest, and concise
- Provide accurate information from the platform data
- When users want to place bids, always confirm the exact amount before proceeding
- If you don't have enough information, ask clarifying questions
- Never make up information about auctions or bids

When searching for equipment:
- Ask for specific criteria (make, model, year, price range) if not provided
- Present search results clearly with key details

For bidding:
- Always confirm the auction and exact amount with the user
- Explain the current price and any minimum bid requirements
- Warn about auction end times for time-sensitive decisions`;

type MessageRole = "user" | "assistant";

interface ChatMessage {
  role: MessageRole;
  content: string;
}

function isValidRole(role: string): role is MessageRole {
  return role === "user" || role === "assistant";
}

export const processMessage = action({
  args: {
    sessionId: v.string(),
    message: v.string(),
    auctionId: v.optional(v.id("auctions")),
  },
  handler: async (
    ctx: ActionCtx,
    args: { sessionId: string; message: string; auctionId?: Id<"auctions"> }
  ): Promise<Response> => {
    const rateLimitCheck = (await ctx.runQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "ai/rate_limiting:checkRateLimit" as any,
      {}
    )) as RateLimitStatus;

    if (!rateLimitCheck.allowed) {
      throw new ConvexError("Rate limit exceeded");
    }

    const aiConfig = (await ctx.runQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "ai/config:getAIConfig" as any,
      {}
    )) as AIConfigResult;

    if (!aiConfig?.isEnabled) {
      throw new ConvexError("AI assistant is currently disabled");
    }

    const sanitizedMessage = sanitizeInput(args.message);
    if (!sanitizedMessage) {
      throw new ConvexError("Invalid message content");
    }

    const modelId = aiConfig?.modelId ?? "arcee-ai/trinity-mini:free";
    const model: LanguageModel = await getModel(modelId);

    const executor = createToolExecutor(ctx);
    const tools = createTools(executor);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const history = (await ctx.runQuery("ai/chat:getSessionHistory" as any, {
      sessionId: args.sessionId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any[];

    const messages: ChatMessage[] = [
      ...history
        .filter((msg) => isValidRole(msg.role))
        .map((msg) => ({
          role: msg.role as MessageRole,
          content: msg.content,
        })),
      { role: "user" as const, content: sanitizedMessage },
    ];

    let systemPrompt = aiConfig?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    // Inject current page context if available
    if (args.auctionId) {
      systemPrompt += `\n\nCURRENT CONTEXT: The user is currently viewing the auction with ID: "${args.auctionId}". If they refer to "this" item, "this auction", or ask for details about what they are looking at, use this ID.`;
    }

    console.log(`[AI Chat] Session: ${args.sessionId}`);
    console.log(`[AI Chat] Model: ${modelId}`);
    console.log(`[AI Chat] System Prompt Length: ${systemPrompt.length}`);
    console.log(`[AI Chat] Messages Count: ${messages.length}`);
    console.log(
      "[AI Chat] Full Prompt Context:",
      JSON.stringify({ systemPrompt, messages }, null, 2)
    );

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(5),
      maxRetries: 2,
    });

    const stream = await result.toUIMessageStream();
    return createUIMessageStreamResponse({ stream });
  },
});
