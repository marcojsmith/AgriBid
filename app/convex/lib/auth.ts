/**
 * Authentication and authorization utilities for Backend operations.
 *
 * Provides centralized auth functions to eliminate code duplication and ensure
 * consistent error handling across the application.
 */

import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";

/**
 * Retrieves the authenticated user from the current context.
 *
 * @param ctx - Query or Mutation context
 * @returns The authenticated user object, or null if not authenticated
 * @throws Never throws - returns null if unauthenticated
 */
export async function getAuthUser(ctx: QueryCtx | MutationCtx) {
  try {
    return await authComponent.getAuthUser(ctx);
  } catch {
    return null;
  }
}

/**
 * Retrieves the authenticated user from the current context.
 *
 * @param ctx - Query or Mutation context
 * @returns The authenticated user object
 * @throws Error("Not authenticated") if user is not authenticated
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
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return null;

    const linkId = authUser.userId ?? authUser._id;
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
 * Retrieves the authenticated user and verifies they have admin role.
 *
 * @param ctx - Query or Mutation context
 * @returns The authenticated user object
 * @throws Error("Not authenticated") if user is not authenticated
 * @throws Error("Unauthorized: Admin privileges required") if user is not an admin
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const authUser = await requireAuth(ctx);
  const role = await getCallerRole(ctx);

  if (role !== "admin") {
    throw new Error("Not authorized: Admin privileges required");
  }

  return authUser;
}

/**
 * Retrieves the authenticated user's profile with merged identity and application metadata.
 *
 * @param ctx - Query or Mutation context
 * @returns An object containing the auth user and their profile, or null if not authenticated
 */
export async function getAuthenticatedProfile(ctx: QueryCtx | MutationCtx) {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return null;

    const linkId = authUser.userId ?? authUser._id;
    if (!linkId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", linkId))
      .unique();

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
 * Retrieves the authenticated user's profile or throws if not found.
 *
 * @param ctx - Query or Mutation context
 * @returns An object containing the auth user and their profile
 * @throws Error if user is not authenticated or profile is not found
 */
export async function requireProfile(ctx: QueryCtx | MutationCtx) {
  const authUser = await requireAuth(ctx);

  const linkId = authUser.userId ?? authUser._id;
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
 * Verifies that the authenticated user is verified (KYC complete).
 *
 * @param ctx - Query or Mutation context
 * @returns True if user is verified
 * @throws Error if user is not authenticated or not verified
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
