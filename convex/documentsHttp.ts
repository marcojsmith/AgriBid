/**
 * HTTP actions for personal documents (ID, passport, proof of address, legacy
 * KYC files). Convex serves `/api/storage/<id>` with no access check, so these
 * files are stored encrypted and only ever read back through the download
 * route here, which checks the caller first.
 *
 * Both routes authenticate with `Authorization: Bearer <Clerk Convex token>`.
 */

import { ConvexError } from "convex/values";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { MAX_REG_DOC_BYTES } from "./constants";
import { addCorsHeaders } from "./lib/cors";
import { decryptBytes, encryptBytes } from "./lib/documentCrypto";
import { sniffDocumentType } from "./lib/documentSniff";
import type { RegDocKind } from "./lib/registration";

/** Registration document kinds the upload route accepts. */
const UPLOAD_KINDS: readonly RegDocKind[] = [
  "id_front",
  "id_back",
  "passport_photo",
  "proof_of_address",
];

/** Types the download route will label a file with; anything else is a download. */
const SERVABLE_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

/** The longest `index` digits accepted on a legacy download. */
const MAX_INDEX_DIGITS = 4;

/**
 * Builds a JSON response with CORS headers.
 *
 * @param request - The incoming request (for the CORS origin)
 * @param status - HTTP status
 * @param body - JSON-serialisable body
 * @returns The response
 */
function jsonResponse(
  request: Request,
  status: number,
  body: Record<string, unknown>
): Response {
  return addCorsHeaders(
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    }),
    request
  );
}

/**
 * Resolves the caller's user id from the verified bearer token.
 *
 * @param ctx - HTTP action context
 * @param ctx.auth
 * @param ctx.auth.getUserIdentity
 * @returns The user id (the identity subject), or null when not signed in
 */
async function callerId(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}): Promise<string | null> {
  try {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  } catch {
    return null;
  }
}

/**
 * `POST /documents/upload?kind=<kind>&fileName=<name>`: the body is the raw
 * file. Checks the type from the file's own bytes, encrypts it, stores the
 * ciphertext and attaches it to the caller's registration.
 */
export const uploadDocument = httpAction(async (ctx, request) => {
  const userId = await callerId(ctx);
  if (userId === null) {
    return jsonResponse(request, 401, {
      error: "Sign in to upload documents.",
    });
  }

  const url = new URL(request.url);
  const kind = UPLOAD_KINDS.find((k) => k === url.searchParams.get("kind"));
  if (kind === undefined) {
    return jsonResponse(request, 400, { error: "Unknown document kind." });
  }
  const fileName = url.searchParams.get("fileName") ?? "document";

  // Refuse an oversized body before reading it when the client declared it.
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_REG_DOC_BYTES) {
    return jsonResponse(request, 413, {
      error: "That file is too large. The limit is 10 MB.",
    });
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_REG_DOC_BYTES) {
    return jsonResponse(request, 413, {
      error: "That file is too large. The limit is 10 MB.",
    });
  }

  const contentType = sniffDocumentType(new Uint8Array(body));
  if (contentType === null) {
    return jsonResponse(request, 415, {
      error: "Upload a photo (JPG, PNG) or a PDF.",
    });
  }

  let storageId;
  try {
    const sealed = await encryptBytes(body);
    storageId = await ctx.storage.store(
      new Blob([sealed], { type: "application/octet-stream" })
    );
  } catch (err) {
    console.error("Document encryption or storage failed:", err);
    return jsonResponse(request, 500, { error: "Couldn't store that file." });
  }

  try {
    const { documentId } = await ctx.runMutation(
      internal.documents.attachEncryptedDocument,
      {
        userId,
        kind,
        storageId,
        fileName,
        fileSize: body.byteLength,
        contentType,
      }
    );
    return jsonResponse(request, 200, { documentId });
  } catch (err) {
    // Actions don't roll back: remove the blob the failed attach left behind.
    await ctx.storage.delete(storageId);
    if (err instanceof ConvexError && typeof err.data === "string") {
      return jsonResponse(request, 400, { error: err.data });
    }
    console.error("Attaching document failed:", err);
    return jsonResponse(request, 500, { error: "Couldn't save that file." });
  }
});

/**
 * `GET /documents/file?id=<registrationDocuments id>` or
 * `GET /documents/file?legacyUser=<userId>&index=<n>`: returns the decrypted
 * file to its owner or an admin. Every denial and miss is a plain 404.
 */
export const downloadDocument = httpAction(async (ctx, request) => {
  const userId = await callerId(ctx);
  if (userId === null) {
    return jsonResponse(request, 401, { error: "Sign in to view documents." });
  }
  const notFound = (): Response =>
    jsonResponse(request, 404, { error: "Not found." });

  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const legacyUser = params.get("legacyUser");
  const indexText = params.get("index");

  let grant;
  if (id !== null) {
    grant = await ctx.runMutation(internal.documents.authorizeDocumentRead, {
      callerId: userId,
      documentId: id,
    });
  } else if (
    legacyUser !== null &&
    indexText !== null &&
    new RegExp(`^\\d{1,${String(MAX_INDEX_DIGITS)}}$`).test(indexText)
  ) {
    grant = await ctx.runMutation(internal.documents.authorizeDocumentRead, {
      callerId: userId,
      legacyUserId: legacyUser,
      legacyIndex: Number(indexText),
    });
  } else {
    return notFound();
  }
  if (grant === null) return notFound();

  const blob = await ctx.storage.get(grant.storageId);
  if (blob === null) return notFound();

  let bytes: ArrayBuffer;
  try {
    const stored = await blob.arrayBuffer();
    bytes = grant.encrypted ? await decryptBytes(stored) : stored;
  } catch (err) {
    console.error("Document decryption failed:", err);
    return jsonResponse(request, 500, { error: "Couldn't read that file." });
  }

  const sniffed = sniffDocumentType(new Uint8Array(bytes));
  const declared =
    grant.contentType !== null && SERVABLE_TYPES.has(grant.contentType)
      ? grant.contentType
      : null;
  const contentType = declared ?? sniffed ?? "application/octet-stream";

  return addCorsHeaders(
    new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    }),
    request
  );
});

/** CORS preflight for the document routes (204 with the allowed-origin headers). */
export const documentPreflight = httpAction((_ctx, request) =>
  Promise.resolve(addCorsHeaders(new Response(null, { status: 204 }), request))
);
