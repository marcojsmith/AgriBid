/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import schema from "../schema";
import type { Doc } from "../_generated/dataModel";
import { canUserBid, getBidEligibility, requireCanBid } from "./bidGuard";

const globbedModules = import.meta.glob("../**/*.*s");
const modules: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(globbedModules).map(([path, load]) => [
    path.startsWith("./") ? `../lib/${path.slice(2)}` : path,
    load,
  ])
);

const USER = "user_guard";

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

/**
 * Seeds the user's profile, optionally a deposit row and the deposit setting.
 *
 * @param t - Test context
 * @param opts - Seed options
 * @param opts.profile - Profile overrides
 * @param opts.deposit - Deposit status, if a row should exist
 * @param opts.depositEnabled - Value of the deposit setting, if stored
 */
async function seed(
  t: Ctx,
  opts: {
    profile?: Partial<Doc<"profiles">>;
    deposit?: Doc<"registrationDeposits">["status"];
    depositEnabled?: boolean;
  } = {}
): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("profiles", {
      userId: USER,
      role: "buyer",
      isVerified: false,
      createdAt: now,
      updatedAt: now,
      ...opts.profile,
    });
    if (opts.deposit) {
      await ctx.db.insert("registrationDeposits", {
        userId: USER,
        reference: "AB-22222",
        status: opts.deposit,
        amount: 5000,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (opts.depositEnabled !== undefined) {
      await ctx.db.insert("settings", {
        key: "deposit_enabled",
        value: opts.depositEnabled,
        updatedAt: now,
      });
    }
  });
}

const guard = (t: Ctx) =>
  t.withIdentity({ subject: USER }).run((ctx) => requireCanBid(ctx));

describe("requireCanBid", () => {
  it("throws 'Finish registration' for an incomplete registration", async () => {
    const t = makeContext();
    await seed(t);
    await expect(guard(t)).rejects.toThrow("Finish registration to bid.");
  });

  it("throws the under-review message once submitted", async () => {
    const t = makeContext();
    await seed(t, { profile: { registrationSubmittedAt: 1 } });
    await expect(guard(t)).rejects.toThrow(
      "Your documents are under review. You can bid once they're approved."
    );
  });

  it("throws the replacing message when a document is rejected", async () => {
    const t = makeContext();
    await seed(t);
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["x"]));
      await ctx.db.insert("registrationDocuments", {
        userId: USER,
        kind: "id_front",
        storageId,
        fileName: "a.jpg",
        fileSize: 1,
        status: "rejected",
        uploadedAt: 1,
      });
    });
    await expect(guard(t)).rejects.toThrow(
      "One of your documents needs replacing before you can bid."
    );
  });

  it("throws the deposit message for a verified buyer with no deposit row", async () => {
    const t = makeContext();
    await seed(t, { profile: { isVerified: true, kycStatus: "verified" } });
    await expect(guard(t)).rejects.toThrow(
      "Your deposit hasn't been received yet."
    );
  });

  it("throws the deposit message while the payment is only claimed", async () => {
    const t = makeContext();
    await seed(t, {
      profile: { isVerified: true },
      deposit: "paid_claimed",
    });
    await expect(guard(t)).rejects.toThrow(
      "Your deposit hasn't been received yet."
    );
  });

  it("passes with approved documents and the deposit received", async () => {
    const t = makeContext();
    await seed(t, { profile: { isVerified: true }, deposit: "received" });
    expect(await guard(t)).toMatchObject({ userId: USER });
  });

  it("passes with approved documents when the deposit is off", async () => {
    const t = makeContext();
    await seed(t, { profile: { isVerified: true }, depositEnabled: false });
    expect(await guard(t)).toMatchObject({ userId: USER });
  });

  it("requires a profile", async () => {
    const t = makeContext();
    await expect(guard(t)).rejects.toThrow();
  });
});

