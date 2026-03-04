/**
 * Authentication and authorization utilities for Backend operations.
 *
 * Provides centralized auth functions to eliminate code duplication and ensure
 * consistent error handling across the application.
 */

import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";
import type { AuthUser } from "../auth";

/**
 * Retrieve the authenticated user associated with the provided context.
 *
 * @param ctx - Query or Mutation context used to resolve the current user
 * @returns The authenticated user object, or `null` if no user is authenticated
 */
export async function getAuthUser(ctx: QueryCtx | MutationCtx) {
  try {
    return await authComponent.getAuthUser(ctx);
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
      console.error("getAuthUser failed:", err);
    }
    return null;
  }
}

/**
 * Internal helper to get caller role from an already fetched AuthUser.
 * Avoids duplicate auth lookups when AuthUser is already available.
 * @param ctx
 * @param authUser
 * @returns The user's role or null if not found.
 */
async function _getCallerRoleFromAuthUser(
  ctx: QueryCtx | MutationCtx,
  authUser: AuthUser
): Promise<string | null> {
  try {
    const linkId = resolveUserId(authUser);
    if (!linkId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", linkId))
      .unique();

    return profile?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the user ID from an AuthUser object.
 * @param authUser The authenticated user object.
 * @returns The resolved user ID as a string, or null if it cannot be determined.
 */
export function resolveUserId(authUser: AuthUser): string | null {
  return authUser.userId ?? authUser._id;
}

/**
 * Ensure the caller is authenticated and return the authenticated user.
 *
 * @param ctx
 * @returns The authenticated user
 * @throws Error("Not authenticated") if no authenticated user is found
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const authUser = await getAuthUser(ctx);
  if (!authUser) {
    throw new Error("Not authenticated");
  }
  return authUser;
}

/**
 * Get the authenticated user's ID, throwing if not authenticated or ID cannot be determined.
 *
 * This helper combines the common pattern of:
 *   1. Getting the auth user
 *   2. Checking if authenticated
 *   3. Resolving the user ID
 *
 * @param ctx
 * @returns The resolved user ID string
 * @throws Error("Not authenticated") if no user is authenticated
 * @throws Error("Unable to determine user ID") if user ID cannot be resolved
 */
export async function getAuthenticatedUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const authUser = await requireAuth(ctx);
  const userId = resolveUserId(authUser);
  if (!userId) {
    throw new Error("Unable to determine user ID");
  }
  return userId;
}

/**
 * Retrieves the authenticated user's role from their profile.
 *
 * @param ctx - Query or Mutation context
 * @returns The user's role (e.g., "admin", "buyer", "seller"), or null if not found
 */
export async function getCallerRole(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  const authUser = await getAuthUser(ctx);
  if (!authUser) return null;
  return await _getCallerRoleFromAuthUser(ctx, authUser);
}

/**
 * Ensure the current caller is authenticated and has an admin role.
 *
 * @param ctx
 * @returns The authenticated user object
 * @throws Error("Not authenticated") if no authenticated user is present
 * @throws Error("Not authorized: Admin privileges required") if the authenticated user is not an admin
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const authUser = await requireAuth(ctx);
  const role = await _getCallerRoleFromAuthUser(ctx, authUser);

  if (role !== "admin") {
    throw new Error("Not authorized: Admin privileges required");
  }

  return authUser;
}

/**
 * Get the authenticated user together with their profile and resolved userId when available.
 *
 * @param ctx
 * @returns `{ authUser, profile, userId }` containing the authenticated user, their profile and the resolved userId, or `null` if the caller is not authenticated, the userId cannot be determined, the profile is not found, or an error occurs
 */
export async function getAuthenticatedProfile(ctx: QueryCtx | MutationCtx) {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return null;

    const linkId = resolveUserId(authUser);
    if (!linkId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", linkId))
      .unique();

    if (!profile) return null;

    return {
      authUser,
      profile,
      userId: linkId,
    };
  } catch {
    return null;
  }
}

/**
 * Ensure the current user is authenticated and return their auth user, profile and resolved userId.
 *
 * @param ctx
 * @returns An object containing `authUser`, `profile` and `userId`
 * @throws Error When the user is not authenticated
 * @throws Error When the user identity cannot be determined ("Unable to determine user identity")
 * @throws Error When the user profile is not found ("User profile not found")
 */
export async function requireProfile(ctx: QueryCtx | MutationCtx) {
  const authUser = await requireAuth(ctx);

  const linkId = resolveUserId(authUser);
  if (!linkId) {
    throw new Error("Unable to determine user identity");
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", linkId))
    .unique();

  if (!profile) {
    throw new Error("User profile not found");
  }

  return {
    authUser,
    profile,
    userId: linkId,
  };
}

/**
 * Ensure the caller has an authenticated profile and that the profile is verified.
 *
 * @param ctx - The query or mutation context containing authentication and database access
 * @returns An object containing `profile`, `authUser`, and `userId` for the verified user
 * @throws Error if the user is not authenticated, the profile cannot be found, or the profile is not verified
 */
export async function requireVerified(ctx: QueryCtx | MutationCtx) {
  const { profile, ...rest } = await requireProfile(ctx);

  if (!profile.isVerified) {
    throw new Error(
      "Account verification required. Please complete KYC verification."
    );
  }

  return { profile, ...rest };
}
