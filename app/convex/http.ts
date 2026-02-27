// app/convex/http.ts
import { httpRouter } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { createAuth } from "./auth";
import { httpAction } from "./_generated/server";
import { isOriginAllowed } from "./config";
import { internal } from "./_generated/api";
import type { FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { streamText, createUIMessageStreamResponse } from "ai";
import { getModel } from "./ai/provider";
import { createTools } from "./ai/tools";
import { createToolExecutor } from "./ai/executor";

// Typed references to break deep type instantiation chain
// Using unknown as intermediate to avoid type mismatches
const recordMessageRef = makeFunctionReference(
  "ai/rate_limiting:recordMessage"
) as unknown as FunctionReference<
  "mutation",
  "public",
  { userId: string },
  unknown
>;

const updateUsageStatsRef = makeFunctionReference(
  "ai/config:updateUsageStats"
) as unknown as FunctionReference<
  "mutation",
  "public",
  { inputTokens: number; outputTokens: number; isError: boolean },
  unknown
>;

const http = httpRouter();

// ---------------------------------------------------------------------------
// CORS Configuration
/**
 * Builds CORS response headers using the request's Origin and the configured allowlist.
 *
 * @param request - The incoming HTTP Request; the `Origin` header is inspected to determine whether to include `Access-Control-Allow-Origin`.
 * @returns A record of CORS header names to values. If the request origin is allowed, includes `Access-Control-Allow-Origin` set to that origin; always includes standard CORS headers for methods, headers, credentials and `Vary`.
 */

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const isAllowed = isOriginAllowed(origin);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Cookie, X-Requested-With, User-Agent, Accept, x-vercel-ai-data-stream, x-ai-data-stream",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };

  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function addCorsHeaders(response: Response, request: Request): Response {
  const corsHeaders = getCorsHeaders(request);
  const newHeaders = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// ---------------------------------------------------------------------------
// Preflight handler (OPTIONS) — covers every /api/auth/* route
// ---------------------------------------------------------------------------

http.route({
  pathPrefix: "/api/auth/",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, {
      status: 204,
      headers: new Headers(getCorsHeaders(request)),
    });
  }),
});

// ---------------------------------------------------------------------------
// Auth handler wrapper — forwards to Better Auth, then injects CORS headers
// ---------------------------------------------------------------------------

const authHandler = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin") ?? "";
  const auth = createAuth(ctx, { origin });
  const response = await auth.handler(request);
  return addCorsHeaders(response, request);
});

// ---------------------------------------------------------------------------
// Well-known handler — rewrites /.well-known/* to /api/auth/.well-known/*
// ---------------------------------------------------------------------------

const wellKnownHandler = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin") ?? "";
  const auth = createAuth(ctx, { origin });
  const url = new URL(request.url);

  // Rewrite standard OIDC discovery path to the plugin's internal path
  if (url.pathname.endsWith("/openid-configuration")) {
    url.pathname = "/api/auth/convex/.well-known/openid-configuration";
  } else if (url.pathname.endsWith("/jwks")) {
    url.pathname = "/api/auth/convex/jwks";
  }

  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    // @ts-expect-error - duplex is required in some runtimes but not in standard RequestInit
    duplex: "half",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const rewrittenRequest = new Request(url.toString(), init as RequestInit);

  const response = await auth.handler(rewrittenRequest);
  return addCorsHeaders(response, request);
});

// Register GET and POST for the auth prefix
http.route({
  pathPrefix: "/api/auth/",
  method: "GET",
  handler: authHandler,
});

http.route({
  pathPrefix: "/api/auth/",
  method: "POST",
  handler: authHandler,
});

// Explicitly register the convex plugin sub-path
http.route({
  pathPrefix: "/api/auth/convex/",
  method: "GET",
  handler: authHandler,
});

// Register GET for .well-known OpenID discovery
http.route({
  pathPrefix: "/.well-known/",
  method: "GET",
  handler: wellKnownHandler,
});

// ---------------------------------------------------------------------------
// AI Chat Endpoint - streams directly from OpenRouter
// ---------------------------------------------------------------------------

