/// <reference types="vite/client" />
import { describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import schema from "./schema";
import { encryptPII } from "./lib/encryption";
import {
  assignSellerSlug,
  ensureSellerSlug,
  publicNameForProfile,
  syncSellerSlug,
} from "./lib/sellerSlugs";
import type { Doc } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

const NOW = 1_700_000_000_000;

/**
 * Inserts a profile and returns it as stored.
 *
 * @param t - Test context
 * @param userId - The user id
 * @param extra - Extra profile fields
 * @returns The stored profile
 */
async function addProfile(
  t: Ctx,
  userId: string,
  extra: Partial<Doc<"profiles">> = {}
): Promise<Doc<"profiles">> {
  return await t.run(async (ctx) => {
    const id = await ctx.db.insert("profiles", {
      userId,
      role: "seller",
      isVerified: true,
      createdAt: NOW,
      updatedAt: NOW,
      ...extra,
    });
    const profile = await ctx.db.get("profiles", id);
    if (!profile) throw new Error("profile missing");
    return profile;
  });
}

/**
 * Runs `assignSellerSlug` against the stored copy of a profile.
 *
 * @param t - Test context
 * @param userId - The user id
 * @returns The slug returned
 */
async function assign(t: Ctx, userId: string): Promise<string | null> {
  return await t.run(async (ctx) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("profile missing");
    return await assignSellerSlug(ctx, profile);
  });
}

/**
 * Reads a profile back.
 *
 * @param t - Test context
 * @param userId - The user id
 * @returns The stored profile
 */
async function load(t: Ctx, userId: string): Promise<Doc<"profiles">> {
  return await t.run(async (ctx) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("profile missing");
    return profile;
  });
}

/**
 * Lists the redirect rows.
 *
 * @param t - Test context
 * @returns Slug and owner of every redirect
 */
async function redirects(t: Ctx): Promise<{ slug: string; userId: string }[]> {
  return await t.run(async (ctx) =>
    (await ctx.db.query("sellerSlugRedirects").collect()).map((r) => ({
      slug: r.slug,
      userId: r.userId,
    }))
  );
}

describe("publicNameForProfile", () => {
  it("uses the company name without decrypting anything", async () => {
    const t = makeContext();
    const profile = await addProfile(t, "u1", { companyName: " Boerdery " });
    expect(await publicNameForProfile(profile)).toBe("Boerdery");
  });

  it("uses the encrypted first and last names", async () => {
    const t = makeContext();
    const profile = await addProfile(t, "u1", {
      firstName: await encryptPII("Thandi"),
      lastName: await encryptPII("Nkosi"),
      name: "Ignored Name",
    });
    expect(await publicNameForProfile(profile)).toBe("Thandi N.");
  });

  it("falls back to the registration full name, then the display name", async () => {
    const t = makeContext();
    const withFull = await addProfile(t, "u1", {
      fullName: await encryptPII("Hennie van der Merwe"),
      name: "Display Name",
    });
    expect(await publicNameForProfile(withFull)).toBe("Hennie M.");

    const withName = await addProfile(t, "u2", { name: "Sipho Dlamini" });
    expect(await publicNameForProfile(withName)).toBe("Sipho D.");
  });

  it("treats an undecryptable name as missing", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const t = makeContext();
    const profile = await addProfile(t, "u1", {
      firstName: "AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA",
      name: "Sipho Dlamini",
    });
    expect(await publicNameForProfile(profile)).toBe("Sipho D.");
    errorSpy.mockRestore();
  });

  it("returns null when the profile has no name at all", async () => {
    const t = makeContext();
    const profile = await addProfile(t, "u1");
    expect(await publicNameForProfile(profile)).toBeNull();
  });
});

