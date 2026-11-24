/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_REG_DOC_BYTES } from "./constants";
import { decryptPII } from "./lib/encryption";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const BUYER = "user_reg_buyer";
const OTHER = "user_reg_other";
const SA_ID = "8001015009087";

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

/**
 * Seeds buyer profiles and the profiles counter.
 *
 * @param t - Test context
 */
async function seed(t: Ctx): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const userId of [BUYER, OTHER]) {
      await ctx.db.insert("profiles", {
        userId,
        role: "buyer",
        isVerified: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("counters", {
      name: "profiles",
      total: 2,
      pending: 0,
      verified: 0,
      updatedAt: now,
    });
  });
}

const asBuyer = (t: Ctx) => t.withIdentity({ subject: BUYER });

const saDetails = {
  idType: "sa_id" as const,
  fullName: "Thandi Nkosi",
  phoneNumber: "+27825550147",
  idNumber: SA_ID,
  streetAddress: "12 Church Street",
  town: "Malmesbury",
  postalCode: "7300",
};

const passportDetails = {
  idType: "passport" as const,
  fullName: "Tendai Moyo",
  phoneNumber: "+263771234567",
  passportNumber: "ab123456",
  countryOfIssue: "Zimbabwe",
  streetAddress: "5 Farm Road",
  town: "Paarl",
  postalCode: "7646",
};

/**
 * Stores a file and returns its storage id.
 *
 * @param t - Test context
 * @param type - MIME type
 * @param size - Number of bytes
 * @returns The storage id
 */
async function storeFile(
  t: Ctx,
  type = "application/pdf",
  size = 10
): Promise<Id<"_storage">> {
  return await t.run(async (ctx) => {
    const id = await ctx.storage.store(
      new Blob([new Uint8Array(size)], { type })
    );
    // convex-test records only size and sha256; real Convex also stores the
    // content type, which the mutation checks.
    const raw = ctx.db as unknown as {
      patch: (
        table: string,
        id: Id<"_storage">,
        value: { contentType: string }
      ) => Promise<void>;
    };
    await raw.patch("_storage", id, { contentType: type });
    return id;
  });
}

/**
 * Attaches a freshly stored file as a document.
 *
 * @param t - Test context
 * @param kind - Document kind
 * @param type - MIME type
 * @returns The storage id and the mutation promise result
 */
async function attach(
  t: Ctx,
  kind: "id_front" | "id_back" | "passport_photo" | "proof_of_address",
  type = "image/jpeg"
) {
  const storageId = await storeFile(t, type);
  const result = await attachRaw(t, {
    kind,
    storageId,
    fileName: `${kind}.jpg`,
    contentType: type,
  });
  return { storageId, ...result };
}

/**
 * Calls the internal attach mutation the upload route uses.
 *
 * @param t - Test context
 * @param args - Attach arguments; the user defaults to the buyer
 * @param args.kind
 * @param args.storageId
 * @param args.fileName
 * @param args.userId
 * @param args.fileSize
 * @param args.contentType
 * @returns The new document id
 */
async function attachRaw(
  t: Ctx,
  args: {
    kind: "id_front" | "id_back" | "passport_photo" | "proof_of_address";
    storageId: Id<"_storage">;
    fileName: string;
    userId?: string;
    fileSize?: number;
    contentType?: string;
  }
) {
  return await t.mutation(internal.documents.attachEncryptedDocument, {
    userId: args.userId ?? BUYER,
    kind: args.kind,
    storageId: args.storageId,
    fileName: args.fileName,
    fileSize: args.fileSize ?? 10,
    contentType: args.contentType ?? "image/jpeg",
  });
}

/**
 * Reads the buyer's profile.
 *
 * @param t - Test context
 * @returns The profile row
 */
async function profile(t: Ctx) {
  return await t.run((ctx) =>
    ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", BUYER))
      .unique()
  );
}

/**
 * Reads whether a storage file still exists.
 *
 * @param t - Test context
 * @param id - Storage id
 * @returns True when the file exists
 */
async function fileExists(t: Ctx, id: Id<"_storage">): Promise<boolean> {
  return await t.run(async (ctx) => (await ctx.storage.getUrl(id)) !== null);
}

