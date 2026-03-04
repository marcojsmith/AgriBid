import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { getAuthUser } from "./lib/auth";

export const PRESENCE_HEARTBEAT_THRESHOLD = 30 * 1000; // 30 seconds

/**
 * Standardized presence counting logic.
 *
 * @param ctx - Query or Mutation context
 * @returns Current online user count
 */
export async function countOnlineUsers(ctx: QueryCtx | MutationCtx) {
  const threshold = Date.now() - PRESENCE_HEARTBEAT_THRESHOLD;

  const onlineQuery = ctx.db
    .query("presence")
    .withIndex("by_updatedAt", (q) => q.gt("updatedAt", threshold));

  // Efficiently count without fetching full documents
  if (
    typeof (onlineQuery as unknown as { count?: () => Promise<number> })
      .count === "function"
  ) {
    return await (
      onlineQuery as unknown as { count: () => Promise<number> }
    ).count();
  }

  const onlineUsers = await onlineQuery.collect();
  return onlineUsers.length;
}

/**
 * Update the user's presence timestamp to indicate they are online.
 *
 * Scans for an existing presence record and updates it, or inserts a new one.
 */
export const heartbeat = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return null;

    const userId = authUser.userId ?? authUser._id;
    const now = Date.now();

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: now });
    } else {
      await ctx.db.insert("presence", { userId, updatedAt: now });
    }

    return null;
  },
});

/**
 * Return the current count of online users based on heartbeats.
 */
export const getOnlineCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) throw new Error("Unauthorized");
    return await countOnlineUsers(ctx);
  },
});

/**
 * Internal: Clean up old presence records.
 *
 * Removes records that haven't been updated for 10x the threshold.
 * Uses a multi-batch loop to prevent exceeding Convex limits while ensuring all stale data is removed.
 */
export const cleanup = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const threshold = Date.now() - PRESENCE_HEARTBEAT_THRESHOLD * 10;
    const BATCH_SIZE = 100;
    const MAX_ITERATIONS = 10;
    let deletedCount = 0;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const oldRecords = await ctx.db
        .query("presence")
        .withIndex("by_updatedAt", (q) => q.lt("updatedAt", threshold))
        .take(BATCH_SIZE);

      if (oldRecords.length === 0) break;

      await Promise.all(oldRecords.map((record) => ctx.db.delete(record._id)));
      deletedCount += oldRecords.length;

      if (oldRecords.length < BATCH_SIZE) break;
    }

    if (deletedCount > 0) {
      console.log(`Presence cleanup: Removed ${deletedCount} stale records.`);
    }

    return null;
  },
});
