/**
 * Admin review of buyer registrations: per-document approve/reject, and the
 * manual EFT deposit steps (received, refunded).
 *
 * Decrypted personal details are only returned by an audited mutation
 * (`getRegistrationForReview`), the same rule as `getProfileForKYC`
 * (ADR 0006). Queries here return no decrypted PII, and no function returns a
 * storage URL or id: files are served by the auth-checked `/documents/file`
 * route, by document id.
 */

import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import type { Doc } from "../_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { decryptPII, logAudit } from "../admin_utils";
import { formatNotificationRand, notifyUser } from "../auctions/internal";
import { requireAdmin } from "../lib/auth";
import {
  isLeadingOpenLot,
  loadUnpaidPayments,
  refundableRemainder,
} from "../lib/depositRefund";
import { applyDepositCredit } from "../lib/lotPayments";
import { getBidEligibility } from "../lib/bidGuard";
import type { RegDocKind } from "../lib/registration";
import { requiredKinds, syncKycStatus } from "../lib/registration";
import { logActivity } from "../userActivity";
import { getDepositSetting } from "./platformSettings";

/** Longest accepted rejection reason. */
export const MAX_REVIEW_REASON_LENGTH = 300;

/** Where buyers see their registration progress. */
const STATUS_LINK = "/register/status";

/** Registration documents read per user (four kinds exist). */
const DOCUMENT_READ_CAP = 10;

/** Buyer-facing names of the document kinds. */
const DOC_LABELS: Record<RegDocKind, string> = {
  id_front: "ID front",
  id_back: "ID back",
  passport_photo: "Passport photo page",
  proof_of_address: "Proof of address",
};

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

const SuccessValidator = v.object({ success: v.boolean() });

/** One deposit in the admin queue. No decrypted PII. */
const DepositRowValidator = v.object({
  userId: v.string(),
  name: v.optional(v.string()),
  reference: v.string(),
  status: depositStatusValidator,
  amount: v.number(),
  paidClaimedAt: v.optional(v.number()),
  receivedAt: v.optional(v.number()),
  receivedAmount: v.optional(v.number()),
  refundRequestedAt: v.optional(v.number()),
  refundedAt: v.optional(v.number()),
  /** What a refund would return (received minus what a won lot used). */
  refundableAmount: v.number(),
  updatedAt: v.number(),
});

