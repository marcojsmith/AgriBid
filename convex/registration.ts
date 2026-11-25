/**
 * Buyer registration: personal details, identity and address documents, and the
 * EFT deposit. Every function needs a signed-in user and only touches the
 * caller's own data. Admin review and the deposit "received" step live in the
 * admin modules.
 */

import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { decryptPII, encryptPII, logAudit, updateCounter } from "./admin_utils";
import { getDepositSetting } from "./admin/platformSettings";
import {
  MAX_COUNTRY_OF_ISSUE_LENGTH,
  MAX_PROFILE_FIELD_LENGTH,
} from "./constants";
import { requireAuth, requireProfile } from "./lib/auth";
import {
  isLeadingOpenLot,
  loadUnpaidPayments,
  refundableRemainder,
} from "./lib/depositRefund";
import { applyDepositCredit, isReferenceTaken } from "./lib/lotPayments";
import { formatNotificationRand, notifyUser } from "./lib/notify";
import { bidEligibilityValidator, hasAllDetails } from "./lib/bidEligibility";
import { getBidEligibility } from "./lib/bidGuard";
import {
  cleanRequired,
  generateReference,
  isValidPassportNumber,
  isValidPostalCode,
  isValidSaId,
  requiredKinds,
  syncKycStatus,
  type IdType,
  type RegDocKind,
} from "./lib/registration";
import { safeDelete } from "./lib/storage";
import { logActivity } from "./userActivity";

const idTypeValidator = v.union(v.literal("sa_id"), v.literal("passport"));
const docKindValidator = v.union(
  v.literal("id_front"),
  v.literal("id_back"),
  v.literal("passport_photo"),
  v.literal("proof_of_address")
);
const docStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected")
);
const depositStatusValidator = v.union(
  v.literal("awaiting"),
  v.literal("paid_claimed"),
  v.literal("received"),
  v.literal("refund_requested"),
  v.literal("refunded")
);

/** Admins told about a refund request (a handful exist). */
const ADMIN_NOTIFY_CAP = 20;

/** E.164 phone number, e.g. +27825550147. */
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** How many times a unique deposit reference is retried before giving up. */
const REFERENCE_ATTEMPTS = 5;

/** Registration documents read per user (four kinds exist). */
const DOCUMENT_READ_CAP = 10;

/** ID document kinds that belong to one ID type (proof of address is shared). */
const ID_KINDS: Record<IdType, RegDocKind[]> = {
  sa_id: ["id_front", "id_back"],
  passport: ["passport_photo"],
};

/**
 * Loads the caller's profile, throwing when signed out or without a profile.
 *
 * @param ctx - Query or mutation context
 * @returns The profile and user id
 */
async function loadCaller(
  ctx: QueryCtx
): Promise<{ profile: Doc<"profiles">; userId: string }> {
  await requireAuth(ctx);
  return await requireProfile(ctx);
}

/**
 * Loads a user's registration document rows.
 *
 * @param ctx - Query context
 * @param userId - The user
 * @returns Up to one row per kind
 */
async function loadDocuments(
  ctx: QueryCtx,
  userId: string
): Promise<Doc<"registrationDocuments">[]> {
  return await ctx.db
    .query("registrationDocuments")
    .withIndex("by_userId_and_kind", (q) => q.eq("userId", userId))
    .take(DOCUMENT_READ_CAP);
}

/** Validator for the caller's decrypted registration details. */
const DetailsValidator = v.object({
  idType: v.optional(idTypeValidator),
  fullName: v.optional(v.string()),
  phoneNumber: v.optional(v.string()),
  idNumber: v.optional(v.string()),
  passportNumber: v.optional(v.string()),
  countryOfIssue: v.optional(v.string()),
  streetAddress: v.optional(v.string()),
  town: v.optional(v.string()),
  postalCode: v.optional(v.string()),
});

/**
 * Buyer: everything the register screens need in one query: eligibility,
 * decrypted details, document metadata (no URLs: files are served by the
 * auth-checked `/documents/file` route), the deposit and its settings.
 * Null when the caller has no profile yet.
 */
