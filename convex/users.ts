import { v, ConvexError } from "convex/values";
import { paginationOptsValidator, type PaginationOptions } from "convex/server";

import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  getAuthUser,
  requireAuth,
  resolveUserId,
  requireAdmin,
  getAuthenticatedUserId,
} from "./lib/auth";
import type { Doc } from "./_generated/dataModel";
import { logAudit, decryptPII, updateCounter, countQuery } from "./admin_utils";
import { logActivity } from "./userActivity";
import { syncSellerSlug } from "./lib/sellerSlugs";
import { sellerResponseTimeValidator } from "./lib/provinces";
import { getPresenceThresholdMs } from "./presence";
import { sellerTypeValidator, type SellerType } from "./lib/lotSpecs";
import { MAX_PROFILE_BIO_LENGTH, MAX_PROFILE_FIELD_LENGTH } from "./constants";

/** Where an About-text edit stands in the admin review. */
export const bioStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected")
);

/**
 * Validator for a profile document from the database.
 */
export const ProfileValidator = v.object({
  _id: v.id("profiles"),
  _creationTime: v.number(),
  userId: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  role: v.union(v.literal("buyer"), v.literal("seller"), v.literal("admin")),
  isVerified: v.boolean(),
  kycStatus: v.optional(
    v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"))
  ),
  kycRejectionReason: v.optional(v.string()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  idNumber: v.optional(v.string()),
  kycEmail: v.optional(v.string()),
  bio: v.optional(v.string()),
  phoneNumber: v.optional(v.string()),
  companyName: v.optional(v.string()),
  location: v.optional(v.string()),
  sellerResponseTime: v.optional(sellerResponseTimeValidator),
  idType: v.optional(v.union(v.literal("sa_id"), v.literal("passport"))),
  fullName: v.optional(v.string()),
  passportNumber: v.optional(v.string()),
  countryOfIssue: v.optional(v.string()),
  streetAddress: v.optional(v.string()),
  town: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  registrationSubmittedAt: v.optional(v.number()),
  emailVerified: v.optional(v.boolean()),
  phoneVerified: v.optional(v.boolean()),
  bankingVerified: v.optional(v.boolean()),
  taxNumberVerified: v.optional(v.boolean()),
  vatRegistered: v.optional(v.boolean()),
  sellerType: v.optional(sellerTypeValidator),
  publicName: v.optional(v.string()),
  slug: v.optional(v.string()),
  bioPending: v.optional(v.string()),
  bioStatus: v.optional(bioStatusValidator),
  bioRejectionReason: v.optional(v.string()),
  bioSubmittedAt: v.optional(v.number()),
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
  /** How many legacy KYC files the user has; read file `n` via `/documents/file`. */
  kycDocumentCount: v.number(),
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
  kycDocumentCount: v.optional(v.number()),
});

/**
 * Strips the stored-file references from a profile before it leaves the
 * server: clients never see storage ids (`/api/storage/<id>` has no access
 * check), only a document count and the auth-checked download route.
 *
 * It also drops `collectionAddress` (encrypted at rest; only the owner's
 * `getMyCollectionAddress` and a confirmed winner's collection details return
 * it, decrypted), which the strict profile validator does not carry.
 *
 * @param profile - The profile row
 * @returns The profile without `kycDocuments`, `kycDocumentsEncrypted` and `collectionAddress`
 */
function withoutDocumentRefs(
  profile: Doc<"profiles">
): Omit<
  Doc<"profiles">,
  "kycDocuments" | "kycDocumentsEncrypted" | "collectionAddress"
> {
  const rest: Partial<Doc<"profiles">> = { ...profile };
  delete rest.kycDocuments;
  delete rest.kycDocumentsEncrypted;
  delete rest.collectionAddress;
  return rest as Omit<
    Doc<"profiles">,
    "kycDocuments" | "kycDocumentsEncrypted" | "collectionAddress"
  >;
}

/**
 * Handler for synchronizing user with profile.
 * @param ctx - Convex mutation context
 * @returns Promise<null | { success: boolean }>
 */
export const syncUserHandler = async (ctx: MutationCtx) => {
  try {
    const authUser = await requireAuth(ctx);
    const linkId = resolveUserId(authUser);
    if (!linkId) return null;

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", linkId))
      .unique();

    const now = Date.now();
    // Only persist name/email when the Clerk identity actually provides a
    // non-empty value, so a missing/null claim (e.g. a transient identity-token
    // gap) can't wipe an already-stored value.
    const identityFields: { name?: string; email?: string } = {};
    if (authUser.name) identityFields.name = authUser.name;
    if (authUser.email) identityFields.email = authUser.email;

    if (!existingProfile) {
      await ctx.db.insert("profiles", {
        userId: linkId,
        ...identityFields,
        role: "buyer",
        isVerified: false,
        createdAt: now,
        updatedAt: now,
      });
      await updateCounter(ctx, "profiles", "total", 1);
      await logActivity(ctx, {
        userId: linkId,
        type: "account_created",
        description: "Account created",
      });
    } else {
      await ctx.db.patch("profiles", existingProfile._id, {
        ...identityFields,
        updatedAt: now,
      });
      // A Clerk rename can change the public seller name (when no company or
      // registration name is set); refresh it for sellers.
      if (
        identityFields.name !== undefined &&
        identityFields.name !== existingProfile.name
      ) {
        await syncSellerSlug(ctx, { ...existingProfile, ...identityFields });
      }
    }

    return { success: true };
  } catch (err) {
    if (err instanceof Error && !err.message.includes("Unauthenticated")) {
      console.error("Error in syncUser:", err);
    }
    return null;
  }
};

/**
 * Synchronise the authenticated user with their application profile.
 */
export const syncUser = mutation({
  args: {},
  returns: v.union(v.null(), v.object({ success: v.boolean() })),
  handler: syncUserHandler,
});

/**
 * Handler for getting current user's profile.
 * @param ctx - Convex query context
 * @returns Promise<null | UserProfile>
 */
export const getMyProfileHandler = async (ctx: QueryCtx) => {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return null;

    const linkId = resolveUserId(authUser);
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
      profile: profile ? withoutDocumentRefs(profile) : null,
    };
  } catch (err) {
    if (err instanceof Error && !err.message.includes("Unauthenticated")) {
      console.error("Error in getMyProfile:", err);
    }
    return null;
  }
};

