/**
 * Internal functions behind the personal-document HTTP routes (`/documents/*`).
 * Nothing here is public: only the HTTP actions in `documentsHttp.ts` call
 * these, after resolving the caller from the verified auth token.
 */

import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { MAX_REG_DOC_BYTES } from "./constants";
import {
  cleanRequired,
  MAX_FILE_NAME_LENGTH,
  requiredKinds,
  syncKycStatus,
} from "./lib/registration";
import { safeDelete } from "./lib/storage";

const docKindValidator = v.union(
  v.literal("id_front"),
  v.literal("id_back"),
  v.literal("passport_photo"),
  v.literal("proof_of_address")
);

/** MIME types a stored registration document may carry. */
const ALLOWED_DOC_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

/**
 * Attaches an already-encrypted stored file as the caller's registration
 * document. A replacement overwrites the row, resets it to pending and deletes
 * the old file, with no limit on tries.
 *
 * Throws on any rule violation; the upload action then deletes the blob.
 */
export const attachEncryptedDocument = internalMutation({
  args: {
    userId: v.string(),
    kind: docKindValidator,
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    contentType: v.string(),
  },
  returns: v.object({ documentId: v.id("registrationDocuments") }),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) throw new ConvexError("Profile not found");
    if (profile.idType === undefined) {
      throw new ConvexError("Save your details before uploading documents.");
    }
    if (!requiredKinds(profile.idType).includes(args.kind)) {
      throw new ConvexError("That document isn't needed for your ID type.");
    }
    if (!ALLOWED_DOC_TYPES.has(args.contentType)) {
      throw new ConvexError("Upload a photo (JPG, PNG) or a PDF.");
    }
    if (args.fileSize > MAX_REG_DOC_BYTES) {
      throw new ConvexError("That file is too large. The limit is 10 MB.");
    }
    const fileName = cleanRequired(
      "File name",
      args.fileName,
      MAX_FILE_NAME_LENGTH
    );

    // A file backs one document only, across all users.
    const claimed = await ctx.db
      .query("registrationDocuments")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .first();
    if (claimed) {
      throw new ConvexError("That file is already attached to a document.");
    }
    const existing = await ctx.db
      .query("registrationDocuments")
      .withIndex("by_userId_and_kind", (q) =>
        q.eq("userId", args.userId).eq("kind", args.kind)
      )
      .unique();

    const now = Date.now();
    let documentId: Id<"registrationDocuments">;
    if (existing) {
      documentId = existing._id;
      await ctx.db.patch("registrationDocuments", existing._id, {
        storageId: args.storageId,
        fileName,
        fileSize: args.fileSize,
        contentType: args.contentType,
        encrypted: true,
        status: "pending",
        rejectionReason: undefined,
        uploadedAt: now,
        reviewedAt: undefined,
        reviewedBy: undefined,
      });
      await safeDelete(ctx, existing.storageId, "replaced document");
    } else {
      documentId = await ctx.db.insert("registrationDocuments", {
        userId: args.userId,
        kind: args.kind,
        storageId: args.storageId,
        fileName,
        fileSize: args.fileSize,
        contentType: args.contentType,
        encrypted: true,
        status: "pending",
        uploadedAt: now,
      });
    }

    if (profile.registrationSubmittedAt !== undefined) {
      await syncKycStatus(ctx, profile);
    }
    return { documentId };
  },
});

/** What the download action needs to serve one stored document. */
const readGrantValidator = v.object({
  storageId: v.id("_storage"),
  /** The row's MIME type; null for legacy files (the action sniffs them). */
  contentType: v.union(v.string(), v.null()),
  /** Whether the stored blob is encrypted and must be decrypted before serving. */
  encrypted: v.boolean(),
});

/**
 * Decides whether `callerId` may read a document and, on an admin read of
 * someone else's file, writes the audit entry in the same transaction.
 *
 * Returns null for every denial and every miss (unknown, malformed or
 * foreign id) so the route cannot reveal that a document exists.
 *
 * Select a registration document with `documentId`, or a legacy KYC file with
 * `legacyUserId` + `legacyIndex`.
 */
export const authorizeDocumentRead = internalMutation({
  args: {
    callerId: v.string(),
    documentId: v.optional(v.string()),
    legacyUserId: v.optional(v.string()),
    legacyIndex: v.optional(v.number()),
  },
  returns: v.union(v.null(), readGrantValidator),
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.callerId))
      .unique();
    const isAdmin = caller?.role === "admin";

    /**
     * Writes the admin-read audit entry.
     *
     * @param targetUserId - Owner of the document
     * @param details - What was viewed
     * @param action - Audit action name
     */
    const audit = async (
      targetUserId: string,
      details: string,
      action: string
    ): Promise<void> => {
      await ctx.db.insert("auditLogs", {
        adminId: args.callerId,
        action,
        targetId: targetUserId,
        targetType: "user",
        details,
        timestamp: Date.now(),
      });
    };

    if (args.documentId !== undefined) {
      const id = ctx.db.normalizeId("registrationDocuments", args.documentId);
      if (id === null) return null;
      const row: Doc<"registrationDocuments"> | null = await ctx.db.get(
        "registrationDocuments",
        id
      );
      if (!row) return null;
      const isOwner = row.userId === args.callerId;
      if (!isOwner && !isAdmin) return null;
      if (!isOwner) {
        await audit(
          row.userId,
          `kind=${row.kind}`,
          "view_registration_document"
        );
      }
      return {
        storageId: row.storageId,
        contentType: row.contentType ?? null,
        encrypted: row.encrypted === true,
      };
    }

    if (args.legacyUserId !== undefined && args.legacyIndex !== undefined) {
      const isOwner = args.legacyUserId === args.callerId;
      if (!isOwner && !isAdmin) return null;
      const owner = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", args.legacyUserId ?? ""))
        .unique();
      const storageId = owner?.kycDocuments?.[args.legacyIndex];
      if (!owner || storageId === undefined) return null;
      if (!isOwner) {
        await audit(
          owner.userId,
          `legacy index=${String(args.legacyIndex)}`,
          "view_legacy_kyc_document"
        );
      }
      return {
        storageId,
        contentType: null,
        encrypted: owner.kycDocumentsEncrypted === true,
      };
    }
    return null;
  },
});
