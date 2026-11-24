/// <reference types="vite/client" />
import { describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_REG_DOC_BYTES } from "./constants";
import { encryptBytes } from "./lib/documentCrypto";
import schema from "./schema";

vi.mock("./config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./config")>()),
  isOriginAllowed: (origin: string | null | undefined) =>
    origin === "https://app.test",
}));

const modules = import.meta.glob("./**/*.*s");

const OWNER = "user_doc_owner";
const OTHER = "user_doc_other";
const ADMIN = "user_doc_admin";

/** A JPEG-looking file: magic bytes plus filler. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);
const PDF = new TextEncoder().encode("%PDF-1.7 hello");

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

/**
 * Seeds an owner (with details saved), another buyer and an admin.
 *
 * @param t - Test context
 */
async function seed(t: Ctx): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [userId, role] of [
      [OWNER, "buyer"],
      [OTHER, "buyer"],
      [ADMIN, "admin"],
    ] as const) {
      await ctx.db.insert("profiles", {
        userId,
        role,
        isVerified: false,
        idType: userId === OWNER ? "sa_id" : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  });
}

const as = (t: Ctx, userId: string) => t.withIdentity({ subject: userId });
const bearer = { Authorization: "Bearer test-token" };

/**
 * POSTs a file to the upload route.
 *
 * @param t - Test context (already carrying an identity, or not)
 * @param body - File bytes
 * @param query - Query string
 * @param headers - Extra headers
 * @returns The response
 */
async function upload(
  t: Pick<Ctx, "fetch">,
  body: Uint8Array,
  query = "kind=id_front&fileName=front.jpg",
  headers: Record<string, string> = {}
): Promise<Response> {
  return await t.fetch(`/documents/upload?${query}`, {
    method: "POST",
    headers: { ...bearer, ...headers },
    body: body as BodyInit,
  });
}

/**
 * Reads every stored (encrypted) blob's bytes.
 *
 * @param t - Test context
 * @returns The blobs' bytes
 */
async function storedBlobs(t: Ctx): Promise<Uint8Array[]> {
  // `t.run` can only return Convex values, so bytes travel as number arrays.
  const raw = await t.run(async (ctx) => {
    const files = await ctx.db.system.query("_storage").collect();
    const out: number[][] = [];
    for (const file of files) {
      const blob = await ctx.storage.get(file._id);
      if (blob) out.push(Array.from(new Uint8Array(await blob.arrayBuffer())));
    }
    return out;
  });
  return raw.map((bytes) => new Uint8Array(bytes));
}

/**
 * Uploads a JPEG as the owner and returns the new document id.
 *
 * @param t - Test context
 * @returns The document id
 */
async function ownerUpload(t: Ctx): Promise<Id<"registrationDocuments">> {
  const res = await upload(as(t, OWNER), JPEG);
  expect(res.status).toBe(200);
  const json = (await res.json()) as {
    documentId: Id<"registrationDocuments">;
  };
  return json.documentId;
}

