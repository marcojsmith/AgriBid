import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";

/**
 * Synchronise the authenticated user with their application profile.
 * Creates a default 'buyer' profile if one doesn't exist.
 */
export const syncUser = mutation({
  args: {},
  handler: async (ctx) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return null;

      // Use userId if set (mocks), otherwise fall back to primary id
      const linkId = authUser.userId ?? authUser._id;
      if (!linkId) return null;

      const existingProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", linkId))
        .unique();

      if (!existingProfile) {
        const now = Date.now();
        await ctx.db.insert("profiles", {
          userId: linkId,
          role: "buyer", // Default role
          isVerified: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      return { success: true };
    } catch (err) {
      // Log errors that aren't just unauthenticated states
      if (err instanceof Error && !err.message.includes("Unauthenticated")) {
        console.error("Error in syncUser:", err);
      }
      return null;
    }
  },
});

/**
 * Fetch the full profile for the authenticated user, 
 * merging core identity and application metadata.
 */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return null;

      const linkId = authUser.userId ?? authUser._id;
      if (!linkId) return null;

      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", linkId))
        .unique();

      return {
        ...authUser,
        profile,
      };
    } catch (err) {
      if (err instanceof Error && !err.message.includes("Unauthenticated")) {
        console.error("Error in getMyProfile:", err);
      }
      return null;
    }
  },
});

/**
 * Helper to get the role of the current caller.
 * Internal use for other mutations/queries.
 */
export async function getCallerRole(ctx: QueryCtx | MutationCtx) {
  try {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) return null;

    const linkId = authUser.userId ?? authUser._id;
    if (!linkId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", linkId))
      .unique();

    return profile?.role ?? null;
  } catch (err) {
    if (err instanceof Error && !err.message.includes("Unauthenticated")) {
      console.error("Error in getCallerRole:", err);
    }
    return null;
  }
}
