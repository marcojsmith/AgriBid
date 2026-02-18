import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { components } from "./_generated/api";
import { logAudit, encryptPII, decryptPII } from "./admin_utils";

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
 * Retrieve the current caller's role from their profile.
 *
 * @returns The caller's role (for example, `"admin"` or `"buyer"`), or `null` if the caller is not authenticated or no profile exists.
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

/**
 * Admin: List all profiles for moderation and management.
 * Restricted to callers with `admin` role.
 */
export const listAllProfiles = query({
  args: {},
  handler: async (ctx) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Unauthorized");
    }

    const profiles = await ctx.db.query("profiles").collect();

    // Parallelize user lookups
    const profilesWithUsers = await Promise.all(
      profiles.map(async (p) => {
        let user = await ctx.runQuery(components.auth.adapter.findOne, {
          model: "user",
          where: [{ field: "userId", operator: "eq", value: p.userId }]
        });

        if (!user) {
          user = await ctx.runQuery(components.auth.adapter.findOne, {
            model: "user",
            where: [{ field: "_id", operator: "eq", value: p.userId }]
          });
        }

        return {
          ...p,
          name: user?.name,
          email: user?.email,
          image: user?.image,
          idNumber: p.idNumber ? await decryptPII(p.idNumber) : undefined,
        };
      })
    );

    return profilesWithUsers;
  },
});

/**
 * Admin: Mark a profile as verified.
 */
export const verifyUser = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Unauthorized");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    
    if (!profile) throw new Error("Profile not found");

    const now = Date.now();
    await ctx.db.patch(profile._id, {
      isVerified: true,
      updatedAt: now,
    });

    await logAudit(ctx, {
        action: "VERIFY_USER",
        targetId: userId,
        targetType: "user",
    });

    return { success: true };
  },
});

/**
 * Admin: Promote a user to admin role.
 */
export const promoteToAdmin = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Unauthorized");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    
    if (!profile) throw new Error("Profile not found");

    const now = Date.now();
    await ctx.db.patch(profile._id, {
      role: "admin",
      updatedAt: now,
    });

    await logAudit(ctx, {
        action: "PROMOTE_ADMIN",
        targetId: userId,
        targetType: "user",
    });

    return { success: true };
  },
});

/**
 * User: Submit KYC documents for verification.
 */
export const submitKYC = mutation({
  args: { 
    documents: v.array(v.string()), 
    firstName: v.string(),
    lastName: v.string(),
    phoneNumber: v.string(),
    idNumber: v.string(),
    email: v.string()
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");
    const userId = authUser.userId ?? authUser._id;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    
    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      kycStatus: "pending",
      kycDocuments: args.documents,
      firstName: args.firstName,
      lastName: args.lastName,
      phoneNumber: args.phoneNumber,
      idNumber: await encryptPII(args.idNumber),
      kycEmail: args.email,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});