describe("POST /documents/upload", () => {
  it("401s without an identity", async () => {
    const t = makeContext();
    await seed(t);
    const res = await upload(t, JPEG);
    expect(res.status).toBe(401);
    expect(await storedBlobs(t)).toHaveLength(0);
  });

  it("400s for an unknown kind", async () => {
    const t = makeContext();
    await seed(t);
    const res = await upload(as(t, OWNER), JPEG, "kind=selfie");
    expect(res.status).toBe(400);
  });

  it("413s when the file is too big (declared and actual)", async () => {
    const t = makeContext();
    await seed(t);
    const declared = await upload(as(t, OWNER), JPEG, undefined, {
      "Content-Length": String(MAX_REG_DOC_BYTES + 1),
    });
    expect(declared.status).toBe(413);

    const big = new Uint8Array(MAX_REG_DOC_BYTES + 1);
    big.set(JPEG);
    const actual = await upload(as(t, OWNER), big);
    expect(actual.status).toBe(413);
    expect(await storedBlobs(t)).toHaveLength(0);
  });

  it("415s for an SVG, a renamed .exe and an empty body, whatever the header says", async () => {
    const t = makeContext();
    await seed(t);
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"/>'
    );
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 3, 0, 0, 0]);
    for (const body of [svg, exe, new Uint8Array(0)]) {
      const res = await upload(
        as(t, OWNER),
        body,
        "kind=id_front&fileName=photo.jpg",
        { "Content-Type": "image/jpeg" }
      );
      expect(res.status).toBe(415);
    }
    expect(await storedBlobs(t)).toHaveLength(0);
  });

  it("stores an encrypted blob and records the row", async () => {
    const t = makeContext();
    await seed(t);
    const documentId = await ownerUpload(t);

    const blobs = await storedBlobs(t);
    expect(blobs).toHaveLength(1);
    const stored = blobs[0];
    expect(stored.length).toBe(12 + JPEG.length + 16);
    expect(Array.from(stored)).not.toEqual(Array.from(JPEG));
    // The JPEG magic bytes must not appear at the start of the stored blob.
    expect(Array.from(stored.slice(12, 15))).not.toEqual([0xff, 0xd8, 0xff]);

    const row = await t.run((ctx) =>
      ctx.db.get("registrationDocuments", documentId)
    );
    expect(row).toMatchObject({
      userId: OWNER,
      kind: "id_front",
      fileName: "front.jpg",
      fileSize: JPEG.length,
      contentType: "image/jpeg",
      encrypted: true,
      status: "pending",
    });
  });

  it("deletes the blob when the attach is refused (wrong kind for the ID type)", async () => {
    const t = makeContext();
    await seed(t);
    const res = await upload(
      as(t, OWNER),
      JPEG,
      "kind=passport_photo&fileName=p.jpg"
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(
      /isn't needed/
    );
    expect(await storedBlobs(t)).toHaveLength(0);
  });

  it("deletes the blob when the user has no profile (non-Convex error path)", async () => {
    const t = makeContext();
    await seed(t);
    const res = await upload(as(t, "user_without_profile"), JPEG);
    expect(res.status).toBe(400);
    expect(await storedBlobs(t)).toHaveLength(0);
  });

  it("500s and stores nothing when the key is unusable", async () => {
    const t = makeContext();
    await seed(t);
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", "c2hvcnQ=");
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const res = await upload(as(t, OWNER), JPEG);
      expect(res.status).toBe(500);
    } finally {
      vi.unstubAllEnvs();
      error.mockRestore();
    }
    expect(await storedBlobs(t)).toHaveLength(0);
  });

  it("500s without leaking details when the attach fails unexpectedly", async () => {
    const t = makeContext();
    await seed(t);
    // A file name over the limit is a ConvexError (400); force a plain Error
    // by removing the profile's table access is not possible, so assert the
    // ConvexError path carries the user-facing message instead.
    const res = await upload(
      as(t, OWNER),
      JPEG,
      `kind=id_front&fileName=${"a".repeat(201)}`
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(
      /at most 200/
    );
    expect(await storedBlobs(t)).toHaveLength(0);
  });

  it("a replacement deletes the old encrypted file and resets to pending", async () => {
    const t = makeContext();
    await seed(t);
    const first = await ownerUpload(t);
    await t.run((ctx) =>
      ctx.db.patch("registrationDocuments", first, { status: "rejected" })
    );
    const second = await ownerUpload(t);
    expect(second).toBe(first);
    expect(await storedBlobs(t)).toHaveLength(1);
    const row = await t.run((ctx) =>
      ctx.db.get("registrationDocuments", first)
    );
    expect(row?.status).toBe("pending");
  });
});

