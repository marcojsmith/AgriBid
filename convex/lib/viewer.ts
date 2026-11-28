import { getAuthUser, resolveUserId } from "./auth";
import type { QueryCtx } from "../_generated/server";

/** Who is asking, as far as seller privacy is concerned. */
export interface Viewer {
  /** The caller's user id, or null for a guest. */
  userId: string | null;
  /** Whether the caller's profile has the admin role. */
  isAdmin: boolean;
}

/**
 * Identifies the caller of a public query without ever throwing for a guest.
 *
 * @param ctx - Query context
 * @returns The caller's id (null for guests) and whether they are an admin
 */
export async function getViewer(ctx: QueryCtx): Promise<Viewer> {
  const authUser = await getAuthUser(ctx);
  const userId = authUser ? resolveUserId(authUser) : null;
  if (!userId) return { userId: null, isAdmin: false };
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  return { userId, isAdmin: profile?.role === "admin" };
}

/**
 * Whether the caller may see private data about a seller: only the seller
 * themselves and admins.
 *
 * @param ctx - Query context
 * @param sellerId - The seller's user id
 * @returns True for the seller and for admins
 */
export async function canSeeSellerPrivate(
  ctx: QueryCtx,
  sellerId: string
): Promise<boolean> {
  const viewer = await getViewer(ctx);
  return (
    viewer.isAdmin || (viewer.userId !== null && viewer.userId === sellerId)
  );
}