describe("assignSellerSlug", () => {
  it("assigns the public name and a slug", async () => {
    const t = makeContext();
    await addProfile(t, "u1", { companyName: "Wolmaransstad Boerdery" });
    expect(await assign(t, "u1")).toBe("wolmaransstad-boerdery");
    const stored = await load(t, "u1");
    expect(stored.slug).toBe("wolmaransstad-boerdery");
    expect(stored.publicName).toBe("Wolmaransstad Boerdery");
  });

  it("adds -2 and -3 when the slug is taken by another profile", async () => {
    const t = makeContext();
    for (const id of ["u1", "u2", "u3"]) {
      await addProfile(t, id, { companyName: "Du Toit's Boerdery" });
    }
    expect(await assign(t, "u1")).toBe("du-toits-boerdery");
    expect(await assign(t, "u2")).toBe("du-toits-boerdery-2");
    expect(await assign(t, "u3")).toBe("du-toits-boerdery-3");
  });

  it("is idempotent for a seller who already has the slug", async () => {
    const t = makeContext();
    await addProfile(t, "u1", { companyName: "Alpha Farm" });
    await addProfile(t, "u2", { companyName: "Alpha Farm" });
    await assign(t, "u1");
    expect(await assign(t, "u2")).toBe("alpha-farm-2");
    expect(await assign(t, "u2")).toBe("alpha-farm-2");
    expect(await assign(t, "u1")).toBe("alpha-farm");
    expect(await redirects(t)).toEqual([]);
  });

  it("does not reuse a slug that sits in the redirects table", async () => {
    const t = makeContext();
    await addProfile(t, "u1", { companyName: "Alpha Farm" });
    await assign(t, "u1");
    await t.run(async (ctx) => {
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", "u1"))
        .unique();
      if (p)
        await ctx.db.patch("profiles", p._id, { companyName: "Beta Farm" });
    });
    expect(await assign(t, "u1")).toBe("beta-farm");

    await addProfile(t, "u2", { companyName: "Alpha Farm" });
    expect(await assign(t, "u2")).toBe("alpha-farm-2");
  });

  it("redirects the old slug and assigns a new one after a rename", async () => {
    const t = makeContext();
    await addProfile(t, "u1", { companyName: "Alpha Farm" });
    await assign(t, "u1");
    await t.run(async (ctx) => {
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", "u1"))
        .unique();
      if (p)
        await ctx.db.patch("profiles", p._id, { companyName: "Omega Farm" });
    });
    expect(await assign(t, "u1")).toBe("omega-farm");
    expect(await redirects(t)).toEqual([{ slug: "alpha-farm", userId: "u1" }]);
    expect((await load(t, "u1")).publicName).toBe("Omega Farm");
  });

  it("keeps the slug when only the name text changes", async () => {
    const t = makeContext();
    await addProfile(t, "u1", { companyName: "Alpha Farm" });
    await assign(t, "u1");
    await t.run(async (ctx) => {
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", "u1"))
        .unique();
      if (p)
        await ctx.db.patch("profiles", p._id, { companyName: "ALPHA  farm" });
    });
    expect(await assign(t, "u1")).toBe("alpha-farm");
    const stored = await load(t, "u1");
    expect(stored.publicName).toBe("ALPHA farm");
    expect(await redirects(t)).toEqual([]);
  });

  it("keeps a numbered slug when the base is unchanged", async () => {
    const t = makeContext();
    await addProfile(t, "u1", { companyName: "Alpha Farm" });
    await addProfile(t, "u2", { companyName: "Alpha Farm" });
    await assign(t, "u1");
    await assign(t, "u2");
    await t.run(async (ctx) => {
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", "u2"))
        .unique();
      if (p)
        await ctx.db.patch("profiles", p._id, { companyName: "Alpha-Farm" });
    });
    expect(await assign(t, "u2")).toBe("alpha-farm-2");
    expect(await redirects(t)).toEqual([]);
  });

  it("lets a seller take back their own old slug and drops the redirect", async () => {
    const t = makeContext();
    await addProfile(t, "u1", { companyName: "Alpha Farm" });
    await assign(t, "u1");
    const rename = async (companyName: string) => {
      await t.run(async (ctx) => {
        const p = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", "u1"))
          .unique();
        if (p) await ctx.db.patch("profiles", p._id, { companyName });
      });
    };
    await rename("Omega Farm");
    await assign(t, "u1");
    await rename("Alpha Farm");
    expect(await assign(t, "u1")).toBe("alpha-farm");
    expect(await redirects(t)).toEqual([{ slug: "omega-farm", userId: "u1" }]);
  });

  it("falls back to a fixed base for a name of symbols only", async () => {
    const t = makeContext();
    await addProfile(t, "u1", { companyName: "★★★" });
    expect(await assign(t, "u1")).toBe("seller");
  });

  it("does nothing when there is no usable name", async () => {
    const t = makeContext();
    await addProfile(t, "u1");
    expect(await assign(t, "u1")).toBeNull();
    const stored = await load(t, "u1");
    expect(stored.slug).toBeUndefined();
    expect(stored.publicName).toBeUndefined();
  });

  it("keeps an existing slug when the name becomes unusable", async () => {
    const t = makeContext();
    await addProfile(t, "u1", {
      companyName: "Alpha Farm",
    });
    await assign(t, "u1");
    await t.run(async (ctx) => {
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", "u1"))
        .unique();
      if (p) await ctx.db.patch("profiles", p._id, { companyName: undefined });
    });
    expect(await assign(t, "u1")).toBe("alpha-farm");
  });

  it("shortens a long base to make room for the clash suffix", async () => {
    const t = makeContext();
    const long = "x".repeat(80);
    await addProfile(t, "u1", { companyName: long });
    await addProfile(t, "u2", { companyName: long });
    const first = await assign(t, "u1");
    const second = await assign(t, "u2");
    expect(first).toBe("x".repeat(60));
    expect(second).toBe(`${"x".repeat(60)}-2`);
  });
});

