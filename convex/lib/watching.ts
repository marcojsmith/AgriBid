import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { adjustWatcherCount } from "./lotCounters";

/**
 * Make sure a user is watching a lot, adding the watch (and bumping the
 * per-lot watcher counter) only when it is missing.
 *
 * The watcher counter is not idempotent, so the `watchlist.by_user_lot`
 * lookup is what keeps it correct: never insert without going through here.
 *
 * @param ctx - Convex mutation context
 * @param userId - The watching user
 * @param lotId - The lot to watch
 * @returns true when a watch was newly added, false when it already existed
 */
export async function ensureWatching(
  ctx: MutationCtx,
  userId: string,
  lotId: Id<"lots">
): Promise<boolean> {
  const existing = await ctx.db
    .query("watchlist")
    .withIndex("by_user_lot", (q) => q.eq("userId", userId).eq("lotId", lotId))
    .first();
  if (existing) return false;
  await ctx.db.insert("watchlist", { userId, lotId });
  await adjustWatcherCount(ctx, lotId, 1);
  return true;
}
