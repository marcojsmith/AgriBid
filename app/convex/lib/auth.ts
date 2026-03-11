/**
 * Authentication and authorization utilities for Backend operations.
 *
 * Provides centralized auth functions to eliminate code duplication and ensure
 * consistent error handling across the application.
 */

import { ConvexError } from "convex/values";

import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";
import type { AuthUser } from "../auth";

/**
 * Error message for non-verified users attempting restricted actions.
 */
export const VERIFIED_REQUIRED_MESSAGE =
  "Account verification required. Please complete KYC verification.";

/**
 * Custom error class for unauthorized access attempts.
 */
export class UnauthorizedError extends Error {
  /**
   * Constructs an UnauthorizedError.
   * @param message - The plaintext message to be signed/verified
   */
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Retrieve the authenticated user associated with the provided context.
 *
 * @param ctx - Query or Mutation context used to resolve the current user
 * @returns The authenticated user object, or `null` if no user is authenticated
 */
export async function getAuthUser(ctx: QueryCtx | MutationCtx): Promise<{
  userId?: string | null;
  _id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  _creationTime?: number;
} | null> {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Better Auth's Convex plugin uses the subject to link accounts.
    // If subject is missing, we can't resolve the user via the component.
    if (!identity.subject) {
      return null;
    }

    // Attempt to get user via the component first
    try {
      const user = await authComponent.getAuthUser(ctx);
      if (user) return user;
    } catch (err) {
      // If the component fails with a validation error (likely due to internal query building),
      // we try a manual fallback lookup using the subject.
      if (
        err instanceof Error &&
        err.message.includes("ArgumentValidationError")
      ) {
        // Try to find the user in the 'user' table using the subject as _id
        // The component uses the subject as the primary key if it's a valid ID.
        try {
          // 1. Try direct db.get (only works if subject is a valid Convex ID for some table)
          let userRecord: Record<string, unknown> | null = null;
          try {
            // We use a safe cast for db.get parameter
            const doc = await ctx.db.get(identity.subject as never);
            if (doc) {
              userRecord = doc as Record<string, unknown>;
            }
          } catch {
            // Not a valid ID format for db.get
          }

          // 2. Try adapter lookup by _id if db.get didn't work or return a record
          if (!userRecord) {
            // Accessing internal adapter properties for emergency fallback
            // Using unknown cast to bypass lint while maintaining some structural safety
            const adapterObj = authComponent as unknown as {
              adapter: { findOne: string };
            };
            const contextObj = ctx as unknown as {
              runQuery: (
                fn: string,
                args: Record<string, unknown>
              ) => Promise<Record<string, unknown> | null>;
            };

            userRecord = await contextObj.runQuery(adapterObj.adapter.findOne, {
              model: "user",
              where: [
                { field: "_id", operator: "eq", value: identity.subject },
              ],
            });
          }

          if (userRecord) {
            return {
              _id: (userRecord._id as string) ?? identity.subject,
              userId:
                (userRecord.userId as string | undefined) ??
                (userRecord._id as string) ??
                identity.subject,
              email: userRecord.email as string | undefined,
              name: userRecord.name as string | undefined,
              image: userRecord.image as string | undefined,
              _creationTime: userRecord._creationTime as number | undefined,
            };
          }
        } catch {
          // Fallback failed, continue to standard error handling
        }
      }

      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("getAuthUser fallback lookup failed:", err);
      }
    }

    return null;
  } catch (err) {
    console.error("Critical error in getAuthUser wrapper:", err);
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
    throw new UnauthorizedError("Not authorized: Admin privileges required");
  }

  return authUser;
}

/**
 * Alias for getAuthWithProfile.
 * @param ctx
 * @returns Object containing user identity, profile, and resolved linkId
 */
export async function getAuthenticatedProfile(ctx: QueryCtx | MutationCtx) {
  return await getAuthWithProfile(ctx);
}

/**
 * Get the authenticated user together with their profile and resolved userId when available.
 *
 * Centralized helper to avoid repeated profile lookups.
 *
 * @param ctx
 * @returns Object containing user identity, profile, and resolved linkId
 */
export async function getAuthWithProfile(ctx: QueryCtx | MutationCtx) {
  const authUser = await getAuthUser(ctx);
  if (!authUser) return null;

  const linkId = resolveUserId(authUser);
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
}

/**
 * Ensure the user is authenticated and has a profile.
 *
 * @param ctx
 * @returns Profile and userId
 * @throws Error if not authenticated or profile missing
 */
export async function requireProfile(ctx: QueryCtx | MutationCtx) {
  const result = await getAuthWithProfile(ctx);
  if (!result || !result.profile) {
    throw new ConvexError("Authenticated profile not found");
  }
  return { profile: result.profile, userId: result.userId };
}

/**
 * Ensure user is authenticated and KYC verified.
 *
 * @param ctx
 * @returns Profile and userId
 */
export async function requireVerified(ctx: QueryCtx | MutationCtx) {
  const { profile, userId } = await requireProfile(ctx);
  if (!profile.isVerified) {
    throw new UnauthorizedError(VERIFIED_REQUIRED_MESSAGE);
  }
  return { profile, userId };
}

/**
 * Ensure the current caller is a verified seller.
 *
 * @param ctx
 * @returns Object containing profile and userId
 * @throws UnauthorizedError if the user is not a verified seller
 */
export async function requireVerifiedSeller(ctx: QueryCtx | MutationCtx) {
  const { profile, userId } = await requireVerified(ctx);

  if (profile.role !== "seller" && profile.role !== "admin") {
    throw new UnauthorizedError("Seller account required");
  }

  return { profile, userId };
}