/**
 * Sets the deposit enabled setting.
 *
 * @param t - Test context
 * @param enabled - New value
 */
async function setDeposit(t: Ctx, enabled: boolean) {
  await t.run((ctx) =>
    ctx.db.insert("settings", {
      key: "deposit_enabled",
      value: enabled,
      updatedAt: Date.now(),
    })
  );
}

describe("access", () => {
  it("requires sign-in", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      t.query(api.registration.getMyRegistration, {})
    ).rejects.toThrow("Not authenticated");
    await expect(
      t.mutation(api.registration.startMyDeposit, {})
    ).rejects.toThrow("Not authenticated");
    await expect(
      t.query(api.registration.getMyBidEligibility, {})
    ).rejects.toThrow("Not authenticated");
  });

  it("returns null for a signed-in user without a profile", async () => {
    const t = makeContext();
    const stranger = t.withIdentity({ subject: "nobody" });
    expect(
      await stranger.query(api.registration.getMyRegistration, {})
    ).toBeNull();
    expect(
      await stranger.query(api.registration.getMyBidEligibility, {})
    ).toBeNull();
  });
});

describe("saveMyDetails", () => {
  it("encrypts details at rest and reads them back decrypted", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);

    const row = await profile(t);
    expect(row?.idType).toBe("sa_id");
    for (const value of [
      row?.fullName,
      row?.phoneNumber,
      row?.idNumber,
      row?.streetAddress,
      row?.town,
      row?.postalCode,
    ]) {
      expect(value).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
    }
    expect(row?.idNumber).not.toContain(SA_ID);
    expect(await decryptPII(row?.fullName)).toBe("Thandi Nkosi");

    const reg = await asBuyer(t).query(api.registration.getMyRegistration, {});
    expect(reg?.details).toMatchObject({
      idType: "sa_id",
      fullName: "Thandi Nkosi",
      phoneNumber: "+27825550147",
      idNumber: SA_ID,
      town: "Malmesbury",
    });
    expect(reg?.eligibility).toEqual({
      kind: "incomplete",
      step: 2,
      totalSteps: 4,
    });
  });

  it("stores a passport with the country in plain text", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, passportDetails);
    const row = await profile(t);
    expect(row?.countryOfIssue).toBe("Zimbabwe");
    expect(row?.idNumber).toBeUndefined();
    expect(await decryptPII(row?.passportNumber)).toBe("AB123456");
  });

  it("pre-fills the full name from the KYC first and last name", async () => {
    const t = makeContext();
    await seed(t);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique();
      if (row) {
        await ctx.db.patch("profiles", row._id, {
          firstName: "Thandi",
          lastName: "Nkosi",
        });
      }
    });
    const reg = await asBuyer(t).query(api.registration.getMyRegistration, {});
    expect(reg?.details.fullName).toBe("Thandi Nkosi");
  });

  it.each([
    ["a bad SA ID", { ...saDetails, idNumber: "1234567890123" }, "13-digit"],
    ["a missing SA ID", { ...saDetails, idNumber: undefined }, "13-digit"],
    [
      "a bad phone",
      { ...saDetails, phoneNumber: "0825550147" },
      "mobile number",
    ],
    [
      "a blank name",
      { ...saDetails, fullName: "   " },
      "Full name is required",
    ],
    ["a bad postal code", { ...saDetails, postalCode: "7$" }, "postal code"],
    [
      "an overlong street",
      { ...saDetails, streetAddress: "x".repeat(201) },
      "at most 200",
    ],
    [
      "a bad passport",
      { ...passportDetails, passportNumber: "12" },
      "passport number",
    ],
    [
      "no country",
      { ...passportDetails, countryOfIssue: " " },
      "Country of issue is required",
    ],
    [
      "an overlong country",
      { ...passportDetails, countryOfIssue: "x".repeat(57) },
      "at most 56",
    ],
  ])("rejects %s", async (_label, args, message) => {
    const t = makeContext();
    await seed(t);
    await expect(
      asBuyer(t).mutation(api.registration.saveMyDetails, args)
    ).rejects.toThrow(message);
  });

  it("deletes the other type's ID documents when the ID type changes", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);
    const front = await attach(t, "id_front");
    const back = await attach(t, "id_back");
    const proof = await attach(t, "proof_of_address");
    // A legacy pending KYC (no registration submission), so edits stay open.
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique();
      if (row)
        await ctx.db.patch("profiles", row._id, { kycStatus: "pending" });
      const counter = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", "profiles"))
        .unique();
      if (counter) await ctx.db.patch("counters", counter._id, { pending: 1 });
    });

    await asBuyer(t).mutation(api.registration.saveMyDetails, passportDetails);

    expect(await fileExists(t, front.storageId)).toBe(false);
    expect(await fileExists(t, back.storageId)).toBe(false);
    expect(await fileExists(t, proof.storageId)).toBe(true);
    const row = await profile(t);
    expect(row?.registrationSubmittedAt).toBeUndefined();
    expect(row?.kycStatus).toBeUndefined();
    const counter = await t.run((ctx) =>
      ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", "profiles"))
        .unique()
    );
    expect(counter?.pending).toBe(0);
    const reg = await asBuyer(t).query(api.registration.getMyRegistration, {});
    expect(reg?.documents.map((d) => d.kind)).toEqual(["proof_of_address"]);
  });

  it("clears a rejection when the ID type changes", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique();
      if (row) {
        await ctx.db.patch("profiles", row._id, {
          kycStatus: "rejected",
          kycRejectionReason: "Blurry",
        });
      }
    });
    await asBuyer(t).mutation(api.registration.saveMyDetails, passportDetails);
    const row = await profile(t);
    expect(row?.kycStatus).toBeUndefined();
    expect(row?.kycRejectionReason).toBeUndefined();
  });

  it("locks the details once documents are approved", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique();
      if (row) await ctx.db.patch("profiles", row._id, { isVerified: true });
    });
    await expect(
      asBuyer(t).mutation(api.registration.saveMyDetails, passportDetails)
    ).rejects.toThrow("locked once your documents are approved");
    await expect(
      asBuyer(t).mutation(api.registration.saveMyDetails, saDetails)
    ).rejects.toThrow("locked once your documents are approved");
  });
});

