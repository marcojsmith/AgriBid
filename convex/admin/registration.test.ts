/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { encryptPII } from "../admin_utils";
import { formatNotificationRand } from "../auctions/internal";
import schema from "../schema";

const globbedModules = import.meta.glob("../**/*.*s");

/**
 * `import.meta.glob` rewrites matches inside this directory to `./`-prefixed
 * keys; rebase them onto the `../` root convex-test derives from `_generated`.
 */
const modules: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(globbedModules).map(([path, load]) => [
    path.startsWith("./") ? `../admin/${path.slice(2)}` : path,
    load,
  ])
);

const ADMIN = "user_admin";
const BUYER = "user_buyer";
const OTHER = "user_other";
const UPLOADED_AT = 1_700_000_000_000;

type Ctx = ReturnType<typeof makeContext>;
type Identity = ReturnType<Ctx["withIdentity"]>;

/**
 * Builds a convex-test backend.
 *
 * @returns The test context
 */
function makeContext() {
  return convexTest(schema, modules);
}

const asAdmin = (t: Ctx) => t.withIdentity({ subject: ADMIN });
const asBuyer = (t: Ctx) => t.withIdentity({ subject: BUYER });

type Kind = "id_front" | "id_back" | "passport_photo" | "proof_of_address";

/**
 * Seeds an admin, a buyer who submitted a South African ID registration (three
 * pending documents) and a plain second user. Deposit is not seeded.
 *
 * @param t - Test context
 * @returns The document ids by kind
 */
async function seed(
  t: Ctx
): Promise<Record<string, Id<"registrationDocuments">>> {
  const encName = await encryptPII("Thandi Nkosi");
  const encId = await encryptPII("8001015009087");
  const encStreet = await encryptPII("12 Church Street");
  return await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("profiles", {
      userId: ADMIN,
      name: "Admin",
      role: "admin",
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("profiles", {
      userId: BUYER,
      name: "Thandi",
      role: "buyer",
      isVerified: false,
      kycStatus: "pending",
      idType: "sa_id",
      fullName: encName,
      idNumber: encId,
      streetAddress: encStreet,
      registrationSubmittedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("profiles", {
      userId: OTHER,
      role: "buyer",
      isVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("counters", {
      name: "profiles",
      total: 3,
      pending: 1,
      verified: 1,
      updatedAt: now,
    });
    const ids: Record<string, Id<"registrationDocuments">> = {};
    for (const kind of ["id_front", "id_back", "proof_of_address"] as Kind[]) {
      const storageId = await ctx.storage.store(new Blob(["x"]));
      ids[kind] = await ctx.db.insert("registrationDocuments", {
        userId: BUYER,
        kind,
        storageId,
        fileName: `${kind}.jpg`,
        fileSize: 1,
        contentType: "image/jpeg",
        encrypted: true,
        status: "pending",
        uploadedAt: UPLOADED_AT,
      });
    }
    return ids;
  });
}

/**
 * Inserts a deposit row for the buyer.
 *
 * @param t - Test context
 * @param status - Deposit status
 * @param userId - Owner (default the buyer)
 * @param reference - Deposit reference
 */
async function seedDeposit(
  t: Ctx,
  status: "awaiting" | "paid_claimed" | "received" | "refunded",
  userId = BUYER,
  reference = "AB-7K3F2"
): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("registrationDeposits", {
      userId,
      reference,
      status,
      amount: 5000,
      ...(status === "received"
        ? { receivedAt: now, receivedAmount: 5000 }
        : {}),
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Reads the audit actions written so far.
 *
 * @param t - Test context
 * @returns The actions
 */
async function auditActions(t: Ctx): Promise<string[]> {
  return await t.run(async (ctx) =>
    (await ctx.db.query("auditLogs").collect()).map((row) => row.action)
  );
}

/**
 * Reads the buyer's notifications.
 *
 * @param t - Test context
 * @returns Title and message pairs
 */
async function buyerNotes(
  t: Ctx
): Promise<{ title: string; message: string; link: string }[]> {
  return await t.run(async (ctx) =>
    (await ctx.db.query("notifications").collect())
      .filter((n) => n.recipientId === BUYER)
      .map((n) => ({
        title: n.title,
        message: n.message,
        link: n.link ?? "",
      }))
  );
}

/**
 * Reads the buyer profile.
 *
 * @param t - Test context
 * @returns The profile
 */
async function buyerProfile(t: Ctx) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", BUYER))
      .unique()
  );
}

/**
 * Walks a value looking for forbidden keys.
 *
 * @param value - Any returned value
 * @returns True when a `url` or `storageId` key exists anywhere
 */
function hasStorageKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasStorageKeys);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).some(
      ([key, inner]) =>
        key === "url" || key === "storageId" || hasStorageKeys(inner)
    );
  }
  return false;
}

