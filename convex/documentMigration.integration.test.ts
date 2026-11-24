/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { decryptBytes } from "./lib/documentCrypto";
import {
  processPendingPlainDeletes,
  type PendingDeleteCtx,
} from "./migrations";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 9, 8, 7, 6, 5, 4, 3, 2];
const PDF = Array.from("%PDF-1.4 legacy", (c) => c.charCodeAt(0));

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Stores a plain file.
 *
 * @param t - Test context
 * @param bytes - File bytes
 * @returns The storage id
 */
async function plainFile(t: Ctx, bytes: number[]): Promise<Id<"_storage">> {
  return await t.run((ctx) =>
    ctx.storage.store(new Blob([new Uint8Array(bytes)]))
  );
}

/**
 * Reads a stored file's bytes, or null when it is gone.
 *
 * @param t - Test context
 * @param id - Storage id
 * @returns The bytes (as numbers) or null
 */
async function readFile(t: Ctx, id: Id<"_storage">): Promise<number[] | null> {
  return await t.run(async (ctx) => {
    const blob = await ctx.storage.get(id);
    return blob ? Array.from(new Uint8Array(await blob.arrayBuffer())) : null;
  });
}

/**
 * Reads a stored file that must exist.
 *
 * @param t - Test context
 * @param id - Storage id
 * @returns The bytes (as numbers)
 */
async function sealedBytes(
  t: Ctx,
  id: Id<"_storage"> | undefined
): Promise<number[]> {
  if (id === undefined) throw new Error("expected a storage id");
  const bytes = await readFile(t, id);
  if (bytes === null) throw new Error("expected the file to exist");
  return bytes;
}

/**
 * Adds a profile.
 *
 * @param t - Test context
 * @param userId - Clerk user id
 * @param extra - Extra profile fields
 * @param extra.kycDocuments
 * @param extra.kycDocumentsEncrypted
 * @returns The profile id
 */
async function addProfile(
  t: Ctx,
  userId: string,
  extra: {
    kycDocuments?: Id<"_storage">[];
    kycDocumentsEncrypted?: boolean;
  } = {}
): Promise<Id<"profiles">> {
  return await t.run((ctx) =>
    ctx.db.insert("profiles", {
      userId,
      role: "buyer",
      isVerified: false,
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    })
  );
}

/**
 * Runs the migration to completion, following its self-scheduled batches.
 *
 * @param t - Test context
 * @returns The first call's result
 */