describe("attachEncryptedDocument", () => {
  it("needs details first", async () => {
    const t = makeContext();
    await seed(t);
    const storageId = await storeFile(t);
    await expect(
      attachRaw(t, {
        kind: "id_front",
        storageId,
        fileName: "a.pdf",
      })
    ).rejects.toThrow("Save your details");
  });

  it("rejects the wrong MIME type", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);
    const storageId = await storeFile(t, "text/plain");
    await expect(
      attachRaw(t, {
        kind: "id_front",
        storageId,
        fileName: "a.txt",
        contentType: "text/plain",
      })
    ).rejects.toThrow("JPG, PNG");
  });

  it("rejects SVG and a file reused for another kind", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);
    const svg = await storeFile(t, "image/svg+xml");
    await expect(
      attachRaw(t, {
        kind: "id_front",
        storageId: svg,
        fileName: "a.svg",
        contentType: "image/svg+xml",
      })
    ).rejects.toThrow("JPG, PNG");

    const first = await attach(t, "id_front");
    await expect(
      attachRaw(t, {
        kind: "id_back",
        storageId: first.storageId,
        fileName: "again.jpg",
      })
    ).rejects.toThrow("already attached");
  });

  it("rejects a file over 10 MB", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);
    const storageId = await storeFile(
      t,
      "application/pdf",
      MAX_REG_DOC_BYTES + 1
    );
    await expect(
      attachRaw(t, {
        kind: "id_front",
        storageId,
        fileName: "big.pdf",
        fileSize: MAX_REG_DOC_BYTES + 1,
      })
    ).rejects.toThrow("10 MB");
  });

  it("rejects a passport kind for an SA ID user", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);
    const storageId = await storeFile(t, "image/png");
    await expect(
      attachRaw(t, {
        kind: "passport_photo",
        storageId,
        fileName: "p.png",
      })
    ).rejects.toThrow("isn't needed");
  });

  it("replaces a rejected document, deletes the old file and resets it to pending", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);
    const first = await attach(t, "id_front");
    await attach(t, "id_back");
    await attach(t, "proof_of_address");
    await asBuyer(t).mutation(api.registration.submitMyDocuments, {});
    await t.run((ctx) =>
      ctx.db.patch("registrationDocuments", first.documentId, {
        status: "rejected",
        rejectionReason: "Blurry",
        reviewedAt: 5,
        reviewedBy: "admin",
      })
    );

    const second = await attach(t, "id_front", "application/pdf");

    expect(second.documentId).toBe(first.documentId);
    expect(await fileExists(t, first.storageId)).toBe(false);
    expect(await fileExists(t, second.storageId)).toBe(true);
    const row = await t.run((ctx) =>
      ctx.db.get("registrationDocuments", first.documentId)
    );
    expect(row).toMatchObject({
      status: "pending",
      storageId: second.storageId,
    });
    expect(row?.rejectionReason).toBeUndefined();
    expect(row?.reviewedAt).toBeUndefined();
    expect(row?.reviewedBy).toBeUndefined();
    expect((await profile(t))?.kycStatus).toBe("pending");
  });
});

