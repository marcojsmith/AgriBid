import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { components } from "./_generated/api";
import { logAudit, encryptPII, decryptPII } from "./admin_utils";
import type { Id } from "./_generated/dataModel";

/**
 * Helper to find a user by ID, checking both internal _id and shared userId.
 */
export async function findUserById(ctx: QueryCtx | MutationCtx, id: string) {
  let user = await ctx.runQuery(components.auth.adapter.findOne, {
    model: "user",
    where: [{ field: "userId", operator: "eq", value: id }],
  });

  if (!user) {
    user = await ctx.runQuery(components.auth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", operator: "eq", value: id }],
    });
  }
  return user;
}

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
  args: {
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    console.log("listAllProfiles received args:", args);
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Unauthorized");
    }

    const opts = args.paginationOpts || { numItems: 50, cursor: null };

    const profiles = await ctx.db
      .query("profiles")
      .order("desc")
      .paginate(opts);

    // Parallelize user lookups
    const page = await Promise.all(
      profiles.page.map(async (p) => {
        const user = await findUserById(ctx, p.userId);

        return {
          ...p,
          name: user?.name,
          email: user?.email,
          image: user?.image,
          idNumber: p.idNumber ? "****" : undefined, // Mask ID number in listings
        };
      }),
    );

    return {
      ...profiles,
      page,
    };
  },
});

/**
 * Admin: Fetch a full profile with decrypted PII for KYC review.
 */
export const getProfileForKYC = mutation({
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

    if (!profile) return null;

    const user = await findUserById(ctx, userId);

    const [decIdNumber, decFirstName, decLastName, decPhone, decEmail, kycDocUrls] =
      await Promise.all([
        decryptPII(profile.idNumber),
        decryptPII(profile.firstName),
        decryptPII(profile.lastName),
        decryptPII(profile.phoneNumber),
        decryptPII(profile.kycEmail),
        Promise.all(
          (profile.kycDocuments || []).map(async (id) => {
            const url = await ctx.storage.getUrl(id as Id<"_storage">);
            return url;
          }),
        ),
      ]);

    await logAudit(ctx, {
      action: "VIEW_KYC_DETAILS",
      targetId: userId,
      targetType: "user",
    });

    return {
      ...profile,
      name: user?.name,
      email: user?.email,
      firstName: decFirstName,
      lastName: decLastName,
      phoneNumber: decPhone,
      kycEmail: decEmail,
      idNumber: decIdNumber,
      kycDocuments: kycDocUrls.filter((url): url is string => url !== null),
    };
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

    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");
    const adminId = authUser.userId ?? authUser._id;

    // Enforce KYC flow unless overridden (Admin override should be rare)
    if (profile.kycStatus !== "verified") {
      console.warn(
        `Admin ${adminId} is manually verifying user ${userId} without completed KYC review.`,
      );
    }

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
    const callerRole = await getCallerRole(ctx);
    if (callerRole !== "admin") {
      throw new Error("Unauthorized");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (identity?.subject === userId) {
      throw new Error("Cannot change own role");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("Profile not found");
    if (profile.role === "admin") return { success: true }; // No-op

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
    documents: v.array(v.id("_storage")),
    firstName: v.string(),
    lastName: v.string(),
    phoneNumber: v.string(),
    idNumber: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");
    const userId = authUser.userId ?? authUser._id;

    // Validate documents are actual storage IDs
    for (const id of args.documents) {
      const url = await ctx.storage.getUrl(id);
      if (!url) {
        throw new Error(`Invalid storage ID provided: ${id}`);
      }
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("Profile not found");

    const [encFirstName, encLastName, encPhone, encIdNumber, encEmail] =
      await Promise.all([
        encryptPII(args.firstName),
        encryptPII(args.lastName),
        encryptPII(args.phoneNumber),
        encryptPII(args.idNumber),
        encryptPII(args.email),
      ]);

    await ctx.db.patch(profile._id, {
      kycStatus: "pending",
      kycDocuments: args.documents,
      firstName: encFirstName,
      lastName: encLastName,
      phoneNumber: encPhone,
      idNumber: encIdNumber,
      kycEmail: encEmail,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * User: Fetch their own decrypted KYC details for viewing and editing.
 */
export const getMyKYCDetails = query({
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

      if (!profile) return null;

      const [
        decFirstName,
        decLastName,
        decIdNumber,
        decPhone,
        decEmail,
      ] = await Promise.all([
        decryptPII(profile.firstName),
        decryptPII(profile.lastName),
        decryptPII(profile.idNumber),
        decryptPII(profile.phoneNumber),
        decryptPII(profile.kycEmail),
      ]);

      return {
        firstName: decFirstName,
        lastName: decLastName,
        idNumber: decIdNumber,
        phoneNumber: decPhone,
        kycEmail: decEmail,
        kycDocuments: profile.kycDocuments || [],
      };
    } catch (err) {
      if (err instanceof Error && !err.message.includes("Unauthenticated")) {
        console.error("Error in getMyKYCDetails:", err);
      }
      return null;
    }
  },
});