/** Convex pagination result shape for deposit rows. */
const DepositPageValidator = v.object({
  page: v.array(DepositRowValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
  pageStatus: v.optional(v.union(v.string(), v.null())),
  splitCursor: v.optional(v.union(v.string(), v.null())),
});

/** The review payload: decrypted details, document metadata and the deposit. */
const ReviewValidator = v.object({
  details: v.object({
    idType: v.optional(idTypeValidator),
    fullName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    idNumber: v.optional(v.string()),
    passportNumber: v.optional(v.string()),
    countryOfIssue: v.optional(v.string()),
    streetAddress: v.optional(v.string()),
    town: v.optional(v.string()),
    postalCode: v.optional(v.string()),
  }),
  documents: v.array(
    v.object({
      id: v.id("registrationDocuments"),
      kind: docKindValidator,
      status: docStatusValidator,
      fileName: v.string(),
      fileSize: v.number(),
      contentType: v.optional(v.string()),
      uploadedAt: v.number(),
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
      paidClaimedAt: v.optional(v.number()),
      receivedAt: v.optional(v.number()),
      receivedAmount: v.optional(v.number()),
      refundedAt: v.optional(v.number()),
    })
  ),
  submittedAt: v.optional(v.number()),
  legacy: v.boolean(),
});

/**
 * Loads a profile by user id.
 *
 * @param ctx - Query or mutation context
 * @param userId - The user
 * @returns The profile, or null
 */
async function loadProfile(
  ctx: QueryCtx,
  userId: string
): Promise<Doc<"profiles"> | null> {
  return await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

/**
 * Loads a user's deposit row.
 *
 * @param ctx - Query or mutation context
 * @param userId - The user
 * @returns The deposit, or null
 */
async function loadDeposit(
  ctx: QueryCtx,
  userId: string
): Promise<Doc<"registrationDeposits"> | null> {
  return await ctx.db
    .query("registrationDeposits")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

/**
 * Turns a deposit row into a queue row. The name is the plain display name,
 * never decrypted PII.
 *
 * @param ctx - Query context
 * @param deposit - The deposit row
 * @returns The queue row
 */
async function toDepositRow(
  ctx: QueryCtx,
  deposit: Doc<"registrationDeposits">
) {
  const profile = await loadProfile(ctx, deposit.userId);
  return {
    userId: deposit.userId,
    name: profile?.name,
    reference: deposit.reference,
    status: deposit.status,
    amount: deposit.amount,
    paidClaimedAt: deposit.paidClaimedAt,
    receivedAt: deposit.receivedAt,
    receivedAmount: deposit.receivedAmount,
    refundRequestedAt: deposit.refundRequestedAt,
    refundedAt: deposit.refundedAt,
    refundableAmount: refundableRemainder(deposit),
    updatedAt: deposit.updatedAt,
  };
}

/**
 * Admin: everything the review dialog needs for one buyer. A mutation so that
 * viewing decrypted personal details is audited. Document entries carry no URL
 * or storage id; files are read through `/documents/file?id=`.
 */
export const getRegistrationForReview = mutation({
  args: { userId: v.string() },
  returns: v.union(v.null(), ReviewValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const profile = await loadProfile(ctx, args.userId);
    if (!profile) return null;

    const [
      documents,
      deposit,
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
      ctx.db
        .query("registrationDocuments")
        .withIndex("by_userId_and_kind", (q) => q.eq("userId", args.userId))
        .take(DOCUMENT_READ_CAP),
      loadDeposit(ctx, args.userId),
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

    await logAudit(ctx, {
      action: "VIEW_REGISTRATION_DETAILS",
      targetId: args.userId,
      targetType: "user",
    });

    const fallbackName = [firstName, lastName].filter(Boolean).join(" ");
    return {
      details: {
        idType: profile.idType,
        fullName: fullName ?? (fallbackName === "" ? undefined : fallbackName),
        phoneNumber,
        idNumber,
        passportNumber,
        countryOfIssue: profile.countryOfIssue,
        streetAddress,
        town,
        postalCode,
      },
      documents: documents.map((doc) => ({
        id: doc._id,
        kind: doc.kind,
        status: doc.status,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        contentType: doc.contentType,
        uploadedAt: doc.uploadedAt,
        rejectionReason: doc.rejectionReason,
        reviewedAt: doc.reviewedAt,
      })),
      deposit: deposit
        ? {
            reference: deposit.reference,
            status: deposit.status,
            amount: deposit.amount,
            paidClaimedAt: deposit.paidClaimedAt,
            receivedAt: deposit.receivedAt,
            receivedAmount: deposit.receivedAmount,
            refundedAt: deposit.refundedAt,
          }
        : null,
      submittedAt: profile.registrationSubmittedAt,
      legacy: documents.length === 0 && (profile.kycDocuments ?? []).length > 0,
    };
  },
});

/**
 * Admin: approve or reject one registration document. A rejection needs a
 * reason (trimmed, at most 300 characters) and tells the buyer which document
 * to replace. The buyer's KYC status follows the documents via `syncKycStatus`.
 */
export const reviewDocument = mutation({
  args: {
    documentId: v.id("registrationDocuments"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    reason: v.optional(v.string()),
    // The upload the admin looked at; a re-upload replaces the row in place.
    expectedUploadedAt: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    kycStatus: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    let reason: string | undefined;
    if (args.decision === "reject") {
      reason = args.reason?.trim();
      if (!reason) throw new ConvexError("A rejection reason is required.");
      if (reason.length > MAX_REVIEW_REASON_LENGTH) {
        throw new ConvexError(
          `The reason must be at most ${String(MAX_REVIEW_REASON_LENGTH)} characters.`
        );
      }
    }

    const doc = await ctx.db.get("registrationDocuments", args.documentId);
    if (!doc) throw new ConvexError("Document not found.");
    const profile = await loadProfile(ctx, doc.userId);
    if (!profile) throw new ConvexError("Profile not found.");
    if (
      profile.registrationSubmittedAt === undefined ||
      profile.idType === undefined
    ) {
      throw new ConvexError(
        "This registration hasn't been submitted for review."
      );
    }
    if (doc.uploadedAt !== args.expectedUploadedAt) {
      throw new ConvexError(
        "This document was replaced. Reopen the review to see the new file."
      );
    }
    if (!requiredKinds(profile.idType).includes(doc.kind)) {
      throw new ConvexError("That document isn't needed for this ID type.");
    }
    const target = args.decision === "approve" ? "approved" : "rejected";
    if (doc.status === target && doc.rejectionReason === reason) {
      // Same decision again: nothing to change, notify or audit.
      return { success: true, kycStatus: profile.kycStatus };
    }

    await ctx.db.patch("registrationDocuments", doc._id, {
      status: target,
      rejectionReason: reason,
      reviewedAt: Date.now(),
      reviewedBy: admin.userId ?? admin._id,
    });
    await syncKycStatus(ctx, profile);

    const updated = (await loadProfile(ctx, doc.userId)) ?? profile;
    if (args.decision === "reject") {
      await notifyUser(ctx, {
        recipientId: doc.userId,
        type: "warning",
        title: `Replace your ${DOC_LABELS[doc.kind]}`,
        message: reason ?? "",
        link: STATUS_LINK,
      });
      await logActivity(ctx, {
        userId: doc.userId,
        type: "verification_rejected",
        description: `${DOC_LABELS[doc.kind]} rejected: ${reason ?? ""}`,
      });
    } else if (updated.isVerified && !profile.isVerified) {
      const [setting, deposit] = await Promise.all([
        getDepositSetting(ctx),
        loadDeposit(ctx, doc.userId),
      ]);
      const depositDue = setting.enabled && deposit?.status !== "received";
      await notifyUser(ctx, {
        recipientId: doc.userId,
        type: "success",
        title: "Documents approved",
        message: depositDue
          ? "You can bid once your deposit is received."
          : "You can bid.",
        link: STATUS_LINK,
      });
      await logActivity(ctx, {
        userId: doc.userId,
        type: "verification_approved",
        description: "Registration documents approved",
      });
    }

    await logAudit(ctx, {
      action: `REGISTRATION_DOC_${args.decision.toUpperCase()}`,
      targetId: doc.userId,
      targetType: "user",
      details: reason === undefined ? doc.kind : `${doc.kind}: ${reason}`,
    });

    return { success: true, kycStatus: updated.kycStatus };
  },
});

/**
 * Admin: the deposit queue by status, newest first (without a status the rows
 * come in index order: status, then newest first). Returns the plain display
 * name only; decrypted details need the audited `getRegistrationForReview`.
 */
export const listDeposits = query({
  args: {
    status: v.optional(depositStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: DepositPageValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { status } = args;
    const result = await ctx.db
      .query("registrationDeposits")
      .withIndex("by_status_and_updatedAt", (q) =>
        status === undefined ? q : q.eq("status", status)
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((row) => toDepositRow(ctx, row))),
    };
  },
});

/**
 * Admin: find a deposit by its payment reference (trimmed, upper-cased).
 */
export const findDepositByReference = query({
  args: { reference: v.string() },
  returns: v.union(v.null(), DepositRowValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const reference = args.reference.trim().toUpperCase();
    if (reference === "") return null;
    const deposit = await ctx.db
      .query("registrationDeposits")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .first();
    return deposit ? await toDepositRow(ctx, deposit) : null;
  },
});

/**
 * Loads a user's deposit for a state change, or throws.
 *
 * @param ctx - Mutation context
 * @param userId - The user
 * @returns The deposit
 */
async function requireDeposit(
  ctx: MutationCtx,
  userId: string
): Promise<Doc<"registrationDeposits">> {
  const deposit = await loadDeposit(ctx, userId);
  if (!deposit) throw new ConvexError("No deposit found for this user.");
  return deposit;
}

/**
 * Admin: record that the EFT arrived. Allowed from awaiting or paid_claimed,
 * and only for at least the deposit amount.
 */
export const markDepositReceived = mutation({
  args: { userId: v.string(), receivedAmount: v.number() },
  returns: SuccessValidator,
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const deposit = await requireDeposit(ctx, args.userId);
    if (deposit.status !== "awaiting" && deposit.status !== "paid_claimed") {
      throw new ConvexError(
        deposit.status === "received"
          ? "This deposit is already marked received."
          : deposit.status === "refund_requested"
            ? "This deposit was already received; the buyer has asked for it back."
            : "A refunded deposit can't be marked received until the buyer pays again."
      );
    }
    // Written so that NaN also fails.
    if (
      !Number.isFinite(args.receivedAmount) ||
      args.receivedAmount < deposit.amount
    ) {
      throw new ConvexError("Amount is less than the deposit.");
    }

    const now = Date.now();
    await ctx.db.patch("registrationDeposits", deposit._id, {
      status: "received",
      receivedAt: now,
      receivedAmount: args.receivedAmount,
      markedReceivedBy: admin.userId ?? admin._id,
      updatedAt: now,
    });

    // Credit the deposit against the buyer's earliest awaiting payment, if any.
    await applyDepositCredit(ctx, args.userId, now);

    const profile = await loadProfile(ctx, args.userId);
    const canBid =
      profile !== null && (await getBidEligibility(ctx, profile)).kind === "ok";
    await notifyUser(ctx, {
      recipientId: args.userId,
      type: "success",
      title: "Deposit received",
      message: canBid
        ? "You can bid."
        : "We'll let you know when your documents are approved.",
      link: STATUS_LINK,
    });
    await logAudit(ctx, {
      action: "DEPOSIT_RECEIVED",
      targetId: args.userId,
      targetType: "user",
      details: `${deposit.reference}: received ${String(args.receivedAmount)}`,
    });
    return { success: true };
  },
});

/**
 * Admin: record that a received deposit was refunded to the buyer.
 */
export const markDepositRefunded = mutation({
  args: { userId: v.string() },
  returns: SuccessValidator,
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const deposit = await requireDeposit(ctx, args.userId);
    if (
      deposit.status !== "received" &&
      deposit.status !== "refund_requested"
    ) {
      throw new ConvexError("Only a received deposit can be refunded.");
    }
    // A lot may have been sold to the buyer since they asked: the deposit is
    // then still needed for that payment.
    if (deposit.status === "refund_requested") {
      const { awaiting, claimed } = await loadUnpaidPayments(ctx, args.userId);
      if (awaiting.length + claimed.length > 0) {
        throw new ConvexError(
          "This buyer has won lots that aren't paid yet. Ask them to cancel the request or pay first."
        );
      }
    }
    // Either way the deposit backs the bids on a lot that isn't decided yet.
    if (await isLeadingOpenLot(ctx, args.userId)) {
      throw new ConvexError(
        "This buyer is the top bidder on a lot that isn't decided yet."
      );
    }
    // What a won lot's payment already used can't be refunded as well.
    const refunded = refundableRemainder(deposit);
    if (refunded <= 0) {
      throw new ConvexError(
        "This deposit was credited against a won lot's payment and can't be refunded."
      );
    }

    const now = Date.now();
    await ctx.db.patch("registrationDeposits", deposit._id, {
      status: "refunded",
      refundedAt: now,
      refundedBy: admin.userId ?? admin._id,
      refundedAmount: refunded,
      updatedAt: now,
    });
    await notifyUser(ctx, {
      recipientId: args.userId,
      type: "info",
      title: "Deposit refunded",
      message: `We've refunded ${formatNotificationRand(refunded)} to the account you paid from.`,
      link: STATUS_LINK,
    });
    await logAudit(ctx, {
      action: "DEPOSIT_REFUNDED",
      targetId: args.userId,
      targetType: "user",
      details: `${deposit.reference}: refunded ${String(refunded)}`,
    });
    return { success: true };
  },
});