async function runMigration(t: Ctx) {
  const first = await t.action(
    internal.migrations.encryptLegacyKycDocuments,
    {}
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return first;
}

describe("migrations.encryptLegacyKycDocuments", () => {
  it("encrypts legacy KYC files, swaps the ids and deletes the plain originals", async () => {
    const t = makeContext();
    const a1 = await plainFile(t, JPEG);
    const a2 = await plainFile(t, PDF);
    const b1 = await plainFile(t, JPEG);
    const aProfile = await addProfile(t, "user_a", { kycDocuments: [a1, a2] });
    const bProfile = await addProfile(t, "user_b", { kycDocuments: [b1] });
    await addProfile(t, "user_none");

    await runMigration(t);

    const a = await t.run((ctx) => ctx.db.get("profiles", aProfile));
    const b = await t.run((ctx) => ctx.db.get("profiles", bProfile));
    expect(a?.kycDocumentsEncrypted).toBe(true);
    expect(b?.kycDocumentsEncrypted).toBe(true);
    expect(a?.kycDocuments).toHaveLength(2);
    expect(a?.kycDocuments).not.toContain(a1);
    expect(a?.kycDocuments).not.toContain(a2);

    // Old plain blobs are gone; the new ones are ciphertext that opens to the originals.
    for (const old of [a1, a2, b1]) expect(await readFile(t, old)).toBeNull();
    const [n1, n2] = a?.kycDocuments ?? [];
    const sealed1 = await sealedBytes(t, n1);
    const sealed2 = await sealedBytes(t, n2);
    expect(sealed1).not.toEqual(JPEG);
    expect(
      Array.from(
        new Uint8Array(await decryptBytes(new Uint8Array(sealed1).buffer))
      )
    ).toEqual(JPEG);
    expect(
      Array.from(
        new Uint8Array(await decryptBytes(new Uint8Array(sealed2).buffer))
      )
    ).toEqual(PDF);
  });

  it("is idempotent: a second run changes nothing", async () => {
    const t = makeContext();
    const file = await plainFile(t, JPEG);
    const profileId = await addProfile(t, "user_a", { kycDocuments: [file] });
    await runMigration(t);
    const after = await t.run((ctx) => ctx.db.get("profiles", profileId));
    const sealedBefore = await readFile(t, (after?.kycDocuments ?? [])[0]);

    const second = await runMigration(t);

    const again = await t.run((ctx) => ctx.db.get("profiles", profileId));
    expect(again?.kycDocuments).toEqual(after?.kycDocuments);
    expect(await readFile(t, (again?.kycDocuments ?? [])[0])).toEqual(
      sealedBefore
    );
    expect(second.encrypted).toBe(0);
  });

  it("skips profiles already marked encrypted", async () => {
    const t = makeContext();
    const already = await plainFile(t, [1, 2, 3]);
    const profileId = await addProfile(t, "user_done", {
      kycDocuments: [already],
      kycDocumentsEncrypted: true,
    });
    await runMigration(t);
    const row = await t.run((ctx) => ctx.db.get("profiles", profileId));
    expect(row?.kycDocuments).toEqual([already]);
    expect(await readFile(t, already)).toEqual([1, 2, 3]);
  });

  it("resumes across batches until every profile is done", async () => {
    const t = makeContext();
    const ids: Id<"profiles">[] = [];
    for (let i = 0; i < 12; i++) {
      const file = await plainFile(t, JPEG);
      ids.push(
        await addProfile(t, `user_${String(i)}`, { kycDocuments: [file] })
      );
    }
    const first = await t.action(
      internal.migrations.encryptLegacyKycDocuments,
      {}
    );
    // One batch of profiles per call, never the whole table at once.
    expect(first.phase).toBe("kyc");
    expect(first.encrypted).toBeLessThan(12);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    for (const id of ids) {
      const row = await t.run((ctx) => ctx.db.get("profiles", id));
      expect(row?.kycDocumentsEncrypted).toBe(true);
    }
  });

  it("drops a legacy id whose file is already gone and still marks the profile", async () => {
    const t = makeContext();
    const gone = await plainFile(t, JPEG);
    const kept = await plainFile(t, PDF);
    await t.run((ctx) => ctx.storage.delete(gone));
    const profileId = await addProfile(t, "user_a", {
      kycDocuments: [gone, kept],
    });
    await runMigration(t);
    const row = await t.run((ctx) => ctx.db.get("profiles", profileId));
    expect(row?.kycDocuments).toHaveLength(1);
    expect(row?.kycDocumentsEncrypted).toBe(true);
  });

  it("keeps a plain file a registration row still references, and drops a shared one last", async () => {
    const t = makeContext();
    const shared = await plainFile(t, JPEG);
    const sharedWithDoc = await plainFile(t, PDF);
    await addProfile(t, "user_owner", { kycDocuments: [shared] });
    await addProfile(t, "user_other", { kycDocuments: [shared] });
    await addProfile(t, "user_c", { kycDocuments: [sharedWithDoc] });
    await t.run((ctx) =>
      ctx.db.insert("registrationDocuments", {
        userId: "user_d",
        kind: "id_front",
        storageId: sharedWithDoc,
        fileName: "f",
        fileSize: 3,
        status: "pending",
        uploadedAt: 1,
        encrypted: true,
      })
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await runMigration(t);
    warn.mockRestore();
    // Still pointed at by a registration row: never deleted, and not retried.
    expect(await readFile(t, sharedWithDoc)).not.toBeNull();
    const left = await t.run((ctx) =>
      ctx.db.query("pendingPlainDeletes").collect()
    );
    expect(left).toHaveLength(0);
    // Shared by two profiles: gone only once the last of them has its own copy.
    expect(await readFile(t, shared)).toBeNull();
  });

  it("reports whether a file is still referenced or free", async () => {
    const t = makeContext();
    const photo = await plainFile(t, JPEG);
    const free = await plainFile(t, PDF);
    await addProfile(t, "user_a", { kycDocuments: [photo] });
    expect(
      await t.query(internal.migrations.isStorageReferencedElsewhere, {
        storageId: photo,
      })
    ).toBe("referenced");
    expect(
      await t.query(internal.migrations.isStorageReferencedElsewhere, {
        storageId: free,
      })
    ).toBe("free");
  });

  it("queues the plain originals in the same transaction as the swap", async () => {
    const t = makeContext();
    const oldA = await plainFile(t, JPEG);
    const newA = await plainFile(t, [1]);
    const profileId = await addProfile(t, "user_a", { kycDocuments: [oldA] });
    expect(
      await t.mutation(internal.migrations.commitEncryptedKycDocuments, {
        profileId,
        oldIds: [oldA],
        newIds: [newA],
      })
    ).toBe(true);
    const queued = await t.run((ctx) =>
      ctx.db.query("pendingPlainDeletes").collect()
    );
    expect(queued.map((q) => [q.storageId, q.source])).toEqual([[oldA, "kyc"]]);
  });

  it("deletes a plain file left queued by an interrupted run, on the next run", async () => {
    const t = makeContext();
    const oldA = await plainFile(t, JPEG);
    const newA = await plainFile(t, [1]);
    const profileId = await addProfile(t, "user_a", { kycDocuments: [oldA] });
    // The swap committed, then the run died before deleting anything.
    await t.mutation(internal.migrations.commitEncryptedKycDocuments, {
      profileId,
      oldIds: [oldA],
      newIds: [newA],
    });
    expect(await readFile(t, oldA)).not.toBeNull();

    await runMigration(t);

    expect(await readFile(t, oldA)).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("pendingPlainDeletes").collect())
    ).toHaveLength(0);
  });

  it("deletes the plain original of a registration row after a normal run", async () => {
    const t = makeContext();
    const plain = await plainFile(t, PDF);
    await t.run((ctx) =>
      ctx.db.insert("registrationDocuments", {
        userId: "user_a",
        kind: "id_front",
        storageId: plain,
        fileName: "f",
        fileSize: 3,
        status: "pending",
        uploadedAt: 1,
      })
    );
    await runMigration(t);
    expect(await readFile(t, plain)).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("pendingPlainDeletes").collect())
    ).toHaveLength(0);
  });

  it("encrypts unencrypted registration documents and records the real type", async () => {
    const t = makeContext();
    const plain = await plainFile(t, PDF);
    const unknown = await plainFile(t, [1, 2, 3, 4]);
    const sealedAlready = await plainFile(t, [7, 7, 7]);
    const make = (
      storageId: Id<"_storage">,
      kind: "id_front" | "id_back" | "proof_of_address",
      encrypted?: boolean
    ) =>
      t.run((ctx) =>
        ctx.db.insert("registrationDocuments", {
          userId: "user_a",
          kind,
          storageId,
          fileName: "f",
          fileSize: 3,
          status: "pending",
          uploadedAt: 1,
          ...(encrypted === undefined ? {} : { encrypted }),
        })
      );
    const pdfRow = await make(plain, "id_front");
    const unknownRow = await make(unknown, "id_back");
    const doneRow = await make(sealedAlready, "proof_of_address", true);

    await runMigration(t);

    const pdf = await t.run((ctx) =>
      ctx.db.get("registrationDocuments", pdfRow)
    );
    expect(pdf).toMatchObject({
      encrypted: true,
      contentType: "application/pdf",
    });
    expect(pdf?.storageId).not.toBe(plain);
    expect(await readFile(t, plain)).toBeNull();
    const sealed = await sealedBytes(t, pdf?.storageId);
    expect(
      Array.from(
        new Uint8Array(await decryptBytes(new Uint8Array(sealed).buffer))
      )
    ).toEqual(PDF);

    const odd = await t.run((ctx) =>
      ctx.db.get("registrationDocuments", unknownRow)
    );
    expect(odd?.contentType).toBe("application/octet-stream");

    const done = await t.run((ctx) =>
      ctx.db.get("registrationDocuments", doneRow)
    );
    expect(done?.storageId).toBe(sealedAlready);
    expect(await readFile(t, sealedAlready)).toEqual([7, 7, 7]);
  });

  it("leaves a registration row alone when its file is already gone", async () => {
    const t = makeContext();
    const file = await plainFile(t, PDF);
    const rowId = await t.run((ctx) =>
      ctx.db.insert("registrationDocuments", {
        userId: "user_a",
        kind: "id_front",
        storageId: file,
        fileName: "f",
        fileSize: 3,
        status: "pending",
        uploadedAt: 1,
      })
    );
    await t.run((ctx) => ctx.storage.delete(file));
    await runMigration(t);
    const row = await t.run((ctx) =>
      ctx.db.get("registrationDocuments", rowId)
    );
    expect(row?.encrypted).toBeUndefined();
  });
});