export const getMyRegistration = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      eligibility: bidEligibilityValidator,
      details: DetailsValidator,
      documents: v.array(
        v.object({
          id: v.id("registrationDocuments"),
          kind: docKindValidator,
          status: docStatusValidator,
          fileName: v.string(),
          fileSize: v.number(),
          contentType: v.string(),
          rejectionReason: v.optional(v.string()),
          reviewedAt: v.optional(v.number()),
        })
      ),
      deposit: v.union(
        v.null(),
        v.object({
          reference: v.string(),
          status: depositStatusValidator,
          amount: v.number(),
          receivedAt: v.optional(v.number()),
          refundRequestedAt: v.optional(v.number()),
          refundedAt: v.optional(v.number()),
          /** Rand a refund would return (received minus what a won lot used). */
          refundableAmount: v.number(),
        })
      ),
      depositSettings: v.object({
        enabled: v.boolean(),
        amount: v.number(),
        refundDays: v.number(),
      }),
      submittedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    await requireAuth(ctx);
    let profile: Doc<"profiles">;
    let userId: string;
    try {
      ({ profile, userId } = await requireProfile(ctx));
    } catch {
      return null;
    }

    const [
      eligibility,
      documents,
      deposit,
      depositSettings,
      fullName,
      phoneNumber,
      idNumber,
      passportNumber,
      streetAddress,
      town,
      postalCode,
      firstName,
      lastName,
    ] = await Promise.all([
      getBidEligibility(ctx, profile),
      loadDocuments(ctx, userId),
      ctx.db
        .query("registrationDeposits")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique(),
      getDepositSetting(ctx),
      decryptPII(profile.fullName),
      decryptPII(profile.phoneNumber),
      decryptPII(profile.idNumber),
      decryptPII(profile.passportNumber),
      decryptPII(profile.streetAddress),
      decryptPII(profile.town),
      decryptPII(profile.postalCode),
      decryptPII(profile.firstName),
      decryptPII(profile.lastName),
    ]);

    const prefill = [firstName, lastName].filter(Boolean).join(" ");
    // Never a URL or storage id: files are read only through the
    // auth-checked `/documents/file` route, by document id.
    const docRows = documents.map((doc) => ({
      id: doc._id,
      kind: doc.kind,
      status: doc.status,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      contentType: doc.contentType ?? "application/octet-stream",
      rejectionReason: doc.rejectionReason,
      reviewedAt: doc.reviewedAt,
    }));

    return {
      eligibility,
      details: {
        idType: profile.idType,
        fullName: fullName ?? (prefill === "" ? undefined : prefill),
        phoneNumber,
        idNumber,
        passportNumber,
        countryOfIssue: profile.countryOfIssue,
        streetAddress,
        town,
        postalCode,
      },
      documents: docRows,
      deposit: deposit
        ? {
            reference: deposit.reference,
            status: deposit.status,
            amount: deposit.amount,
            receivedAt: deposit.receivedAt,
            refundRequestedAt: deposit.refundRequestedAt,
            refundedAt: deposit.refundedAt,
            refundableAmount: refundableRemainder(deposit),
          }
        : null,
      depositSettings,
      submittedAt: profile.registrationSubmittedAt,
    };
  },
});

/**
 * Buyer: just the bid eligibility (no decryption), for gating the bid button.
 * Null when the caller has no profile yet.
 */
export const getMyBidEligibility = query({
  args: {},
  returns: v.union(v.null(), bidEligibilityValidator),
  handler: async (ctx) => {
    await requireAuth(ctx);
    try {
      const { profile } = await requireProfile(ctx);
      return await getBidEligibility(ctx, profile);
    } catch {
      return null;
    }
  },
});

/**
 * Deletes a registration document row and its stored file.
 *
 * @param ctx - Mutation context
 * @param doc - The row to delete
 */
async function deleteDocument(
  ctx: MutationCtx,
  doc: Doc<"registrationDocuments">
): Promise<void> {
  await safeDelete(ctx, doc.storageId, "registration document");
  await ctx.db.delete("registrationDocuments", doc._id);
}

/**
 * Buyer: save the personal and address details. Switching the ID type deletes
 * the other type's ID documents and their files and sends the registration
 * back to "not submitted".
 */
