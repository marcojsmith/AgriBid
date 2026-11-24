/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import schema from "../schema";
import type { Doc } from "../_generated/dataModel";
import {
  REFERENCE_ALPHABET,
  generateReference,
  isValidPassportNumber,
  isValidPostalCode,
  isValidSaId,
  requiredKinds,
  syncKycStatus,
} from "./registration";

const globbedModules = import.meta.glob("../**/*.*s");
const modules: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(globbedModules).map(([path, load]) => [
    path.startsWith("./") ? `../lib/${path.slice(2)}` : path,
    load,
  ])
);

describe("isValidSaId", () => {
  it("accepts a valid ID", () => {
    expect(isValidSaId("8001015009087")).toBe(true);
  });

  it("rejects a bad checksum", () => {
    expect(isValidSaId("8001015009088")).toBe(false);
  });

  it("rejects an impossible date", () => {
    // 31 June, with a recomputed check digit would still be a bad date.
    expect(isValidSaId("8006315009084")).toBe(false);
    expect(isValidSaId("8013015009084")).toBe(false);
  });

  it("rejects the wrong length or non-digits", () => {
    expect(isValidSaId("800101500908")).toBe(false);
    expect(isValidSaId("80010150090870")).toBe(false);
    expect(isValidSaId("80010150090AB")).toBe(false);
  });

  it("accepts a 29 February in a leap year", () => {
    // 000229: year 2000 was a leap year; 5009 gender, 08 citizen/race digits.
    // Compute a valid check digit via brute force.
    const body = "000229500908";
    const valid = Array.from(
      { length: 10 },
      (_, d) => `${body}${String(d)}`
    ).filter(isValidSaId);
    expect(valid).toHaveLength(1);
  });
});

describe("passport and postal code", () => {
  it("validates passport numbers", () => {
    expect(isValidPassportNumber("A1234567")).toBe(true);
    expect(isValidPassportNumber("ab1234")).toBe(true);
    expect(isValidPassportNumber("A123")).toBe(false);
    expect(isValidPassportNumber("A1234567890")).toBe(false);
    expect(isValidPassportNumber("A123 456")).toBe(false);
  });

  it("validates postal codes", () => {
    expect(isValidPostalCode("7300")).toBe(true);
    expect(isValidPostalCode("SW1A 1AA")).toBe(true);
    expect(isValidPostalCode("12")).toBe(false);
    expect(isValidPostalCode("12345678901")).toBe(false);
    expect(isValidPostalCode("73$0")).toBe(false);
  });
});

describe("generateReference", () => {
  it("is AB- plus five characters from the alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const ref = generateReference();
      expect(ref).toMatch(/^AB-[2-9A-HJKMNP-Z]{5}$/);
      for (const ch of ref.slice(3)) {
        expect(REFERENCE_ALPHABET).toContain(ch);
      }
    }
  });

  it("is deterministic for a fixed random source and handles the edges", () => {
    expect(generateReference(() => 0)).toBe("AB-22222");
    expect(generateReference(() => 0.999999)).toBe("AB-ZZZZZ");
    expect(generateReference(() => 1)).toBe("AB-ZZZZZ");
  });
});

describe("requiredKinds", () => {
  it("lists the documents per ID type", () => {
    expect(requiredKinds("sa_id")).toEqual([
      "id_front",
      "id_back",
      "proof_of_address",
    ]);
    expect(requiredKinds("passport")).toEqual([
      "passport_photo",
      "proof_of_address",
    ]);
  });
});

describe("syncKycStatus", () => {
  const USER = "user_sync";

  type Status = Doc<"registrationDocuments">["status"];

  /**
   * Seeds a profile and passport documents, runs the sync and returns the
   * resulting profile and counters.
   *
   * @param opts - Profile and document setup
   * @param opts.profile - Profile overrides
   * @param opts.docs - Document statuses by kind
   * @param opts.counters - Initial counter values
   * @param opts.counters.pending - Initial pending counter
   * @param opts.counters.verified - Initial verified counter
   * @returns The profile and counter rows after the sync
   */
  async function run(opts: {
    profile?: Partial<Doc<"profiles">>;
    docs: Partial<Record<"passport_photo" | "proof_of_address", Status>>;
    counters?: { pending: number; verified: number };
  }) {
    const t = convexTest(schema, modules);
    return await t.run(async (ctx) => {
      const now = Date.now();
      const profileId = await ctx.db.insert("profiles", {
        userId: USER,
        role: "buyer",
        isVerified: false,
        idType: "passport",
        registrationSubmittedAt: now,
        createdAt: now,
        updatedAt: now,
        ...opts.profile,
      });
      await ctx.db.insert("counters", {
        name: "profiles",
        total: 1,
        pending: opts.counters?.pending ?? 0,
        verified: opts.counters?.verified ?? 0,
        updatedAt: now,
      });
      const storageId = await ctx.storage.store(new Blob(["x"]));
      for (const [kind, status] of Object.entries(opts.docs)) {
        await ctx.db.insert("registrationDocuments", {
          userId: USER,
          kind: kind as "passport_photo" | "proof_of_address",
          storageId,
          fileName: "f.pdf",
          fileSize: 1,
          status,
          rejectionReason: status === "rejected" ? "Blurry" : undefined,
          uploadedAt: now,
        });
      }
      const before = await ctx.db.get("profiles", profileId);
      if (!before) throw new Error("missing profile");
      await syncKycStatus(ctx, before);
      const after = await ctx.db.get("profiles", profileId);
      const counter = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", "profiles"))
        .unique();
      return { after, counter };
    });
  }

  it("goes pending when submitted and nothing is decided", async () => {
    const { after, counter } = await run({
      docs: { passport_photo: "pending", proof_of_address: "approved" },
    });
    expect(after?.kycStatus).toBe("pending");
    expect(after?.isVerified).toBe(false);
    expect(counter?.pending).toBe(1);
  });

  it("goes verified when every required document is approved", async () => {
    const { after, counter } = await run({
      profile: { kycStatus: "pending" },
      docs: { passport_photo: "approved", proof_of_address: "approved" },
      counters: { pending: 1, verified: 0 },
    });
    expect(after?.kycStatus).toBe("verified");
    expect(after?.isVerified).toBe(true);
    expect(counter?.pending).toBe(0);
    expect(counter?.verified).toBe(1);
  });

  it("goes rejected with the reason when a required document is rejected", async () => {
    const { after, counter } = await run({
      profile: { kycStatus: "verified", isVerified: true },
      docs: { passport_photo: "rejected", proof_of_address: "approved" },
      counters: { pending: 0, verified: 1 },
    });
    expect(after?.kycStatus).toBe("rejected");
    expect(after?.isVerified).toBe(false);
    expect(after?.kycRejectionReason).toBe("Blurry");
    expect(counter?.verified).toBe(0);
  });

  it("treats a missing required document as not approved", async () => {
    const { after } = await run({ docs: { passport_photo: "approved" } });
    expect(after?.kycStatus).toBe("pending");
  });

  it("does nothing before submission when nothing is decided", async () => {
    const { after } = await run({
      profile: { registrationSubmittedAt: undefined },
      docs: { passport_photo: "pending" },
    });
    expect(after?.kycStatus).toBeUndefined();
  });

  it("does nothing without an ID type", async () => {
    const { after } = await run({
      profile: { idType: undefined },
      docs: { passport_photo: "approved", proof_of_address: "approved" },
    });
    expect(after?.isVerified).toBe(false);
  });
});