/**
 * Fetch the full profile for the authenticated user.
 */
export const getMyProfile = query({
  args: {},
  returns: v.union(v.null(), UserProfileValidator),
  handler: getMyProfileHandler,
});

/**
 * Handler for listing all profiles (admin).
 * @param ctx - Convex query context
 * @param args - Query arguments
 * @param args.paginationOpts - Convex pagination options
 * @returns Promise<PaginatedUserProfiles>
 */
export const listAllProfilesHandler = async (
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions }
) => {
  await requireAdmin(ctx);

  const profilesQuery = ctx.db.query("profiles");
  const [profiles, counter] = await Promise.all([
    profilesQuery.order("desc").paginate(args.paginationOpts),
    ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "profiles"))
      .unique(),
  ]);
  const totalCount =
    counter?.total ?? (await countQuery(ctx.db.query("profiles")));

  const now = Date.now();

  // Batch presence lookups for the entire page, deduplicating IDs first
  const userIds = Array.from(new Set(profiles.page.map((p) => p.userId)));
  const [presences, thresholdMs] = await Promise.all([
    Promise.all(
      userIds.map((uid) =>
        ctx.db
          .query("presence")
          .withIndex("by_userId", (q) => q.eq("userId", uid))
          .unique()
      )
    ),
    getPresenceThresholdMs(ctx),
  ]);
  const presenceMap = new Map(
    presences
      .filter((presence): presence is Doc<"presence"> => presence !== null)
      .map((presence) => [presence.userId, presence])
  );

  // Map presence from the pre-fetched map
  const page = profiles.page.map((p: Doc<"profiles">) => {
    const presence = presenceMap.get(p.userId);

    const isOnline = presence ? now - presence.updatedAt < thresholdMs : false;

    return {
      _id: p._id,
      _creationTime: p._creationTime,
      userId: p.userId,
      role: p.role,
      isVerified: p.isVerified,
      kycStatus: p.kycStatus,
      name: p.name,
      email: p.email,
      sellerResponseTime: p.sellerResponseTime,
      vatRegistered: p.vatRegistered,
      sellerType: p.sellerType,
      createdAt: p.createdAt,
      isOnline,
    };
  });

  return {
    ...profiles,
    page,
    totalCount,
  };
};

