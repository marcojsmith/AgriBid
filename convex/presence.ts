import { v } from "convex/values";

import {
  mutation,
  query,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { getAuthUser } from "./lib/auth";
import { getSetting } from "./admin/settings";
import * as constants from "./constants";

/**
 * Minimum online threshold in milliseconds.
 * Never go below this value even if heartbeat interval is very short.
 */
const MIN_PRESENCE_THRESHOLD_MS = 90_000;

/**
 * Extra buffer time added to the heartbeat interval to determine the threshold.
 * This accounts for network latency and processing delays.
 */
const THRESHOLD_BUFFER_MS = 30_000;

/**
 * Calculate the online presence threshold based on the configured heartbeat interval.
 *
 * The threshold is derived as max(90_000, interval + 30_000) to ensure users remain
 * marked online between heartbeats, while still respecting admin-configured intervals.
 *
 * @param ctx - Query or Mutation context
 * @returns The threshold in milliseconds
 */
export async function getPresenceThresholdMs(
  ctx: QueryCtx | MutationCtx
): Promise<number> {
  const interval = await getSetting(
    ctx,
    "presence_heartbeat_interval_ms",
    constants.PRESENCE_HEARTBEAT_INTERVAL_MS_DEFAULT
  );
  return Math.max(MIN_PRESENCE_THRESHOLD_MS, interval + THRESHOLD_BUFFER_MS);
}

/**
 * Standardized presence counting logic.
 *
 * @param ctx - Query or Mutation context
 * @returns Current online user count
 */
export async function countOnlineUsers(ctx: QueryCtx | MutationCtx) {
  const threshold = Date.now() - (await getPresenceThresholdMs(ctx));

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
      await ctx.db.patch("presence", existing._id, { updatedAt: now });
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
 * Return the admin-configured presence heartbeat interval in milliseconds.
 *
 * Public (no auth): every logged-in client's PresenceListener needs this to
 * pace its heartbeat mutation. Not sensitive — falls back to the hardcoded
 * default when no admin has overridden it.
 */
export const getHeartbeatIntervalMs = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) =>
    getSetting(
      ctx,
      "presence_heartbeat_interval_ms",
      constants.PRESENCE_HEARTBEAT_INTERVAL_MS_DEFAULT
    ),
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
    const thresholdMs = await getPresenceThresholdMs(ctx);
    const threshold = Date.now() - thresholdMs * 10;
    const BATCH_SIZE = 100;
    const MAX_ITERATIONS = 10;
    let deletedCount = 0;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const oldRecords = await ctx.db
        .query("presence")
        .withIndex("by_updatedAt", (q) => q.lt("updatedAt", threshold))
        .take(BATCH_SIZE);

      if (oldRecords.length === 0) break;

      await Promise.all(
        oldRecords.map((record) => ctx.db.delete("presence", record._id))
      );
      deletedCount += oldRecords.length;

      if (oldRecords.length < BATCH_SIZE) break;
    }

    if (deletedCount > 0) {
      console.warn(
        `Presence cleanup: Removed ${String(deletedCount)} stale records.`
      );
    }

    return null;
  },
});
