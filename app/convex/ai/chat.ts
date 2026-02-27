// app/convex/ai/chat.ts
import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { getAuthUser } from "../lib/auth";

const CONTEXT_WINDOW_SIZE = 10;
const SESSION_EXPIRY_DAYS = 5;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// Shared validator definitions
const roleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system")
);

const metadataValidator = v.optional(
  v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))
);

// Tool call validators - using v.any() for dynamic content
// Runtime validation should be performed on these fields in handlers
const toolCallArgsValidator = v.optional(
  v.record(
    v.string(),
    v.union(v.string(), v.number(), v.boolean(), v.null(), v.array(v.any()))
  )
);

const toolCallResultValidator = v.optional(
  v.union(
    v.string(),
    v.number(),
    v.boolean(),
    v.null(),
    v.record(v.string(), v.any())
  )
);

const toolCallValidator = v.optional(
  v.array(
    v.object({
      toolName: v.string(),
      args: toolCallArgsValidator,
      result: toolCallResultValidator,
    })
  )
);

function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `session_${timestamp}_${randomPart}`;
}

export const createSession = mutation({
  args: {},
  returns: v.object({
    sessionId: v.string(),
    createdAt: v.number(),
  }),
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Must be authenticated to create a session");
    }

    const userId = authUser.userId ?? authUser._id;
    const now = Date.now();
    const sessionId = generateSessionId();

    await ctx.db.insert("chat_history", {
      userId,
      sessionId,
      role: "system",
      content: "Session started",
      createdAt: now,
    });

    return {
      sessionId,
      createdAt: now,
    };
  },
});

export const validateSession = query({
  args: {
    sessionId: v.string(),
  },
  returns: v.object({
    valid: v.boolean(),
    sessionId: v.optional(v.string()),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      return { valid: false, reason: "Not authenticated" };
    }
    const userId = authUser.userId ?? authUser._id;

    const firstMessage = await ctx.db
      .query("chat_history")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!firstMessage) {
      return { valid: false, reason: "Session not found" };
    }

    const lastMessage = await ctx.db
      .query("chat_history")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("sessionId", args.sessionId)
      )
      .order("desc")
      .first();

    const now = Date.now();
    const isExpired =
      lastMessage && now - lastMessage.createdAt > SESSION_EXPIRY_MS;

    if (isExpired) {
      return { valid: false, reason: "Session expired" };
    }

    return { valid: true, sessionId: args.sessionId };
  },
});

export const addMessage = mutation({
  args: {
    sessionId: v.string(),
    role: roleValidator,
    content: v.string(),
    auctionId: v.optional(v.id("auctions")),
    tokenCount: v.optional(v.number()),
    metadata: metadataValidator,
    toolCalls: toolCallValidator,
  },
  returns: v.id("chat_history"),
  handler: async (ctx, args) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Must be authenticated to add a message");
    }
    const userId = authUser.userId ?? authUser._id;

    const now = Date.now();

    const messageId = await ctx.db.insert("chat_history", {
      userId,
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      auctionId: args.auctionId,
      tokenCount: args.tokenCount,
      metadata: args.metadata,
      toolCalls: args.toolCalls,
      createdAt: now,
    });

    return messageId;
  },
});

export const addMessageInternal = internalMutation({
  args: {
    sessionId: v.string(),
    userId: v.string(),
    role: roleValidator,
    content: v.string(),
    auctionId: v.optional(v.id("auctions")),
    tokenCount: v.optional(v.number()),
    metadata: metadataValidator,
    toolCalls: toolCallValidator,
  },
  returns: v.id("chat_history"),
  handler: async (ctx, args) => {
    const now = Date.now();

    const messageId = await ctx.db.insert("chat_history", {
      userId: args.userId,
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      auctionId: args.auctionId,
      tokenCount: args.tokenCount,
      metadata: args.metadata,
      toolCalls: args.toolCalls,
      createdAt: now,
    });

    return messageId;
  },
});