describe("admin registration: authorization", () => {
  it("refuses non-admins and signed-out callers on every function", async () => {
    const t = makeContext();
    const docs = await seed(t);
    const calls: ((c: Identity) => Promise<unknown>)[] = [
      (c) =>
        c.mutation(api.admin.registration.getRegistrationForReview, {
          userId: BUYER,
        }),
      (c) =>
        c.mutation(api.admin.registration.reviewDocument, {
          documentId: docs.id_front,
          expectedUploadedAt: UPLOADED_AT,
          decision: "approve",
        }),
      (c) =>
        c.query(api.admin.registration.listDeposits, {
          status: "paid_claimed",
          paginationOpts: { numItems: 10, cursor: null },
        }),
      (c) =>
        c.query(api.admin.registration.findDepositByReference, {
          reference: "AB-7K3F2",
        }),
      (c) =>
        c.mutation(api.admin.registration.markDepositReceived, {
          userId: BUYER,
          receivedAmount: 5000,
        }),
      (c) =>
        c.mutation(api.admin.registration.markDepositRefunded, {
          userId: BUYER,
        }),
    ];
    for (const call of calls) {
      await expect(call(asBuyer(t))).rejects.toThrow(/Admin privileges/);
      await expect(call(t)).rejects.toThrow();
    }
    expect(await auditActions(t)).toEqual([]);
  });
});

describe("getRegistrationForReview", () => {
  it("returns decrypted details, document metadata only, and audits the view", async () => {
    const t = makeContext();
    await seed(t);
    await seedDeposit(t, "paid_claimed");
    const result = await asAdmin(t).mutation(
      api.admin.registration.getRegistrationForReview,
      { userId: BUYER }
    );
    expect(result).not.toBeNull();
    expect(result?.details.fullName).toBe("Thandi Nkosi");
    expect(result?.details.idNumber).toBe("8001015009087");
    expect(result?.details.streetAddress).toBe("12 Church Street");
    expect(result?.documents).toHaveLength(3);
    expect(result?.documents[0]).toMatchObject({
      status: "pending",
      contentType: "image/jpeg",
    });
    expect(result?.deposit).toMatchObject({
      reference: "AB-7K3F2",
      status: "paid_claimed",
      amount: 5000,
    });
    expect(result?.legacy).toBe(false);
    expect(hasStorageKeys(result)).toBe(false);
    expect(await auditActions(t)).toEqual(["VIEW_REGISTRATION_DETAILS"]);
  });

  it("returns null for an unknown user and flags legacy submissions", async () => {
    const t = makeContext();
    await seed(t);
    expect(
      await asAdmin(t).mutation(
        api.admin.registration.getRegistrationForReview,
        {
          userId: "nobody",
        }
      )
    ).toBeNull();

    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["x"]));
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", OTHER))
        .unique();
      if (profile) {
        await ctx.db.patch("profiles", profile._id, {
          kycDocuments: [storageId],
        });
      }
    });
    const legacy = await asAdmin(t).mutation(
      api.admin.registration.getRegistrationForReview,
      { userId: OTHER }
    );
    expect(legacy?.legacy).toBe(true);
    expect(legacy?.documents).toEqual([]);
    expect(legacy?.deposit).toBeNull();
  });
});

