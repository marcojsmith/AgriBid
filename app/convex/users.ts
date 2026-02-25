import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUser, getCallerRole } from "./lib/auth";
import { components } from "./_generated/api";
import { logAudit, encryptPII, decryptPII, updateCounter } from "./admin_utils";

/**
 * Validator for a profile document from the database.
 */
export const ProfileValidator = v.object({
  _id: v.id("profiles"),
  _creationTime: v.number(),
  userId: v.string(),
  role: v.union(v.literal("buyer"), v.literal("seller"), v.literal("admin")),
  isVerified: v.boolean(),
  kycStatus: v.optional(
    v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"))
  ),
  kycDocuments: v.optional(v.array(v.id("_storage"))),
  kycRejectionReason: v.optional(v.string()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  idNumber: v.optional(v.string()),
  kycEmail: v.optional(v.string()),
  bio: v.optional(v.string()),
  phoneNumber: v.optional(v.string()),
  companyName: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * Validator for the return type of getMyProfile, combining auth user with profile.
 * Uses v.object with optional fields to handle the dynamic auth user type.
 */
export const UserProfileValidator = v.object({
  _id: v.string(),
  userId: v.optional(v.string()),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  profile: v.union(ProfileValidator, v.null()),
});

/**
 * Validator for profile with decrypted PII (used in getProfileForKYC).
 */
export const ProfileForKYCValidator = ProfileValidator.extend({
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  kycDocumentIds: v.optional(v.array(v.id("_storage"))),
  kycDocumentUrls: v.optional(v.array(v.string())),
});

/**
 * Validator for KYC details (used in getMyKYCDetails).
 */
export const KYCDetailsValidator = v.object({
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  idNumber: v.optional(v.string()),
  phoneNumber: v.optional(v.string()),
  kycEmail: v.optional(v.string()),
  kycDocumentIds: v.optional(v.array(v.id("_storage"))),
  kycDocumentUrls: v.optional(v.array(v.string())),
});

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
  returns: v.union(v.null(), v.object({ success: v.boolean() })),
  handler: async (ctx) => {
    try {
      const authUser = await getAuthUser(ctx);
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
        await updateCounter(ctx, "profiles", "total", 1);
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
  returns: v.union(v.null(), UserProfileValidator),
  handler: async (ctx) => {
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
        _id: authUser._id,
        userId: authUser.userId ?? undefined,
        name: authUser.name ?? undefined,
        email: authUser.email ?? undefined,
        profile: profile ?? null,
      };
    } catch (err) {
      if (err instanceof Error && !err.message.includes("Unauthenticated")) {
        console.error("Error in getMyProfile:", err);
      }
      return null;
    }
  },
});

// Re-export getCallerRole for backward compatibility
export { getCallerRole };

/**
 * Admin: List all profiles for moderation and management.
 * Restricted to callers with `admin` role.
 */
export const listAllProfiles = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("profiles"),
        _creationTime: v.number(),
        userId: v.string(),
        role: v.string(),
        isVerified: v.boolean(),
        kycStatus: v.optional(v.string()),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        createdAt: v.number(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Unauthorized");
    }

    const profiles = await ctx.db
      .query("profiles")
      .order("desc")
      .paginate(args.paginationOpts);

    // Parallelize user lookups
    const page = await Promise.all(
      profiles.page.map(async (p) => {
        const user = await findUserById(ctx, p.userId);

        return {
          _id: p._id,
          _creationTime: p._creationTime,
          userId: p.userId,
          role: p.role,
          isVerified: p.isVerified,
          kycStatus: p.kycStatus,
          name: user?.name,
          email: user?.email,
          createdAt: p.createdAt,
        };
      })
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
  returns: v.union(v.null(), ProfileForKYCValidator),
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

    const [
      decIdNumber,
      decFirstName,
      decLastName,
      decPhone,
      decEmail,
      kycDocUrls,
    ] = await Promise.all([
      decryptPII(profile.idNumber),
      decryptPII(profile.firstName),
      decryptPII(profile.lastName),
      decryptPII(profile.phoneNumber),
      decryptPII(profile.kycEmail),
      Promise.all(
        (profile.kycDocuments || []).map(async (id) => {
          const url = await ctx.storage.getUrl(id);
          return url;
        })
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
      kycDocumentIds: profile.kycDocuments,
      kycDocumentUrls: kycDocUrls.filter((url): url is string => url !== null),
    };
  },
});

/**
 * Admin: Mark a profile as verified.
 */
export const verifyUser = mutation({
  args: { userId: v.string() },
  returns: v.object({ success: v.boolean() }),
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

    const authUser = await getAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");
    const adminId = authUser.userId ?? authUser._id;

    // Enforce KYC flow unless overridden (Admin override should be rare)
    if (profile.kycStatus !== "verified") {
      console.warn(
        `Admin ${adminId} is manually verifying user ${userId} without completed KYC review.`
      );
    }

    const now = Date.now();
    if (!profile.isVerified) {
      await ctx.db.patch(profile._id, {
        isVerified: true,
        updatedAt: now,
      });

      await updateCounter(ctx, "profiles", "verified", 1);
    }

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
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, { userId }) => {
    const callerRole = await getCallerRole(ctx);
    if (callerRole !== "admin") {
      throw new Error("Unauthorized");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (identity?.subject === userId) {
      throw new ConvexError("Cannot change own role");
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
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const authUser = await getAuthUser(ctx);
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
  returns: v.union(v.null(), KYCDetailsValidator),
  handler: async (ctx) => {
    try {
      const authUser = await getAuthUser(ctx);
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
        kycDocUrls,
      ] = await Promise.all([
        decryptPII(profile.firstName),
        decryptPII(profile.lastName),
        decryptPII(profile.idNumber),
        decryptPII(profile.phoneNumber),
        decryptPII(profile.kycEmail),
        Promise.all(
          (profile.kycDocuments || []).map(async (id) => {
            const url = await ctx.storage.getUrl(id);
            return url;
          })
        ),
      ]);

      return {
        firstName: decFirstName,
        lastName: decLastName,
        idNumber: decIdNumber,
        phoneNumber: decPhone,
        kycEmail: decEmail,
        kycDocumentIds: profile.kycDocuments,
        kycDocumentUrls: kycDocUrls.filter(
          (url): url is string => url !== null
        ),
      };
    } catch (err) {
      if (err instanceof Error && !err.message.includes("Unauthenticated")) {
        console.error("Error in getMyKYCDetails:", err);
      }
      return null;
    }
  },
});

/**
 * User: Delete one of their own KYC documents.
 */
export const deleteMyKYCDocument = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, { storageId }) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) throw new ConvexError("Not authenticated");
    const userId = authUser.userId ?? authUser._id;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new ConvexError("Profile not found");

    if (profile.kycStatus === "pending") {
      throw new ConvexError("Cannot delete document while KYC is pending");
    }

    const kycDocuments = profile.kycDocuments || [];
    if (!kycDocuments.includes(storageId)) {
      throw new ConvexError("Document not found in your profile");
    }

    // Remove from profile
    const updatedDocs = kycDocuments.filter((id) => id !== storageId);
    await ctx.db.patch(profile._id, {
      kycDocuments: updatedDocs,
      updatedAt: Date.now(),
    });

    // Delete from storage
    try {
      await ctx.storage.delete(storageId);
    } catch (err) {
      console.error(
        `Failed to delete storage ${storageId}, may be orphaned:`,
        err
      );
      // Profile update succeeded; storage deletion failure is non-critical
    }

    return { success: true };
  },
});