const aiChatHandler = httpAction(async (ctx, request) => {
  const corsHeaders = getCorsHeaders(request);
  const origin = request.headers.get("Origin") ?? "";

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: new Headers(corsHeaders),
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Validate session with BetterAuth
    const auth = createAuth(ctx, { origin, optionsOnly: true });
    const cookieHeader = request.headers.get("Cookie");

    if (!cookieHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await auth.api.getSession({
      headers: { cookie: cookieHeader },
    });

    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;

    // 2. Parse request body
    let body: {
      sessionId: string;
      message?: string;
      messages?: Array<{ role: string; content: string }>;
      auctionId?: string;
    };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sessionId, auctionId } = body;
    let message = body.message;
    if (!message && body.messages && body.messages.length > 0) {
      const lastMessage = body.messages[body.messages.length - 1];
      if (lastMessage.role === "user") {
        message = lastMessage.content;
      }
    }

    if (!sessionId || !message) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId or message" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate auctionId if provided - must be a non-empty string
    let validatedAuctionId: Id<"auctions"> | undefined;
    if (auctionId !== undefined) {
      if (typeof auctionId !== "string" || auctionId.trim() === "") {
        return new Response(
          JSON.stringify({ error: "Invalid auctionId format" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      validatedAuctionId = auctionId as Id<"auctions">;
    }

    // 3. Check rate limit
    try {
      await ctx.runMutation(recordMessageRef, { userId });
    } catch (error) {
      // Only return 429 for genuine rate-limit errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isRateLimitError =
        errorMessage.toLowerCase().includes("rate limit") ||
        errorMessage.toLowerCase().includes("rate limit exceeded");

      if (isRateLimitError) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again later.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Log full error and return 500 for non-rate-limit errors
      console.error("Error recording message:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Get AI config (using internal query)
    const aiConfig = await ctx.runQuery(
      internal.ai.config_internal.getDefaultAIConfig,
      {}
    );

    if (!aiConfig.isEnabled) {
      return new Response(
        JSON.stringify({ error: "AI assistant is currently disabled" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sanitizedMessage = message.trim();

    // 5. Get chat history for context using internal query with userId
    const history = await ctx.runQuery(
      internal.ai.chat.getSessionHistoryInternal,
      {
        sessionId,
        userId,
      }
    );

    // Build messages array from history + current user message
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: sanitizedMessage },
    ];

    // 6. Save user message to database
    await ctx.runMutation(internal.ai.chat.addMessageInternal, {
      sessionId,
      userId,
      role: "user",
      content: sanitizedMessage,
      auctionId: validatedAuctionId,
    });

    // 7. Get AI model, tools and stream
    const model = await getModel(aiConfig.modelId);
    const executor = createToolExecutor(ctx);
    const tools = createTools(executor, aiConfig.safetyLevel);

    const result = streamText({
      model,
      system: aiConfig.systemPrompt,
      messages,
      tools,
      maxRetries: 2,
      onFinish: async (event) => {
        const usage = event.usage as
          | {
              totalTokens?: number;
              promptTokens?: number;
              completionTokens?: number;
            }
          | undefined;

        try {
          // Save assistant message
          await ctx.runMutation(internal.ai.chat.addMessageInternal, {
            sessionId,
            userId,
            role: "assistant",
            content: event.text || "",
            auctionId: validatedAuctionId,
            tokenCount: usage?.totalTokens ?? 0,
            // Store tool calls in metadata if present
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            toolCalls: (event.toolCalls as any[])?.map((tc: any) => ({
              toolName: tc.toolName,
              args: tc.args,
            })),
          });

          // Update usage stats
          await ctx.runMutation(updateUsageStatsRef, {
            inputTokens: usage?.promptTokens ?? 0,
            outputTokens: usage?.completionTokens ?? 0,
            isError: false,
          });
        } catch (e) {
          console.error("Failed to save assistant response:", e);
        }
      },
    });

    // 8. Return UI message stream response
    const stream = await result.toUIMessageStream();
    const streamResponse = createUIMessageStreamResponse({ stream });
    return addCorsHeaders(streamResponse, request);
  } catch (error) {
    console.error("AI chat error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

http.route({
  pathPrefix: "/api/ai/chat/",
  method: "POST",
  handler: aiChatHandler,
});

http.route({
  pathPrefix: "/api/ai/chat/",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, {
      status: 204,
      headers: new Headers(getCorsHeaders(request)),
    });
  }),
});

export default http;
