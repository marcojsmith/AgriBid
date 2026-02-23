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
    console.error("getAuthUser failed:", err);
    return null;
  }
}

/**
 * Internal helper to get caller role from an already fetched AuthUser.
 * Avoids duplicate auth lookups when AuthUser is already available.
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
function resolveUserId(authUser: AuthUser): string | null {
  return authUser.userId ?? authUser._id ?? null;
}

/**
 * Ensures a user is authenticated and returns the authenticated user.
 *
 * @param ctx - Query or Mutation context
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
 * Retrieve the authenticated user along with their profile and resolved userId.
 *
 * @returns An object with `authUser`, `profile`, and `userId`, or `null` if the caller is not authenticated, the userId cannot be determined, the profile is not found, or an error occurs
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
 * Ensure the current user is authenticated and obtain their profile and userId.
 *
 * @returns An object with `authUser`, `profile`, and `userId`
 * @throws Error when the user is not authenticated
 * @throws Error when the user identity cannot be determined ("Unable to determine user identity")
 * @throws Error when the user profile is not found ("User profile not found")
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
 * Ensure the authenticated user's account has completed KYC verification.
 *
 * @param ctx - The query or mutation context containing authentication and database access
 * @returns `true` if the authenticated user's profile is verified
 * @throws Error if the user is not authenticated, the profile cannot be found, or the profile is not verified
 */
export async function requireVerified(ctx: QueryCtx | MutationCtx) {
  const { profile } = await requireProfile(ctx);

  if (!profile.isVerified) {
    throw new Error(
      "Account verification required. Please complete KYC verification."
    );
  }

  return true;
}