export const saveMyDetails = mutation({
  args: {
    idType: idTypeValidator,
    fullName: v.string(),
    phoneNumber: v.string(),
    idNumber: v.optional(v.string()),
    passportNumber: v.optional(v.string()),
    countryOfIssue: v.optional(v.string()),
    streetAddress: v.string(),
    town: v.string(),
    postalCode: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { profile, userId } = await loadCaller(ctx);

    const fullName = cleanRequired(
      "Full name",
      args.fullName,
      MAX_PROFILE_FIELD_LENGTH
    );
    const phoneNumber = args.phoneNumber.trim();
    if (!E164_PATTERN.test(phoneNumber)) {
      throw new ConvexError(
        "Enter a valid mobile number with country code, e.g. +27825550147."
      );
    }
    const streetAddress = cleanRequired(
      "Street address",
      args.streetAddress,
      MAX_PROFILE_FIELD_LENGTH
    );
    const town = cleanRequired("Town", args.town, MAX_PROFILE_FIELD_LENGTH);
    const postalCode = cleanRequired(
      "Postal code",
      args.postalCode,
      MAX_PROFILE_FIELD_LENGTH
    );
    if (!isValidPostalCode(postalCode)) {
      throw new ConvexError("Enter a valid postal code.");
    }

    let idNumber: string | undefined;
    let passportNumber: string | undefined;
    let countryOfIssue: string | undefined;
    if (args.idType === "sa_id") {
      idNumber = (args.idNumber ?? "").trim();
      if (!isValidSaId(idNumber)) {
        throw new ConvexError(
          "Enter a valid 13-digit South African ID number."
        );
      }
    } else {
      passportNumber = (args.passportNumber ?? "").trim().toUpperCase();
      if (!isValidPassportNumber(passportNumber)) {
        throw new ConvexError("Enter a valid passport number.");
      }
      countryOfIssue = cleanRequired(
        "Country of issue",
        args.countryOfIssue ?? "",
        MAX_COUNTRY_OF_ISSUE_LENGTH
      );
    }

    // ID kinds of the previous type, when the buyer is switching types.
    const staleKinds =
      profile.idType === undefined || profile.idType === args.idType
        ? null
        : ID_KINDS[profile.idType];
    if (profile.isVerified) {
      throw new ConvexError(
        "Your details are locked once your documents are approved. Contact support to change them."
      );
    }
    // While the review is open (submitted, nothing rejected) the reviewer is
    // looking at these details, so they cannot move underneath them.
    const reviewRows = await loadDocuments(ctx, userId);
    if (
      profile.registrationSubmittedAt !== undefined &&
      !reviewRows.some((doc) => doc.status === "rejected")
    ) {
      throw new ConvexError("Your details are under review.");
    }

    const [encName, encPhone, encId, encPassport, encStreet, encTown, encPost] =
      await Promise.all([
        encryptPII(fullName),
        encryptPII(phoneNumber),
        encryptPII(idNumber),
        encryptPII(passportNumber),
        encryptPII(streetAddress),
        encryptPII(town),
        encryptPII(postalCode),
      ]);

    const patch: Partial<Doc<"profiles">> = {
      idType: args.idType,
      fullName: encName,
      phoneNumber: encPhone,
      idNumber: encId,
      passportNumber: encPassport,
      countryOfIssue,
      streetAddress: encStreet,
      town: encTown,
      postalCode: encPost,
      updatedAt: Date.now(),
    };

    if (staleKinds !== null) {
      const rows = await loadDocuments(ctx, userId);
      for (const row of rows) {
        if (staleKinds.includes(row.kind)) await deleteDocument(ctx, row);
      }
      // The old submission no longer covers the required documents.
      patch.registrationSubmittedAt = undefined;
      if (profile.kycStatus === "pending") {
        patch.kycStatus = undefined;
        await updateCounter(ctx, "profiles", "pending", -1);
      } else if (profile.kycStatus === "rejected") {
        patch.kycStatus = undefined;
        patch.kycRejectionReason = undefined;
      }
    }

    await ctx.db.patch("profiles", profile._id, patch);
    return { success: true };
  },
});

/**
 * Buyer: send the registration for review. Needs the details and every
 * required document.
 */
export const submitMyDocuments = mutation({
  args: {},
  returns: v.object({ submittedAt: v.number() }),
  handler: async (ctx) => {
    const { profile, userId } = await loadCaller(ctx);
    if (profile.idType === undefined || !hasAllDetails(profile)) {
      throw new ConvexError("Complete your details before submitting.");
    }
    const uploaded = new Set(
      (await loadDocuments(ctx, userId)).map((doc) => doc.kind)
    );
    const missing = requiredKinds(profile.idType).filter(
      (kind) => !uploaded.has(kind)
    );
    if (missing.length > 0) {
      throw new ConvexError(
        "Upload every required document before submitting."
      );
    }

    const submittedAt = Date.now();
    await ctx.db.patch("profiles", profile._id, {
      registrationSubmittedAt: submittedAt,
      updatedAt: submittedAt,
    });
    await syncKycStatus(ctx, {
      ...profile,
      registrationSubmittedAt: submittedAt,
    });
    await logActivity(ctx, {
      userId,
      type: "verification_requested",
      description: "Registration documents submitted for review",
    });
    return { submittedAt };
  },
});

/**
 * Buyer: get (or create) the EFT deposit reference. Idempotent: the reference
 * is permanent. Throws when the deposit is switched off.
 */