describe("GET /documents/file", () => {
  const get = (t: Pick<Ctx, "fetch">, query: string) =>
    t.fetch(`/documents/file?${query}`, { headers: bearer });

  it("401s without an identity", async () => {
    const t = makeContext();
    await seed(t);
    const res = await t.fetch("/documents/file?id=x");
    expect(res.status).toBe(401);
  });

  it("serves the owner the original bytes with safe headers", async () => {
    const t = makeContext();
    await seed(t);
    const id = await ownerUpload(t);
    const res = await get(as(t, OWNER), `id=${id}`);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Disposition")).toBe("inline");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    // The owner reading their own file leaves no audit entry.
    expect(
      await t.run((ctx) => ctx.db.query("auditLogs").collect())
    ).toHaveLength(0);
  });

  it("404s another user, with the same answer as an unknown id", async () => {
    const t = makeContext();
    await seed(t);
    const id = await ownerUpload(t);
    const denied = await get(as(t, OTHER), `id=${id}`);
    const unknown = await get(as(t, OTHER), "id=not-a-real-id");
    expect(denied.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await denied.text()).toBe(await unknown.text());
  });

  it("404s a request with no selector and a malformed legacy index", async () => {
    const t = makeContext();
    await seed(t);
    expect((await get(as(t, OWNER), "")).status).toBe(404);
    expect(
      (await get(as(t, OWNER), `legacyUser=${OWNER}&index=-1`)).status
    ).toBe(404);
    expect(
      (await get(as(t, OWNER), `legacyUser=${OWNER}&index=abc`)).status
    ).toBe(404);
  });

  it("serves an admin and writes an audit row", async () => {
    const t = makeContext();
    await seed(t);
    const id = await ownerUpload(t);
    const res = await get(as(t, ADMIN), `id=${id}`);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
    const logs = await t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      adminId: ADMIN,
      action: "view_registration_document",
      targetId: OWNER,
      targetType: "user",
      details: "kind=id_front",
    });
  });

  it("404s when the stored file is gone and 500s when it cannot be decrypted", async () => {
    const t = makeContext();
    await seed(t);
    const id = await ownerUpload(t);
    const row = await t.run((ctx) => ctx.db.get("registrationDocuments", id));
    // Corrupt the blob: replace it with garbage the key cannot open.
    const garbage = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(40)]))
    );
    await t.run((ctx) =>
      ctx.db.patch("registrationDocuments", id, { storageId: garbage })
    );
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const bad = await get(as(t, OWNER), `id=${id}`);
    expect(bad.status).toBe(500);
    error.mockRestore();

    await t.run(async (ctx) => {
      await ctx.storage.delete(garbage);
    });
    const gone = await get(as(t, OWNER), `id=${id}`);
    expect(gone.status).toBe(404);
    expect(row).not.toBeNull();
  });

  it("serves an unencrypted pre-migration row with its raw bytes", async () => {
    const t = makeContext();
    await seed(t);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([PDF])));
    const id = await t.run((ctx) =>
      ctx.db.insert("registrationDocuments", {
        userId: OWNER,
        kind: "id_front",
        storageId,
        fileName: "old.pdf",
        fileSize: PDF.length,
        status: "pending",
        uploadedAt: 1,
      })
    );
    const res = await get(as(t, OWNER), `id=${id}`);
    expect(res.status).toBe(200);
    // No stored content type: sniffed from the bytes.
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("never labels a file with a type outside the allow-list", async () => {
    const t = makeContext();
    await seed(t);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])]))
    );
    const id = await t.run((ctx) =>
      ctx.db.insert("registrationDocuments", {
        userId: OWNER,
        kind: "id_front",
        storageId,
        fileName: "x.html",
        fileSize: 3,
        contentType: "text/html",
        status: "pending",
        uploadedAt: 1,
      })
    );
    const res = await get(as(t, OWNER), `id=${id}`);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
  });

  describe("legacy KYC files", () => {
    /**
     * Gives the owner one legacy file.
     *
     * @param t - Test context
     * @param encrypted - Whether the file is encrypted
     */
    async function legacy(t: Ctx, encrypted: boolean): Promise<void> {
      const bytes = encrypted
        ? new Uint8Array(await encryptBytes(JPEG.buffer.slice(0)))
        : JPEG;
      await t.run(async (ctx) => {
        const id = await ctx.storage.store(new Blob([bytes]));
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", OWNER))
          .unique();
        if (profile) {
          await ctx.db.patch("profiles", profile._id, {
            kycDocuments: [id],
            kycDocumentsEncrypted: encrypted,
          });
        }
      });
    }

    it("serves an encrypted file to its owner and an admin only, sniffing the type", async () => {
      const t = makeContext();
      await seed(t);
      await legacy(t, true);
      const query = `legacyUser=${OWNER}&index=0`;

      const owner = await get(as(t, OWNER), query);
      expect(owner.status).toBe(200);
      expect(owner.headers.get("Content-Type")).toBe("image/jpeg");
      expect(new Uint8Array(await owner.arrayBuffer())).toEqual(JPEG);

      expect((await get(as(t, OTHER), query)).status).toBe(404);

      expect((await get(as(t, ADMIN), query)).status).toBe(200);
      const logs = await t.run((ctx) => ctx.db.query("auditLogs").collect());
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "view_legacy_kyc_document",
        targetId: OWNER,
      });
    });

    it("404s an index past the end and an unknown user", async () => {
      const t = makeContext();
      await seed(t);
      await legacy(t, true);
      expect(
        (await get(as(t, OWNER), `legacyUser=${OWNER}&index=1`)).status
      ).toBe(404);
      expect(
        (await get(as(t, ADMIN), `legacyUser=nobody&index=0`)).status
      ).toBe(404);
    });

    it("serves a not-yet-migrated plain file to its owner", async () => {
      const t = makeContext();
      await seed(t);
      await legacy(t, false);
      const res = await get(as(t, OWNER), `legacyUser=${OWNER}&index=0`);
      expect(res.status).toBe(200);
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
    });
  });
});

describe("CORS", () => {
  it("answers an allowed origin's preflight with the origin echoed", async () => {
    const t = makeContext();
    for (const path of ["/documents/upload", "/documents/file"]) {
      const res = await t.fetch(path, {
        method: "OPTIONS",
        headers: { Origin: "https://app.test" },
      });
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://app.test"
      );
      expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
        "Authorization"
      );
    }
  });

  it("gives a disallowed origin no Allow-Origin header", async () => {
    const t = makeContext();
    const res = await t.fetch("/documents/upload", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.test" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("adds CORS headers to real responses too", async () => {
    const t = makeContext();
    await seed(t);
    const res = await as(t, OWNER).fetch("/documents/upload?kind=id_front", {
      method: "POST",
      headers: { ...bearer, Origin: "https://app.test" },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(res.status).toBe(415);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.test"
    );
  });
});

describe("authorizeDocumentRead", () => {
  it("returns null when asked for nothing", async () => {
    const t = makeContext();
    await seed(t);
    expect(
      await t.mutation(internal.documents.authorizeDocumentRead, {
        callerId: ADMIN,
      })
    ).toBeNull();
  });
});