/**
 * Admin: List all profiles for moderation and management.
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
        sellerResponseTime: v.optional(sellerResponseTimeValidator),
        vatRegistered: v.optional(v.boolean()),
        sellerType: v.optional(sellerTypeValidator),
        createdAt: v.number(),
        isOnline: v.boolean(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: listAllProfilesHandler,
});

/**
 * Handler for fetching profile for KYC (admin).
 * @param ctx - Convex mutation context
 * @param root0 - Destructured handler arguments
 * @param root0.userId - The user id of the profile to fetch
 * @returns Promise<null | ProfileForKYC>
 */
export const getProfileForKYCHandler = async (
  ctx: MutationCtx,
  { userId }: { userId: string }
) => {
  await requireAdmin(ctx);

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (!profile) return null;

  const [decIdNumber, decFirstName, decLastName, decPhone, decEmail] =
    await Promise.all([
      decryptPII(profile.idNumber),
      decryptPII(profile.firstName),
      decryptPII(profile.lastName),
      decryptPII(profile.phoneNumber),
      decryptPII(profile.kycEmail),
    ]);

  await logAudit(ctx, {
    action: "VIEW_KYC_DETAILS",
    targetId: userId,
    targetType: "user",
  });

  return {
    ...withoutDocumentRefs(profile),
    name: profile.name,
    email: profile.email,
    firstName: decFirstName,
    lastName: decLastName,
    phoneNumber: decPhone,
    kycEmail: decEmail,
    idNumber: decIdNumber,
    kycDocumentCount: (profile.kycDocuments ?? []).length,
  };
};

/**
 * Admin: Fetch a full profile with decrypted PII for KYC review.
 */
export const getProfileForKYC = mutation({
  args: { userId: v.string() },
  returns: v.union(v.null(), ProfileForKYCValidator),
  handler: getProfileForKYCHandler,
});

/**
 * Handler for verifying user (admin).
 * @param ctx - Convex mutation context
 * @param root0 - Destructured handler arguments
 * @param root0.userId - The user id of the profile to verify
 * @returns Promise<{ success: boolean }>
 */
export const verifyUserHandler = async (
  ctx: MutationCtx,
  { userId }: { userId: string }
) => {
  await requireAdmin(ctx);

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
    await ctx.db.patch("profiles", profile._id, {
      isVerified: true,
      // KYC submission includes the user's email, so approval verifies it.
      ...(profile.kycEmail ? { emailVerified: true } : {}),
      updatedAt: now,
    });

    await updateCounter(ctx, "profiles", "verified", 1);

    await logActivity(ctx, {
      userId,
      type: "verification_approved",
      description: "Verification approved",
    });
  }

  await logAudit(ctx, {
    action: "VERIFY_USER",
    targetId: userId,
    targetType: "user",
  });

  return { success: true };
};

/**
 * Admin: Mark a profile as verified.
 */
