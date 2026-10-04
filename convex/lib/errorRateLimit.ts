/**
 * Rate limiting for error report submission.
 *
 * Uses a short-lived in-memory cache backed by DB queries to limit
 * the number of error reports submitted per time window.
 */

import type { QueryCtx } from "../_generated/server";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REPORTS_PER_WINDOW = 10;
const RATE_LIMIT_CACHE_TTL_MS = 5_000;

const rateLimitCache: { count: number; expiresAt: number } = {
  count: 0,
  expiresAt: 0,
};

/**
 * Check rate limit for error reporting using a short-lived cache backed by DB queries.
 *
 * @param ctx - Convex context for DB queries
 * @returns True if rate limit is not exceeded
 */
export async function checkRateLimit(ctx: QueryCtx): Promise<boolean> {
  const now = Date.now();

  if (now < rateLimitCache.expiresAt) {
    return rateLimitCache.count < MAX_REPORTS_PER_WINDOW;
  }

  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recentReports = await ctx.db
    .query("errorReports")
    .withIndex("by_createdAt", (q) => q.gte("createdAt", windowStart))
    .collect();

  rateLimitCache.count = recentReports.length;
  rateLimitCache.expiresAt = now + RATE_LIMIT_CACHE_TTL_MS;

  return rateLimitCache.count < MAX_REPORTS_PER_WINDOW;
}