describe("submitMyDocuments", () => {
  it("throws without proof of address", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);
    await attach(t, "id_front");
    await attach(t, "id_back");
    await expect(
      asBuyer(t).mutation(api.registration.submitMyDocuments, {})
    ).rejects.toThrow("every required document");
  });

  it("throws without details", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      asBuyer(t).mutation(api.registration.submitMyDocuments, {})
    ).rejects.toThrow("Complete your details");
  });

  it("submits a valid passport registration and sets the pending counter", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.saveMyDetails, passportDetails);
    await attach(t, "passport_photo");
    await attach(t, "proof_of_address", "application/pdf");

    const { submittedAt } = await asBuyer(t).mutation(
      api.registration.submitMyDocuments,
      {}
    );

    const row = await profile(t);
    expect(row?.registrationSubmittedAt).toBe(submittedAt);
    expect(row?.kycStatus).toBe("pending");
    const counter = await t.run((ctx) =>
      ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", "profiles"))
        .unique()
    );
    expect(counter?.pending).toBe(1);
    const activity = await t.run((ctx) =>
      ctx.db.query("userActivity").collect()
    );
    expect(activity.map((a) => a.type)).toContain("verification_requested");
    const reg = await asBuyer(t).query(api.registration.getMyRegistration, {});
    expect(reg?.submittedAt).toBe(submittedAt);
    expect(reg?.eligibility).toEqual({
      kind: "under_review",
      depositReceived: false,
    });
    expect(reg?.documents).toHaveLength(2);
    // No URL and no storage id ever leave the server: only metadata and an id.
    for (const doc of reg?.documents ?? []) {
      expect(doc).not.toHaveProperty("url");
      expect(doc).not.toHaveProperty("storageId");
      expect(
        Object.keys(doc).every((key) =>
          [
            "id",
            "kind",
            "status",
            "fileName",
            "fileSize",
            "contentType",
            "rejectionReason",
            "reviewedAt",
          ].includes(key)
        )
      ).toBe(true);
    }
    expect(reg?.documents[0]?.contentType).toBe("image/jpeg");
  });
});