export const verifyUser = mutation({
  args: { userId: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: verifyUserHandler,
});

/**
 * Handler for promoting user to admin (admin).
 * @param ctx - Convex mutation context
 * @param root0 - Destructured handler arguments
 * @param root0.userId - The user id of the profile to promote
 * @returns Promise<{ success: boolean }>
 */
export const promoteToAdminHandler = async (
  ctx: MutationCtx,
  { userId }: { userId: string }
) => {
  await requireAdmin(ctx);

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
  await ctx.db.patch("profiles", profile._id, {
    role: "admin",
    updatedAt: now,
  });

  await logActivity(ctx, {
    userId,
    type: "role_changed",
    description: "Promoted to admin",
  });

  await logAudit(ctx, {
    action: "PROMOTE_ADMIN",
    targetId: userId,
    targetType: "user",
  });

  return { success: true };
};

/**
 * Admin: Promote a user to admin role.
 */
export const promoteToAdmin = mutation({
  args: { userId: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: promoteToAdminHandler,
});

/**
 * Handler for getting user's own KYC details.
 * @param ctx - Convex query context
 * @returns Promise<null | KYCDetails>
 */
export const getMyKYCDetailsHandler = async (ctx: QueryCtx) => {
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

    const [decFirstName, decLastName, decIdNumber, decPhone, decEmail] =
      await Promise.all([
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
      kycDocumentCount: (profile.kycDocuments ?? []).length,
    };
  } catch (err) {
    if (err instanceof Error && !err.message.includes("Unauthenticated")) {
      console.error("Error in getMyKYCDetails:", err);
    }
    return null;
  }
};

/**
 * User: Fetch their own decrypted KYC details.
 */
export const getMyKYCDetails = query({
  args: {},
  returns: v.union(v.null(), KYCDetailsValidator),
  handler: getMyKYCDetailsHandler,
});

/**
 * Update the authenticated user's profile fields (bio, location, companyName).
 * Throws ConvexError if no profile exists.
 * @param ctx - Mutation context.
 * @param args - Fields to update.
 * @param args.bio - Optional short biography for the profile.
 * @param args.location - Optional location of the user.
 * @param args.companyName - Optional company name of the user.
 * @param args.vatRegistered - Optional VAT registration status of the seller.
 * @param args.sellerType - Optional seller type.
 * @returns null on success.
 */
export const updateMyProfileHandler = async (
  ctx: MutationCtx,
  args: {
    bio?: string;
    location?: string;
    companyName?: string;
    vatRegistered?: boolean;
    sellerType?: SellerType;
  }
): Promise<null> => {
  const userId = await getAuthenticatedUserId(ctx);

  if (args.bio !== undefined) {
    const trimmedBio = args.bio.trim();
    if (trimmedBio.length > MAX_PROFILE_BIO_LENGTH) {
      throw new ConvexError(
        `Bio is too long. Maximum ${MAX_PROFILE_BIO_LENGTH.toString()} characters allowed.`
      );
    }
  }

  if (args.location !== undefined) {
    const trimmedLocation = args.location.trim();
    if (trimmedLocation.length > MAX_PROFILE_FIELD_LENGTH) {
      throw new ConvexError(
        `Location is too long. Maximum ${MAX_PROFILE_FIELD_LENGTH.toString()} characters allowed.`
      );
    }
  }

  if (args.companyName !== undefined) {
    const trimmedCompanyName = args.companyName.trim();
    if (trimmedCompanyName.length > MAX_PROFILE_FIELD_LENGTH) {
      throw new ConvexError(
        `Company name is too long. Maximum ${MAX_PROFILE_FIELD_LENGTH.toString()} characters allowed.`
      );
    }
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (!profile) {
    throw new ConvexError("Profile not found");
  }

  const { bio, ...rest } = args;
  const now = Date.now();
  await ctx.db.patch("profiles", profile._id, {
    ...rest,
    ...(bio !== undefined && bioPatch(profile, bio.trim(), now)),
    updatedAt: now,
  });

  // The public name follows the company name; refresh it (and the slug) when
  // that changed. Sellers only: a buyer with no listings gets no slug.
  if (
    args.companyName !== undefined &&
    args.companyName.trim() !== (profile.companyName ?? "").trim()
  ) {
    await syncSellerSlug(ctx, {
      ...profile,
      companyName: args.companyName,
    });
  }

  return null;
};

/**
 * The profile fields to write for a bio edit. The live `bio` is never touched
 * here: new text waits in `bioPending` for an admin. Empty text clears the live
 * bio and any pending text at once (nothing to review), and text equal to the
 * live bio just withdraws a pending edit.
 *
 * @param profile - The profile being edited
 * @param bio - The trimmed bio the seller submitted
 * @param now - Current time in epoch milliseconds
 * @returns The patch to merge into the profile
 */
function bioPatch(
  profile: Doc<"profiles">,
  bio: string,
  now: number
): Partial<Doc<"profiles">> {
  const cleared = {
    bioPending: undefined,
    bioStatus: undefined,
    bioRejectionReason: undefined,
    bioSubmittedAt: undefined,
  };
  if (bio === "") return { ...cleared, bio: undefined };
  if (bio === (profile.bio ?? "")) return cleared;
  if (bio === profile.bioPending && profile.bioStatus === "pending") return {};
  return {
    bioPending: bio,
    bioStatus: "pending",
    bioRejectionReason: undefined,
    bioSubmittedAt: now,
  };
}

/**
 * Update the authenticated user's profile fields (bio, location, companyName).
 * A changed bio goes to admin review; the live bio stays until it is approved.
 * Throws ConvexError if no profile exists.
 */
export const updateMyProfile = mutation({
  args: {
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
    companyName: v.optional(v.string()),
    vatRegistered: v.optional(v.boolean()),
    sellerType: v.optional(sellerTypeValidator),
  },
  returns: v.null(),
  handler: updateMyProfileHandler,
});

/**
 * Handler for the admin override of a seller's VAT profile.
 * @param ctx - Mutation context.
 * @param args - Target user and the fields to set.
 * @param args.userId - The user id of the profile to update.
 * @param args.vatRegistered - Whether the seller is VAT-registered.
 * @param args.sellerType - The seller's type.
 * @returns null on success.
 */
export const adminSetSellerVatProfileHandler = async (
  ctx: MutationCtx,
  args: { userId: string; vatRegistered?: boolean; sellerType?: SellerType }
): Promise<null> => {
  await requireAdmin(ctx);

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .unique();
  if (!profile) throw new ConvexError("Profile not found");

  await ctx.db.patch("profiles", profile._id, {
    ...(args.vatRegistered !== undefined && {
      vatRegistered: args.vatRegistered,
    }),
    ...(args.sellerType !== undefined && { sellerType: args.sellerType }),
    updatedAt: Date.now(),
  });

  await logAudit(ctx, {
    action: "UPDATE_SELLER_VAT_PROFILE",
    targetId: args.userId,
    targetType: "user",
    details: JSON.stringify({
      vatRegistered: args.vatRegistered,
      sellerType: args.sellerType,
    }),
  });

  return null;
};

/**
 * Admin: Set a seller's VAT registration status and seller type.
 */
export const adminSetSellerVatProfile = mutation({
  args: {
    userId: v.string(),
    vatRegistered: v.optional(v.boolean()),
    sellerType: v.optional(sellerTypeValidator),
  },
  returns: v.null(),
  handler: adminSetSellerVatProfileHandler,
});

/**
 * Handler for the owner's view of their About text: the live text, any edit
 * waiting for review and the outcome of the last review.
 *
 * @param ctx - Query context
 * @returns The bio state, or null when the caller is signed out or has no profile
 */
export const getMyBioHandler = async (ctx: QueryCtx) => {
  const authUser = await getAuthUser(ctx);
  const userId = authUser ? resolveUserId(authUser) : null;
  if (!userId) return null;

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) return null;

  return {
    bio: profile.bio,
    bioPending: profile.bioPending,
    bioStatus: profile.bioStatus,
    bioRejectionReason: profile.bioRejectionReason,
  };
};

/**
 * Owner: the About text, its pending edit and the review outcome (Account page).
 */
export const getMyBio = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      bio: v.optional(v.string()),
      bioPending: v.optional(v.string()),
      bioStatus: v.optional(bioStatusValidator),
      bioRejectionReason: v.optional(v.string()),
    })
  ),
  handler: getMyBioHandler,
});