describe("reviewDocument", () => {
  it("requires a reason to reject and caps it at 300 characters", async () => {
    const t = makeContext();
    const docs = await seed(t);
    await expect(
      asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: docs.id_front,
        expectedUploadedAt: UPLOADED_AT,
        decision: "reject",
      })
    ).rejects.toThrow(/reason is required/i);
    await expect(
      asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: docs.id_front,
        expectedUploadedAt: UPLOADED_AT,
        decision: "reject",
        reason: "   ",
      })
    ).rejects.toThrow(/reason is required/i);
    await expect(
      asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: docs.id_front,
        expectedUploadedAt: UPLOADED_AT,
        decision: "reject",
        reason: "x".repeat(301),
      })
    ).rejects.toThrow(/at most 300/i);
    expect(await auditActions(t)).toEqual([]);
  });

  it("rejects one document: profile becomes rejected, buyer is told what to replace", async () => {
    const t = makeContext();
    const docs = await seed(t);
    const result = await asAdmin(t).mutation(
      api.admin.registration.reviewDocument,
      {
        documentId: docs.id_back,
        expectedUploadedAt: UPLOADED_AT,
        decision: "reject",
        reason: "  Photo is blurry  ",
      }
    );
    expect(result).toEqual({ success: true, kycStatus: "rejected" });
    const row = await t.run(async (ctx) =>
      ctx.db.get("registrationDocuments", docs.id_back)
    );
    expect(row).toMatchObject({
      status: "rejected",
      rejectionReason: "Photo is blurry",
      reviewedBy: ADMIN,
    });
    expect(row?.reviewedAt).toBeTypeOf("number");
    const profile = await buyerProfile(t);
    expect(profile?.kycStatus).toBe("rejected");
    expect(profile?.isVerified).toBe(false);
    expect(await buyerNotes(t)).toEqual([
      {
        title: "Replace your ID back",
        message: "Photo is blurry",
        link: "/register/status",
      },
    ]);
    expect(await auditActions(t)).toEqual(["REGISTRATION_DOC_REJECT"]);
  });

  it("uses the right label for each kind", async () => {
    const t = makeContext();
    const docs = await seed(t);
    for (const [kind, label] of [
      ["id_front", "ID front"],
      ["proof_of_address", "Proof of address"],
    ] as const) {
      await asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: docs[kind],
        expectedUploadedAt: UPLOADED_AT,
        decision: "reject",
        reason: "No",
      });
      const notes = await buyerNotes(t);
      expect(notes.map((n) => n.title)).toContain(`Replace your ${label}`);
    }
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique();
      if (profile)
        await ctx.db.patch("profiles", profile._id, { idType: "passport" });
    });
    const passportId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["x"]));
      return await ctx.db.insert("registrationDocuments", {
        userId: BUYER,
        kind: "passport_photo",
        storageId,
        fileName: "p.jpg",
        fileSize: 1,
        status: "pending",
        uploadedAt: UPLOADED_AT,
      });
    });
    await asAdmin(t).mutation(api.admin.registration.reviewDocument, {
      documentId: passportId,
      expectedUploadedAt: UPLOADED_AT,
      decision: "reject",
      reason: "No",
    });
    expect((await buyerNotes(t)).map((n) => n.title)).toContain(
      "Replace your Passport photo page"
    );
  });

  it("approving every required document verifies the buyer once and notifies", async () => {
    const t = makeContext();
    const docs = await seed(t);
    await seedDeposit(t, "paid_claimed");
    const review = (id: Id<"registrationDocuments">) =>
      asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: id,
        expectedUploadedAt: UPLOADED_AT,
        decision: "approve",
      });

    expect(await review(docs.id_front)).toEqual({
      success: true,
      kycStatus: "pending",
    });
    expect(await review(docs.id_back)).toMatchObject({ kycStatus: "pending" });
    expect(await buyerNotes(t)).toEqual([]);
    expect(await review(docs.proof_of_address)).toEqual({
      success: true,
      kycStatus: "verified",
    });

    const profile = await buyerProfile(t);
    expect(profile?.isVerified).toBe(true);
    expect(profile?.kycStatus).toBe("verified");
    const counters = await t.run(async (ctx) =>
      ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", "profiles"))
        .unique()
    );
    expect(counters).toMatchObject({ verified: 2, pending: 0 });
    // Deposit setting is on by default and the deposit isn't received yet.
    expect(await buyerNotes(t)).toEqual([
      {
        title: "Documents approved",
        message: "You can bid once your deposit is received.",
        link: "/register/status",
      },
    ]);
    expect(await auditActions(t)).toEqual([
      "REGISTRATION_DOC_APPROVE",
      "REGISTRATION_DOC_APPROVE",
      "REGISTRATION_DOC_APPROVE",
    ]);
  });

  it("tells the buyer they can bid when no deposit is due", async () => {
    const t = makeContext();
    const docs = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("settings", {
        key: "deposit_enabled",
        value: false,
        description: "d",
        updatedAt: Date.now(),
      });
    });
    for (const id of Object.values(docs)) {
      await asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: id,
        expectedUploadedAt: UPLOADED_AT,
        decision: "approve",
      });
    }
    expect((await buyerNotes(t)).map((n) => n.message)).toEqual([
      "You can bid.",
    ]);
  });

  it("tells the buyer they can bid when the deposit is already received", async () => {
    const t = makeContext();
    const docs = await seed(t);
    await seedDeposit(t, "received");
    for (const id of Object.values(docs)) {
      await asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: id,
        expectedUploadedAt: UPLOADED_AT,
        decision: "approve",
      });
    }
    expect((await buyerNotes(t)).map((n) => n.message)).toEqual([
      "You can bid.",
    ]);
  });

  it("approving a rejected document clears its reason", async () => {
    const t = makeContext();
    const docs = await seed(t);
    await asAdmin(t).mutation(api.admin.registration.reviewDocument, {
      documentId: docs.id_front,
      expectedUploadedAt: UPLOADED_AT,
      decision: "reject",
      reason: "Blurry",
    });
    await asAdmin(t).mutation(api.admin.registration.reviewDocument, {
      documentId: docs.id_front,
      expectedUploadedAt: UPLOADED_AT,
      decision: "approve",
    });
    const row = await t.run(async (ctx) =>
      ctx.db.get("registrationDocuments", docs.id_front)
    );
    expect(row?.status).toBe("approved");
    expect(row?.rejectionReason).toBeUndefined();
    expect((await buyerProfile(t))?.kycStatus).toBe("pending");
  });

  it("refuses unknown documents and registrations that were not submitted", async () => {
    const t = makeContext();
    const docs = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.delete("registrationDocuments", docs.id_back);
    });
    await expect(
      asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: docs.id_back,
        expectedUploadedAt: UPLOADED_AT,
        decision: "approve",
      })
    ).rejects.toThrow(/Document not found/);

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique();
      if (profile) {
        await ctx.db.patch("profiles", profile._id, {
          registrationSubmittedAt: undefined,
        });
      }
    });
    await expect(
      asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: docs.id_front,
        expectedUploadedAt: UPLOADED_AT,
        decision: "approve",
      })
    ).rejects.toThrow(/hasn't been submitted/);
  });
});