describe("deposit", () => {
  it("is idempotent per user and unique across users", async () => {
    const t = makeContext();
    await seed(t);
    const first = await asBuyer(t).mutation(
      api.registration.startMyDeposit,
      {}
    );
    const again = await asBuyer(t).mutation(
      api.registration.startMyDeposit,
      {}
    );
    const other = await t
      .withIdentity({ subject: OTHER })
      .mutation(api.registration.startMyDeposit, {});

    expect(first.reference).toMatch(/^AB-[2-9A-HJKMNP-Z]{5}$/);
    expect(again.reference).toBe(first.reference);
    expect(other.reference).not.toBe(first.reference);
    const rows = await t.run((ctx) =>
      ctx.db.query("registrationDeposits").collect()
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ status: "awaiting", amount: 5000 });
    const reg = await asBuyer(t).query(api.registration.getMyRegistration, {});
    expect(reg?.deposit).toMatchObject({
      reference: first.reference,
      status: "awaiting",
    });
    expect(reg?.depositSettings).toEqual({
      enabled: true,
      amount: 5000,
      refundDays: 3,
    });
  });

  it("retries a taken reference and gives up after five attempts", async () => {
    const t = makeContext();
    await seed(t);
    const original = Math.random;
    try {
      // Always generate AB-22222.
      Math.random = () => 0;
      await asBuyer(t).mutation(api.registration.startMyDeposit, {});
      await expect(
        t
          .withIdentity({ subject: OTHER })
          .mutation(api.registration.startMyDeposit, {})
      ).rejects.toThrow("payment reference");
    } finally {
      Math.random = original;
    }
  });

  it("throws when the deposit is off", async () => {
    const t = makeContext();
    await seed(t);
    await setDeposit(t, false);
    await expect(
      asBuyer(t).mutation(api.registration.startMyDeposit, {})
    ).rejects.toThrow("isn't required");
  });

  it("claims paid from awaiting, is repeatable, and works again from refunded", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      asBuyer(t).mutation(api.registration.claimMyDepositPaid, {})
    ).rejects.toThrow("payment reference");

    await asBuyer(t).mutation(api.registration.startMyDeposit, {});
    await asBuyer(t).mutation(api.registration.claimMyDepositPaid, {});
    const read = () =>
      t.run((ctx) =>
        ctx.db
          .query("registrationDeposits")
          .withIndex("by_userId", (q) => q.eq("userId", BUYER))
          .unique()
      );
    const claimed = await read();
    expect(claimed?.status).toBe("paid_claimed");
    expect(claimed?.paidClaimedAt).toEqual(expect.any(Number));

    await asBuyer(t).mutation(api.registration.claimMyDepositPaid, {});
    expect((await read())?.paidClaimedAt).toBe(claimed?.paidClaimedAt);

    await t.run((ctx) =>
      ctx.db.patch(
        "registrationDeposits",
        claimed?._id as Id<"registrationDeposits">,
        {
          status: "refunded",
          refundedAt: 1,
        }
      )
    );
    await asBuyer(t).mutation(api.registration.claimMyDepositPaid, {});
    const again = await read();
    expect(again?.status).toBe("paid_claimed");
    expect(again?.reference).toBe(claimed?.reference);

    const audits = await t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(
      audits.filter((a) => a.action === "DEPOSIT_PAID_CLAIMED")
    ).toHaveLength(2);
  });

  it("leaves a received deposit alone", async () => {
    const t = makeContext();
    await seed(t);
    await asBuyer(t).mutation(api.registration.startMyDeposit, {});
    await t.run(async (ctx) => {
      const row = await ctx.db.query("registrationDeposits").first();
      if (row)
        await ctx.db.patch("registrationDeposits", row._id, {
          status: "received",
        });
    });
    await asBuyer(t).mutation(api.registration.claimMyDepositPaid, {});
    const row = await t.run((ctx) =>
      ctx.db.query("registrationDeposits").first()
    );
    expect(row?.status).toBe("received");
  });
});

/**
 * Reads the profiles counter row.
 *
 * @param t - Test context
 * @returns The counter row
 */
async function counters(t: Ctx) {
  return await t.run((ctx) =>
    ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "profiles"))
      .unique()
  );
}

/**
 * Saves SA ID details and uploads and submits all three documents.
 *
 * @param t - Test context
 * @returns The three stored documents
 */
async function submitAll(t: Ctx) {
  await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);
  const front = await attach(t, "id_front");
  const back = await attach(t, "id_back");
  const proof = await attach(t, "proof_of_address");
  await asBuyer(t).mutation(api.registration.submitMyDocuments, {});
  return { front, back, proof };
}

describe("storage ownership", () => {
  it("refuses another user's storage id and never deletes their file", async () => {
    const t = makeContext();
    await seed(t);
    const other = t.withIdentity({ subject: OTHER });
    await other.mutation(api.registration.saveMyDetails, saDetails);
    const storageId = await storeFile(t, "image/png");
    await attachRaw(t, {
      userId: OTHER,
      kind: "id_front",
      storageId,
      fileName: "theirs.png",
    });

    await asBuyer(t).mutation(api.registration.saveMyDetails, saDetails);
    await expect(
      attachRaw(t, {
        kind: "id_front",
        storageId,
        fileName: "stolen.png",
      })
    ).rejects.toThrow("already attached");

    // The buyer replacing their own document cannot touch it either.
    await attach(t, "id_front");
    await attach(t, "id_front");
    expect(await fileExists(t, storageId)).toBe(true);
    const reg = await other.query(api.registration.getMyRegistration, {});
    expect(reg?.documents).toHaveLength(1);
  });
});