describe("migration commits refuse stale input", () => {
  it("does not overwrite a profile whose files changed after they were read", async () => {
    const t = makeContext();
    const read = await plainFile(t, JPEG);
    const replaced = await plainFile(t, PDF);
    const copy = await plainFile(t, [1]);
    const profileId = await addProfile(t, "user_a", {
      kycDocuments: [replaced],
    });
    const committed = await t.mutation(
      internal.migrations.commitEncryptedKycDocuments,
      { profileId, oldIds: [read], newIds: [copy] }
    );
    expect(committed).toBe(false);
    const row = await t.run((ctx) => ctx.db.get("profiles", profileId));
    expect(row?.kycDocuments).toEqual([replaced]);
    expect(row?.kycDocumentsEncrypted).toBeUndefined();
  });

  it("does not re-commit an encrypted profile or a replaced registration file", async () => {
    const t = makeContext();
    const file = await plainFile(t, JPEG);
    const copy = await plainFile(t, [1]);
    const profileId = await addProfile(t, "user_a", {
      kycDocuments: [file],
      kycDocumentsEncrypted: true,
    });
    expect(
      await t.mutation(internal.migrations.commitEncryptedKycDocuments, {
        profileId,
        oldIds: [file],
        newIds: [copy],
      })
    ).toBe(false);

    const rowId = await t.run((ctx) =>
      ctx.db.insert("registrationDocuments", {
        userId: "user_a",
        kind: "id_front",
        storageId: copy,
        fileName: "f",
        fileSize: 1,
        status: "pending",
        uploadedAt: 1,
      })
    );
    expect(
      await t.mutation(
        internal.migrations.commitEncryptedRegistrationDocument,
        {
          documentId: rowId,
          oldStorageId: file,
          newStorageId: copy,
          contentType: "image/jpeg",
        }
      )
    ).toBe(false);
  });
});