describe("reviewDocument: stale and repeated decisions", () => {
  it("refuses a decision on a file that was replaced since the review opened", async () => {
    const t = makeContext();
    const docs = await seed(t);
    await expect(
      asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: docs.id_front,
        expectedUploadedAt: UPLOADED_AT - 1,
        decision: "approve",
      })
    ).rejects.toThrow(/was replaced/);
    const row = await t.run(async (ctx) =>
      ctx.db.get("registrationDocuments", docs.id_front)
    );
    expect(row?.status).toBe("pending");
    expect(await auditActions(t)).toEqual([]);
  });

  it("does not notify or audit the same rejection twice", async () => {
    const t = makeContext();
    const docs = await seed(t);
    const reject = () =>
      asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: docs.id_front,
        expectedUploadedAt: UPLOADED_AT,
        decision: "reject",
        reason: "Blurry",
      });
    await reject();
    expect(await reject()).toEqual({ success: true, kycStatus: "rejected" });
    expect(await buyerNotes(t)).toHaveLength(1);
    expect(await auditActions(t)).toEqual(["REGISTRATION_DOC_REJECT"]);
  });

  it("refuses a document kind the ID type does not need", async () => {
    const t = makeContext();
    await seed(t);
    const stale = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["x"]));
      return await ctx.db.insert("registrationDocuments", {
        userId: BUYER,
        kind: "passport_photo",
        storageId,
        fileName: "p.jpg",
        fileSize: 1,
        status: "pending",
        uploadedAt: UPLOADED_AT,
      });
    });
    await expect(
      asAdmin(t).mutation(api.admin.registration.reviewDocument, {
        documentId: stale,
        expectedUploadedAt: UPLOADED_AT,
        decision: "reject",
        reason: "No",
      })
    ).rejects.toThrow(/isn.t needed/);
  });
});