export const getSessionHistory = query({
  args: {
    sessionId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("chat_history"),
      userId: v.string(),
      sessionId: v.string(),
      role: roleValidator,
      content: v.string(),
      auctionId: v.optional(v.id("auctions")),
      tokenCount: v.optional(v.number()),
      metadata: metadataValidator,
      toolCalls: toolCallValidator,
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Must be authenticated to get session history");
    }
    const userId = authUser.userId ?? authUser._id;

    const messages = await ctx.db
      .query("chat_history")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("sessionId", args.sessionId)
      )
      .order("asc")
      .take(CONTEXT_WINDOW_SIZE);

    return messages;
  },
});

export const getSessionHistoryInternal = internalQuery({
  args: {
    sessionId: v.string(),
    userId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("chat_history"),
      _creationTime: v.number(),
      sessionId: v.string(),
      role: roleValidator,
      content: v.string(),
      userId: v.string(),
      auctionId: v.optional(v.id("auctions")),
      tokenCount: v.optional(v.number()),
      metadata: metadataValidator,
      toolCalls: toolCallValidator,
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chat_history")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId)
      )
      .order("asc")
      .take(CONTEXT_WINDOW_SIZE);

    return messages;
  },
});

export const getUserSessions = query({
  args: {},
  returns: v.array(
    v.object({
      sessionId: v.string(),
      lastMessageAt: v.number(),
      lastMessagePreview: v.string(),
      messageCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      return [];
    }

    const userId = authUser.userId ?? authUser._id;
    const now = Date.now();
    const expiryThreshold = now - SESSION_EXPIRY_MS;

    // Get all user messages and filter in memory (with limit for performance)
    const allMessages = await ctx.db
      .query("chat_history")
      .withIndex("by_user_session", (q) => q.eq("userId", userId))
      .take(500); // Limit to prevent unbounded growth

    const activeMessages = allMessages.filter(
      (msg) => msg.createdAt > expiryThreshold
    );

    const sessionMap = new Map<
      string,
      {
        sessionId: string;
        lastMessageAt: number;
        lastMessagePreview: string;
        messageCount: number;
      }
    >();

    for (const msg of activeMessages) {
      const existing = sessionMap.get(msg.sessionId);
      if (!existing || msg.createdAt > existing.lastMessageAt) {
        sessionMap.set(msg.sessionId, {
          sessionId: msg.sessionId,
          lastMessageAt: msg.createdAt,
          lastMessagePreview: msg.content.substring(0, 100),
          messageCount: 0,
        });
      }
      const session = sessionMap.get(msg.sessionId);
      if (session) {
        session.messageCount++;
      }
    }

    const sessions = Array.from(sessionMap.values());
    sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    return sessions;
  },
});

export const getRecentMessages = query({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("chat_history"),
      role: roleValidator,
      content: v.string(),
      createdAt: v.number(),
      toolCalls: v.optional(
        v.array(
          v.object({
            toolName: v.string(),
            args: v.optional(v.any()),
            result: v.optional(v.any()),
          })
        )
      ),
    })
  ),
  handler: async (ctx, args) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Must be authenticated to get messages");
    }

    const userId = authUser.userId ?? authUser._id;
    const limit = args.limit ?? CONTEXT_WINDOW_SIZE;

    const messages = await ctx.db
      .query("chat_history")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("sessionId", args.sessionId)
      )
      .order("desc")
      .take(limit);

    return messages.reverse().map((msg) => ({
      _id: msg._id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
      toolCalls: msg.toolCalls,
    }));
  },
});

export const deleteSession = mutation({
  args: {
    sessionId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    deletedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Must be authenticated to delete a session");
    }

    const userId = authUser.userId ?? authUser._id;

    const messages = await ctx.db
      .query("chat_history")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("sessionId", args.sessionId)
      )
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    return {
      success: true,
      deletedCount: messages.length,
    };
  },
});