describe("getBidEligibility", () => {
  it("reports the deposit due with the configured amount", async () => {
    const t = makeContext();
    await seed(t, { profile: { isVerified: true } });
    const result = await t.run(async (ctx) => {
      const profile = await ctx.db.query("profiles").first();
      if (!profile) throw new Error("missing");
      return await getBidEligibility(ctx, profile);
    });
    expect(result).toEqual({ kind: "deposit_due", amount: 5000 });
  });
});

describe("verified fast path", () => {
  it("is ok when the deposit setting is off", async () => {
    const t = makeContext();
    await seed(t, { profile: { isVerified: true }, depositEnabled: false });
    expect(await guard(t)).toMatchObject({ userId: USER });
  });

  it("asks for the deposit row's own amount when one exists", async () => {
    const t = makeContext();
    await seed(t, { profile: { isVerified: true }, deposit: "awaiting" });
    await t.run(async (ctx) => {
      const row = await ctx.db.query("registrationDeposits").first();
      if (row) {
        await ctx.db.patch("registrationDeposits", row._id, { amount: 7500 });
      }
    });
    const result = await t.run(async (ctx) => {
      const profile = await ctx.db.query("profiles").first();
      if (!profile) throw new Error("missing");
      return await getBidEligibility(ctx, profile);
    });
    expect(result).toEqual({ kind: "deposit_due", amount: 7500 });
  });
});

describe("deposit that is being refunded", () => {
  it("does not satisfy the deposit requirement once refunded", async () => {
    const t = makeContext();
    await seed(t, { profile: { isVerified: true }, deposit: "refunded" });
    await expect(guard(t)).rejects.toThrow(
      "Your deposit hasn't been received yet."
    );
    expect(await t.run((ctx) => canUserBid(ctx, USER))).toBe(false);
  });

  it("does not satisfy it while a refund is requested, and says how to bid", async () => {
    const t = makeContext();
    await seed(t, {
      profile: { isVerified: true },
      deposit: "refund_requested",
    });
    await expect(guard(t)).rejects.toThrow(
      "You asked for your deposit back. Cancel the request to bid."
    );
    expect(await t.run((ctx) => canUserBid(ctx, USER))).toBe(false);
    const eligibility = await t.run(async (ctx) => {
      const profile = await ctx.db.query("profiles").first();
      if (!profile) throw new Error("missing");
      return await getBidEligibility(ctx, profile);
    });
    expect(eligibility).toEqual({ kind: "refund_requested" });
  });

  it("still counts a received deposit whose amount was credited to a lot", async () => {
    const t = makeContext();
    await seed(t, { profile: { isVerified: true }, deposit: "received" });
    await t.run(async (ctx) => {
      const row = await ctx.db.query("registrationDeposits").first();
      const categoryId = await ctx.db.insert("equipmentCategories", {
        name: "Tractors",
        isActive: true,
      });
      const creditedLotId = await ctx.db.insert("lots", {
        title: "John Deere 8R",
        make: "John Deere",
        model: "8R",
        year: 2020,
        operatingHours: 1,
        location: "Free State",
        categoryId,
        reservePrice: 1,
        startingPrice: 1000,
        currentPrice: 1000,
        minIncrement: 100,
        sellerId: "seller",
        status: "sold",
        images: { additional: [] },
        createdAt: 1,
      });
      if (row) {
        await ctx.db.patch("registrationDeposits", row._id, {
          creditedLotId,
          creditedAt: 1,
          creditedAmount: 5000,
        });
      }
    });
    // Owner decision (2026-11-25): a credited deposit still lets the buyer bid.
    // The deposit is both fully used (nothing left to refund) and received.
    expect(await guard(t)).toMatchObject({ userId: USER });
    expect(await t.run((ctx) => canUserBid(ctx, USER))).toBe(true);
  });
});

describe("canUserBid", () => {
  it("is false without a profile and true for an eligible user", async () => {
    const t = makeContext();
    expect(await t.run((ctx) => canUserBid(ctx, USER))).toBe(false);
    await seed(t, { profile: { isVerified: true }, deposit: "received" });
    expect(await t.run((ctx) => canUserBid(ctx, USER))).toBe(true);
  });
});
