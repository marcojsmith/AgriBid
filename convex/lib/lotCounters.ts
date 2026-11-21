import { getCounter, updateCounter } from "../admin_utils";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Counter row name holding the last lot number issued in a sale.
 * @param auctionId - The auction container id.
 * @returns The counter name.
 */
export const lotNumberCounterName = (auctionId: Id<"auctions">) =>
  `lotNumber:${auctionId}`;

/**
 * Counter row name holding a lot's watcher count (in `total`).
 * @param lotId - The lot id.
 * @returns The counter name.
 */
export const watcherCounterName = (lotId: Id<"lots">) => `watchers:${lotId}`;

/**
 * Issues the next lot number for a sale from a monotonic per-auction counter.
 * Numbers are never reused within a sale, even after a lot is unassigned.
 * Convex mutations are serialisable, so concurrent assignments conflict and
 * retry rather than issuing the same number twice.
 *
 * @param ctx - Mutation context.
 * @param auctionId - The auction container the lot is being assigned to.
 * @returns The newly issued lot number (starting at 1).
 */
export async function issueNextLotNumber(
  ctx: MutationCtx,
  auctionId: Id<"auctions">
): Promise<number> {
  const name = lotNumberCounterName(auctionId);
  const counter = await getCounter(ctx, name);
  const next = (counter?.total ?? 0) + 1;
  await updateCounter(ctx, name, "total", next, true);
  return next;
}

/**
 * Applies a delta to a lot's watcher counter, never going below 0.
 *
 * @param ctx - Mutation context.
 * @param lotId - The watched lot.
 * @param delta - `+1` on watch, `-1` on unwatch.
 */
export async function adjustWatcherCount(
  ctx: MutationCtx,
  lotId: Id<"lots">,
  delta: 1 | -1
): Promise<void> {
  await updateCounter(ctx, watcherCounterName(lotId), "total", delta);
}

/**
 * Reads a lot's watcher count from its counter row (a single indexed read).
 *
 * @param ctx - Query or mutation context.
 * @param lotId - The lot.
 * @returns The watcher count, 0 when no counter exists.
 */
export async function getWatcherCount(
  ctx: QueryCtx,
  lotId: Id<"lots">
): Promise<number> {
  const counter = await getCounter(ctx, watcherCounterName(lotId));
  return counter?.total ?? 0;
}