describe("details while under review", () => {
  it("locks details while pending and reopens them when a document is rejected", async () => {
    const t = makeContext();
    await seed(t);
    const { front } = await submitAll(t);

    await expect(
      asBuyer(t).mutation(api.registration.saveMyDetails, {
        ...saDetails,
        town: "Paarl",
      })
    ).rejects.toThrow("Your details are under review.");

    await t.run((ctx) =>
      ctx.db.patch("registrationDocuments", front.documentId, {
        status: "rejected",
        rejectionReason: "Blurry",
      })
    );
    await asBuyer(t).mutation(api.registration.saveMyDetails, {
      ...saDetails,
      town: "Paarl",
    });
    const reg = await asBuyer(t).query(api.registration.getMyRegistration, {});
    expect(reg?.details.town).toBe("Paarl");
  });
});

describe("registration counters", () => {
  it("counts a replacement after a rejection as pending again", async () => {
    const t = makeContext();
    await seed(t);
    const { front } = await submitAll(t);
    expect((await counters(t))?.pending).toBe(1);

    // An admin rejects the document (the review UI lands in R4).
    await t.run(async (ctx) => {
      await ctx.db.patch("registrationDocuments", front.documentId, {
        status: "rejected",
        rejectionReason: "Blurry",
      });
      const row = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique();
      if (row) {
        await ctx.db.patch("profiles", row._id, { kycStatus: "rejected" });
      }
      const counter = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", "profiles"))
        .unique();
      if (counter) await ctx.db.patch("counters", counter._id, { pending: 0 });
    });

    await attach(t, "id_front");
    expect((await profile(t))?.kycStatus).toBe("pending");
    expect((await counters(t))?.pending).toBe(1);
  });

  it("takes a verified buyer back to pending when they replace an approved document", async () => {
    const t = makeContext();
    await seed(t);
    const { front, back, proof } = await submitAll(t);
    await t.run(async (ctx) => {
      for (const doc of [front, back, proof]) {
        await ctx.db.patch("registrationDocuments", doc.documentId, {
          status: "approved",
        });
      }
      const row = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", BUYER))
        .unique();
      if (row) {
        await ctx.db.patch("profiles", row._id, {
          kycStatus: "verified",
          isVerified: true,
        });
      }
      const counter = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", "profiles"))
        .unique();
      if (counter) {
        await ctx.db.patch("counters", counter._id, {
          pending: 0,
          verified: 1,
        });
      }
    });

    await attach(t, "proof_of_address", "application/pdf");

    const row = await profile(t);
    expect(row?.isVerified).toBe(false);
    expect(row?.kycStatus).toBe("pending");
    const counter = await counters(t);
    expect(counter?.verified).toBe(0);
    expect(counter?.pending).toBe(1);
  });
});

describe("every public function needs sign-in", () => {
  it("throws Not authenticated when signed out", async () => {
    const t = makeContext();
    await seed(t);
    const calls: Record<string, () => Promise<unknown>> = {
      getMyRegistration: () => t.query(api.registration.getMyRegistration, {}),
      getMyBidEligibility: () =>
        t.query(api.registration.getMyBidEligibility, {}),
      saveMyDetails: () =>
        t.mutation(api.registration.saveMyDetails, saDetails),
      submitMyDocuments: () =>
        t.mutation(api.registration.submitMyDocuments, {}),
      startMyDeposit: () => t.mutation(api.registration.startMyDeposit, {}),
      claimMyDepositPaid: () =>
        t.mutation(api.registration.claimMyDepositPaid, {}),
    };
    for (const [name, call] of Object.entries(calls)) {
      await expect(call(), name).rejects.toThrow("Not authenticated");
    }
  });
});