describe("processPendingPlainDeletes", () => {
  type Id1 = Id<"_storage">;
  const sid = (n: number) => `s${String(n)}` as Id1;
  const pid = (n: number) => `p${String(n)}` as Id<"pendingPlainDeletes">;

  /**
   * Builds a fake context over a set of queued files.
   *
   * @param states - Reference state per storage id
   * @param failing - Storage ids whose delete throws
   * @returns The context and what happened to it
   */
  function fake(
    states: Record<string, "referenced" | "free" | "unknown">,
    failing: string[] = []
  ) {
    const deleted: string[] = [];
    const removed: string[] = [];
    const ctx: PendingDeleteCtx = {
      listPending: () =>
        Promise.resolve(
          [1, 2, 3].map((n) => ({ _id: pid(n), storageId: sid(n) }))
        ),
      checkReference: (id) => Promise.resolve(states[id] ?? "free"),
      removeEntry: (id) => {
        removed.push(id);
        return Promise.resolve();
      },
      storage: {
        get: (id) => Promise.resolve(id === "s3" ? null : new Blob([])),
        delete: (id) => {
          if (failing.includes(id)) return Promise.reject(new Error("boom"));
          deleted.push(id);
          return Promise.resolve();
        },
      },
    };
    return { ctx, deleted, removed };
  }

  it("one failed delete does not stop the batch and its entry stays queued", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { ctx, deleted, removed } = fake({}, ["s1"]);
    const count = await processPendingPlainDeletes(ctx);
    warn.mockRestore();
    expect(deleted).toEqual(["s2"]);
    expect(count).toBe(1);
    // s1 failed (kept for next run); s2 deleted; s3 already gone so just cleared.
    expect(removed).toEqual(["p2", "p3"]);
  });

  it("keeps a referenced file (entry dropped) and an unconfirmed one (entry kept)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { ctx, deleted, removed } = fake({ s1: "referenced", s2: "unknown" });
    await processPendingPlainDeletes(ctx);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
    expect(deleted).toEqual([]);
    expect(removed).toEqual(["p1", "p3"]);
  });
});