describe("deposits", () => {
  it("lists deposits by status newest first without decrypted PII", async () => {
    const t = makeContext();
    await seed(t);
    await seedDeposit(t, "paid_claimed", BUYER, "AB-AAAAA");
    await seedDeposit(t, "paid_claimed", OTHER, "AB-BBBBB");
    await seedDeposit(t, "awaiting", ADMIN, "AB-CCCCC");
    const page = await asAdmin(t).query(api.admin.registration.listDeposits, {
      status: "paid_claimed",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page.map((row) => row.reference)).toEqual([
      "AB-BBBBB",
      "AB-AAAAA",
    ]);
    expect(page.page[1]).toMatchObject({
      userId: BUYER,
      name: "Thandi",
      status: "paid_claimed",
      amount: 5000,
    });
    expect(JSON.stringify(page)).not.toContain("Thandi Nkosi");
    expect(hasStorageKeys(page)).toBe(false);

    const all = await asAdmin(t).query(api.admin.registration.listDeposits, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(all.page).toHaveLength(3);
  });

  it("finds a deposit by reference, normalising case and spaces", async () => {
    const t = makeContext();
    await seed(t);
    await seedDeposit(t, "awaiting");
    const found = await asAdmin(t).query(
      api.admin.registration.findDepositByReference,
      { reference: "  ab-7k3f2 " }
    );
    expect(found).toMatchObject({ userId: BUYER, reference: "AB-7K3F2" });
    expect(
      await asAdmin(t).query(api.admin.registration.findDepositByReference, {
        reference: "AB-NOPE9",
      })
    ).toBeNull();
    expect(
      await asAdmin(t).query(api.admin.registration.findDepositByReference, {
        reference: "   ",
      })
    ).toBeNull();
  });

  it("marks received from awaiting and paid_claimed, and notifies", async () => {
    const t = makeContext();
    await seed(t);
    await seedDeposit(t, "awaiting");
    const result = await asAdmin(t).mutation(
      api.admin.registration.markDepositReceived,
      { userId: BUYER, receivedAmount: 5200 }
    );
    expect(result).toEqual({ success: true });
    const deposit = await t.run(async (ctx) =>
      ctx.db
        .query("registrationDeposits")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique()
    );
    expect(deposit).toMatchObject({
      status: "received",
      receivedAmount: 5200,
      markedReceivedBy: ADMIN,
    });
    expect(deposit?.receivedAt).toBeTypeOf("number");
    // Documents are not approved yet.
    expect(await buyerNotes(t)).toEqual([
      {
        title: "Deposit received",
        message: "We'll let you know when your documents are approved.",
        link: "/register/status",
      },
    ]);
    expect(await auditActions(t)).toEqual(["DEPOSIT_RECEIVED"]);
  });

  it("says 'You can bid.' when the buyer is otherwise eligible", async () => {
    const t = makeContext();
    await seed(t);
    await seedDeposit(t, "paid_claimed");
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique();
      if (profile) {
        await ctx.db.patch("profiles", profile._id, {
          isVerified: true,
          kycStatus: "verified",
        });
      }
    });
    await asAdmin(t).mutation(api.admin.registration.markDepositReceived, {
      userId: BUYER,
      receivedAmount: 5000,
    });
    expect((await buyerNotes(t))[0]).toMatchObject({
      title: "Deposit received",
      message: "You can bid.",
    });
  });

  it("refuses illegal deposit transitions and short payments", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      asAdmin(t).mutation(api.admin.registration.markDepositReceived, {
        userId: BUYER,
        receivedAmount: 5000,
      })
    ).rejects.toThrow(/No deposit/);
    await expect(
      asAdmin(t).mutation(api.admin.registration.markDepositRefunded, {
        userId: BUYER,
      })
    ).rejects.toThrow(/No deposit/);

    await seedDeposit(t, "awaiting");
    // awaiting -> refunded
    await expect(
      asAdmin(t).mutation(api.admin.registration.markDepositRefunded, {
        userId: BUYER,
      })
    ).rejects.toThrow(/Only a received deposit/);
    // less than the deposit
    await expect(
      asAdmin(t).mutation(api.admin.registration.markDepositReceived, {
        userId: BUYER,
        receivedAmount: 4999,
      })
    ).rejects.toThrow("Amount is less than the deposit.");
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(
        asAdmin(t).mutation(api.admin.registration.markDepositReceived, {
          userId: BUYER,
          receivedAmount: bad,
        })
      ).rejects.toThrow(/Amount is less/);
    }

    await asAdmin(t).mutation(api.admin.registration.markDepositReceived, {
      userId: BUYER,
      receivedAmount: 5000,
    });
    // received -> received
    await expect(
      asAdmin(t).mutation(api.admin.registration.markDepositReceived, {
        userId: BUYER,
        receivedAmount: 5000,
      })
    ).rejects.toThrow(/already/);
    expect(await auditActions(t)).toEqual(["DEPOSIT_RECEIVED"]);
  });

  it("refunds a received deposit, notifies, and lets the buyer claim again", async () => {
    const t = makeContext();
    await seed(t);
    await seedDeposit(t, "paid_claimed");
    await asAdmin(t).mutation(api.admin.registration.markDepositReceived, {
      userId: BUYER,
      receivedAmount: 5000,
    });
    expect(
      await asAdmin(t).mutation(api.admin.registration.markDepositRefunded, {
        userId: BUYER,
      })
    ).toEqual({ success: true });
    const refunded = await t.run(async (ctx) =>
      ctx.db
        .query("registrationDeposits")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique()
    );
    expect(refunded).toMatchObject({ status: "refunded", refundedBy: ADMIN });
    expect(refunded?.refundedAt).toBeTypeOf("number");
    expect((await buyerNotes(t)).map((n) => n.title)).toEqual([
      "Deposit received",
      "Deposit refunded",
    ]);
    expect((await buyerNotes(t))[1]?.message).toBe(
      `We've refunded ${formatNotificationRand(5000)} to the account you paid from.`
    );

    // Already refunded: not refundable again.
    await expect(
      asAdmin(t).mutation(api.admin.registration.markDepositRefunded, {
        userId: BUYER,
      })
    ).rejects.toThrow(/Only a received deposit/);

    // The buyer can pay again (R1's claimMyDepositPaid from refunded).
    await asBuyer(t).mutation(api.registration.claimMyDepositPaid, {});
    const reclaimed = await t.run(async (ctx) =>
      ctx.db
        .query("registrationDeposits")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique()
    );
    expect(reclaimed?.status).toBe("paid_claimed");
    expect(await auditActions(t)).toEqual([
      "DEPOSIT_RECEIVED",
      "DEPOSIT_REFUNDED",
      "DEPOSIT_PAID_CLAIMED",
    ]);
  });
});
