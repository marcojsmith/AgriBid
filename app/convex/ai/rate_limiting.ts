// app/convex/ai/rate_limiting.ts
// TypeScript type inference issues with AI SDK - no runtime impact

import { v, ConvexError } from "convex/values";
import {
  query,
  mutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { getAuthUser } from "../lib/auth";
import { getConfigFromDb, getDefaultConfig } from "./config";

interface RateLimitStatus {
  allowed: boolean;
  currentCount: number;
  maxMessages: number;
  windowSeconds: number;
  resetAt: number;
  remaining: number;
}

async function getRateLimitSettings(ctx: QueryCtx | MutationCtx): Promise<{
  windowSeconds: number;
  maxMessages: number;
}> {
  const config = await getConfigFromDb(ctx);
  if (!config) {
    const defaults = getDefaultConfig();
    return {
      windowSeconds: defaults.rateLimitWindowSeconds,
      maxMessages: defaults.rateLimitMaxMessages,
    };
  }
  return {
    windowSeconds: config.rateLimitWindowSeconds,
    maxMessages: config.rateLimitMaxMessages,
  };
}

export const checkRateLimit = query({
  args: {
    userId: v.optional(v.string()), // Optional userId for internal action calls
  },
  handler: async (ctx, args): Promise<RateLimitStatus> => {
    let userId = args.userId;

    if (!userId) {
      const authUser = await getAuthUser(ctx);
      if (!authUser) {
        // Use configured defaults instead of hardcoded values
        const { windowSeconds, maxMessages } = await getRateLimitSettings(ctx);
        return {
          allowed: true,
          currentCount: 0,
          maxMessages,
          windowSeconds,
          resetAt: Date.now() + windowSeconds * 1000,
          remaining: maxMessages,
        };
      }
      userId = authUser.userId ?? authUser._id;
    }

    return checkRateLimitLogic(ctx, userId);
  },
});

export const recordMessage = mutation({
  args: {
    userId: v.optional(v.string()), // Optional userId for internal action calls
  },
  returns: v.object({
    success: v.boolean(),
    currentCount: v.number(),
    remaining: v.number(),
  }),
  handler: async (ctx, args) => {
    let userId = args.userId;

    if (!userId) {
      const authUser = await getAuthUser(ctx);
      if (!authUser) {
        throw new ConvexError("Must be authenticated to record messages");
      }
      userId = authUser.userId ?? authUser._id;
    }

    const { windowSeconds, maxMessages } = await getRateLimitSettings(ctx);
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const rateLimitDoc = await ctx.db
      .query("rate_limits")
      .withIndex("by_user", (q) => q.eq("userId", userId!))
      .unique();

    if (!rateLimitDoc) {
      await ctx.db.insert("rate_limits", {
        userId: userId!,
        timestamps: [now],
        windowStart: now,
        updatedAt: now,
      });

      return {
        success: true,
        currentCount: 1,
        remaining: maxMessages - 1,
      };
    }

    const validTimestamps = rateLimitDoc.timestamps.filter(
      (ts) => ts > windowStart
    );

    if (validTimestamps.length >= maxMessages) {
      throw new ConvexError(
        `Rate limit exceeded. You can send ${maxMessages} messages per ${windowSeconds} seconds. Please wait before sending more messages.`
      );
    }

    const newTimestamps = [...validTimestamps, now];

    await ctx.db.patch(rateLimitDoc._id, {
      timestamps: newTimestamps,
      windowStart: now,
      updatedAt: now,
    });

    return {
      success: true,
      currentCount: newTimestamps.length,
      remaining: maxMessages - newTimestamps.length,
    };
  },
});

async function checkRateLimitLogic(
  ctx: QueryCtx,
  userId: string
): Promise<RateLimitStatus> {
  const { windowSeconds, maxMessages } = await getRateLimitSettings(ctx);
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  const rateLimitDoc = await ctx.db
    .query("rate_limits")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  if (!rateLimitDoc) {
    return {
      allowed: true,
      currentCount: 0,
      maxMessages,
      windowSeconds,
      resetAt: now + windowSeconds * 1000,
      remaining: maxMessages,
    };
  }

  const validTimestamps = rateLimitDoc.timestamps.filter(
    (ts) => ts > windowStart
  );

  const currentCount = validTimestamps.length;
  const allowed = currentCount < maxMessages;

  const oldestTimestamp =
    validTimestamps.length > 0 ? Math.min(...validTimestamps) : now;
  const resetAt = oldestTimestamp + windowSeconds * 1000;

  return {
    allowed,
    currentCount,
    maxMessages,
    windowSeconds,
    resetAt,
    remaining: Math.max(0, maxMessages - currentCount),
  };
}

export const getRateLimitStatus = query({
  args: {},
  returns: v.object({
    currentCount: v.number(),
    maxMessages: v.number(),
    windowSeconds: v.number(),
    resetAt: v.number(),
    remaining: v.number(),
    isNearLimit: v.boolean(),
  }),
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      // Use configured defaults via getRateLimitSettings for consistency
      const { windowSeconds, maxMessages } = await getRateLimitSettings(ctx);
      return {
        currentCount: 0,
        maxMessages,
        windowSeconds,
        resetAt: Date.now() + windowSeconds * 1000,
        remaining: maxMessages,
        isNearLimit: false,
      };
    }

    const userId = authUser.userId ?? authUser._id;
    const status = await checkRateLimitLogic(ctx, userId);
    const threshold = 0.8;
    const isNearLimit = status.currentCount >= status.maxMessages * threshold;

    return {
      currentCount: status.currentCount,
      maxMessages: status.maxMessages,
      windowSeconds: status.windowSeconds,
      resetAt: status.resetAt,
      remaining: status.remaining,
      isNearLimit,
    };
  },
});