export const startMyDeposit = mutation({
  args: {},
  returns: v.object({ reference: v.string() }),
  handler: async (ctx) => {
    const { userId } = await loadCaller(ctx);
    const setting = await getDepositSetting(ctx);
    if (!setting.enabled) {
      throw new ConvexError("A deposit isn't required right now.");
    }

    const existing = await ctx.db
      .query("registrationDeposits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (existing) return { reference: existing.reference };

    for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt++) {
      const reference = generateReference();
      // Unique across deposits AND lot payments: both are quoted on EFTs.
      if (await isReferenceTaken(ctx, reference)) continue;
      const now = Date.now();
      await ctx.db.insert("registrationDeposits", {
        userId,
        reference,
        status: "awaiting",
        amount: setting.amount,
        createdAt: now,
        updatedAt: now,
      });
      return { reference };
    }
    throw new ConvexError("Couldn't create a payment reference. Try again.");
  },
});

/**
 * Buyer: "I've paid". Moves an awaiting (or refunded) deposit to
 * `paid_claimed` so admins see it in their queue. Safe to repeat.
 */
export const claimMyDepositPaid = mutation({
  args: {},
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx) => {
    const { userId } = await loadCaller(ctx);
    const deposit = await ctx.db
      .query("registrationDeposits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!deposit) throw new ConvexError("Get your payment reference first.");

    if (deposit.status === "awaiting" || deposit.status === "refunded") {
      const now = Date.now();
      await ctx.db.patch("registrationDeposits", deposit._id, {
        status: "paid_claimed",
        paidClaimedAt: now,
        updatedAt: now,
      });
      await logAudit(ctx, {
        action: "DEPOSIT_PAID_CLAIMED",
        targetId: userId,
        targetType: "user",
        details: `Buyer says deposit ${deposit.reference} is paid`,
      });
    }
    return { success: true };
  },
});

/**
 * Buyer: ask for the received deposit back. Allowed only when the deposit is
 * `received`, something is left to refund (a won lot's credit is not
 * refundable), every won lot is paid for (awaiting and paid_claimed count as
 * unpaid), and the buyer does not lead a lot that is still open. Moves the
 * deposit to `refund_requested`, which no longer counts towards bidding, and
 * tells the admins.
 */
export const requestDepositRefund = mutation({
  args: {},
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx) => {
    const { userId } = await loadCaller(ctx);
    const deposit = await ctx.db
      .query("registrationDeposits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!deposit) throw new ConvexError("There's nothing left to refund.");
    // Asking twice is harmless.
    if (deposit.status === "refund_requested") return { success: true };
    if (deposit.status !== "received" || refundableRemainder(deposit) <= 0) {
      throw new ConvexError("There's nothing left to refund.");
    }

    const { awaiting, claimed } = await loadUnpaidPayments(ctx, userId);
    if (awaiting.length + claimed.length > 0) {
      throw new ConvexError("Pay for your won lots first.");
    }
    if (await isLeadingOpenLot(ctx, userId)) {
      throw new ConvexError(
        "You're the highest bidder on a lot. You can ask once it closes."
      );
    }

    const now = Date.now();
    await ctx.db.patch("registrationDeposits", deposit._id, {
      status: "refund_requested",
      refundRequestedAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "DEPOSIT_REFUND_REQUESTED",
      targetId: userId,
      targetType: "user",
      details: `Buyer asked for deposit ${deposit.reference} to be refunded`,
    });
    // Registration submissions only show up in the admin queue; a refund is a
    // money-out step, so the admins are also told in-app.
    const admins = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .take(ADMIN_NOTIFY_CAP);
    for (const admin of admins) {
      await notifyUser(ctx, {
        recipientId: admin.userId,
        type: "info",
        title: "Deposit refund requested",
        message: `Deposit ${deposit.reference} (${formatNotificationRand(refundableRemainder(deposit))}) was requested back.`,
        link: "/admin/deposits",
      });
    }
    return { success: true };
  },
});

/**
 * Buyer: take a refund request back. `refund_requested` returns to `received`
 * (the deposit counts for bidding again). Does nothing in any other status.
 */
export const cancelDepositRefundRequest = mutation({
  args: {},
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx) => {
    const { userId } = await loadCaller(ctx);
    const deposit = await ctx.db
      .query("registrationDeposits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (deposit?.status !== "refund_requested") return { success: true };
    const now = Date.now();
    await ctx.db.patch("registrationDeposits", deposit._id, {
      status: "received",
      refundRequestedAt: undefined,
      updatedAt: now,
    });
    // A lot may have been won while the deposit was `refund_requested` (the
    // credit only applies to a `received` deposit), so credit it now.
    await applyDepositCredit(ctx, userId, now);
    return { success: true };
  },
});