describe("syncSellerSlug and ensureSellerSlug", () => {
  /**
   * Inserts one lot for a seller.
   *
   * @param t - Test context
   * @param sellerId - The seller's user id
   */
  async function addLot(t: Ctx, sellerId: string): Promise<void> {
    await t.run(async (ctx) => {
      await ctx.db.insert("lots", {
        title: "Tractor",
        make: "JD",
        model: "8R",
        year: 2020,
        operatingHours: 1,
        location: "Free State",
        startingPrice: 1,
        reservePrice: 1,
        currentPrice: 1,
        minIncrement: 1,
        sellerId,
        status: "pending_review",
        images: { additional: [] },
      });
    });
  }

  it("does nothing for a user who has never listed", async () => {
    const t = makeContext();
    const profile = await addProfile(t, "u1", { companyName: "Buyer Co" });
    const slug = await t.run(async (ctx) => await syncSellerSlug(ctx, profile));
    expect(slug).toBeNull();
    expect((await load(t, "u1")).slug).toBeUndefined();
  });

  it("assigns a slug to a user who has a lot", async () => {
    const t = makeContext();
    const profile = await addProfile(t, "u1", { companyName: "Seller Co" });
    await addLot(t, "u1");
    const slug = await t.run(async (ctx) => await syncSellerSlug(ctx, profile));
    expect(slug).toBe("seller-co");
  });

  it("refreshes the name of a seller who already has a slug", async () => {
    const t = makeContext();
    await addProfile(t, "u1", { companyName: "Seller Co" });
    await assign(t, "u1");
    const stored = await load(t, "u1");
    const slug = await t.run(
      async (ctx) =>
        await syncSellerSlug(ctx, { ...stored, companyName: "Seller Co Ltd" })
    );
    expect(slug).toBe("seller-co-ltd");
  });

  it("ensureSellerSlug assigns once and ignores unknown users", async () => {
    const t = makeContext();
    await addProfile(t, "u1", { companyName: "Seller Co" });
    expect(await t.run(async (ctx) => await ensureSellerSlug(ctx, "u1"))).toBe(
      "seller-co"
    );
    expect(await t.run(async (ctx) => await ensureSellerSlug(ctx, "u1"))).toBe(
      "seller-co"
    );
    expect(
      await t.run(async (ctx) => await ensureSellerSlug(ctx, "nobody"))
    ).toBeNull();
  });
});
