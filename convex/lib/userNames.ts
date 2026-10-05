import type { QueryCtx } from "../_generated/server";

/**
 * Display-name resolution for user ids.
 *
 * Admin-facing queries (flag queues, reports) and bid histories all need the
 * human-readable name behind a user id. Every call site did the same thing:
 * collect the distinct ids on the page, read each one's profile through the
 * `by_userId` index, and substitute a placeholder when no name comes back.
 */

/** Placeholder used when a user id resolves to no profile name. */
export const UNKNOWN_USER_NAME = "Unknown User";

/** Options accepted by {@link resolveDisplayNames}. */
export interface ResolveDisplayNamesOptions {
  /**
   * Placeholder to use when an id resolves to no profile name. Defaults to
   * {@link UNKNOWN_USER_NAME}; call sites that already displayed a different
   * placeholder (for example "Anonymous" for bid histories) pass it in so the
   * observable output is unchanged.
   */
  fallback?: string;
}

/**
 * Resolves the display name of each user id, reading every profile at most once.
 *
 * Ids are de-duplicated before any read, so a page that mentions the same user
 * in several rows costs a single profile lookup. Every requested id is present
 * in the returned map, mapped to its profile name or to the fallback.
 *
 * Blank ids are not looked up — no profile can be keyed on an empty user id —
 * and take the fallback instead.
 *
 * @param ctx - Convex query context.
 * @param userIds - The user ids to resolve; duplicates are read only once.
 * @param options - Optional placeholder override.
 * @returns Map of userId to display name.
 */
export async function resolveDisplayNames(
  ctx: QueryCtx,
  userIds: Iterable<string>,
  options: ResolveDisplayNamesOptions = {}
): Promise<Map<string, string>> {
  const fallback = options.fallback ?? UNKNOWN_USER_NAME;
  const names = new Map<string, string>();

  await Promise.all(
    Array.from(new Set(userIds)).map(async (userId) => {
      if (userId === "") {
        names.set(userId, fallback);
        return;
      }

      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();

      names.set(userId, profile?.name ?? fallback);
    })
  );

  return names;
}
