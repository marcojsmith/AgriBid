/// <reference types="vite/client" />

/**
 * Integration coverage for About-text moderation, the paths that assign or
 * refresh a seller slug (profile edit, registration details, lot submission)
 * and the slug backfill migration.
 */

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import { SELLER_SLUG_BACKFILL_BATCH } from "./migrations";
import schema from "./schema";
import type { Doc, Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

const NOW = Date.now();
const ADMIN = "user_admin";
const SELLER = "user_seller";
const OTHER = "user_other";
const SA_ID = "8001015009087";

const asSeller = (t: Ctx) => t.withIdentity({ subject: SELLER });
const asAdmin = (t: Ctx) => t.withIdentity({ subject: ADMIN });

/**
 * Inserts a profile.
 *
 * @param t - Test context
 * @param userId - The user id
 * @param extra - Extra fields
 */
async function addProfile(
  t: Ctx,
  userId: string,
  extra: Partial<Doc<"profiles">> = {}
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("profiles", {
      userId,
      role: "seller",
      isVerified: false,
      createdAt: NOW,
      updatedAt: NOW,
      ...extra,
    });
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
    if (!profile) throw new Error("missing profile");
    return profile;
  });
}

/**
 * Inserts a lot for a seller.
 *
 * @param t - Test context
 * @param sellerId - The seller
 * @param status - The lot status
 */
async function addLot(
  t: Ctx,
  sellerId: string,
  status: Doc<"lots">["status"] = "assigned"
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("lots", {
      title: "Tractor",
      make: "JD",
      model: "8R",
      year: 2020,
      operatingHours: 1,
      location: "Free State",
      reservePrice: 1,
      startingPrice: 1,
      currentPrice: 1,
      minIncrement: 1,
      sellerId,
      status,
      images: { additional: [] },
    });
  });
}

describe("updateMyProfile bio moderation", () => {
  it("sends a new bio to review and keeps the live bio", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, { bio: "Live text" });

    await asSeller(t).mutation(api.users.updateMyProfile, {
      bio: "  New text ",
    });

    const profile = await load(t, SELLER);
    expect(profile.bio).toBe("Live text");
    expect(profile.bioPending).toBe("New text");
    expect(profile.bioStatus).toBe("pending");
    expect(profile.bioSubmittedAt).toEqual(expect.any(Number));
    expect(profile.bioRejectionReason).toBeUndefined();
  });

  it("does not restart the review when the same pending text is sent again", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, {
      bioPending: "Waiting",
      bioStatus: "pending",
      bioSubmittedAt: 111,
    });
    await asSeller(t).mutation(api.users.updateMyProfile, { bio: "Waiting" });
    expect((await load(t, SELLER)).bioSubmittedAt).toBe(111);
  });

  it("replaces pending text and clears an earlier rejection", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, {
      bioStatus: "rejected",
      bioRejectionReason: "No phone numbers",
    });
    await asSeller(t).mutation(api.users.updateMyProfile, { bio: "Try again" });
    const profile = await load(t, SELLER);
    expect(profile.bioPending).toBe("Try again");
    expect(profile.bioStatus).toBe("pending");
    expect(profile.bioRejectionReason).toBeUndefined();
  });

  it("withdraws a pending edit when the seller goes back to the live text", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, {
      bio: "Live text",
      bioPending: "Edit",
      bioStatus: "pending",
      bioSubmittedAt: 5,
    });
    await asSeller(t).mutation(api.users.updateMyProfile, {
      bio: "Live text",
    });
    const profile = await load(t, SELLER);
    expect(profile.bio).toBe("Live text");
    expect(profile.bioPending).toBeUndefined();
    expect(profile.bioStatus).toBeUndefined();
    expect(profile.bioSubmittedAt).toBeUndefined();
  });

  it("clears the live and pending bio at once when the bio is emptied", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, {
      bio: "Live text",
      bioPending: "Edit",
      bioStatus: "pending",
      bioSubmittedAt: 5,
    });
    await asSeller(t).mutation(api.users.updateMyProfile, { bio: "   " });
    const profile = await load(t, SELLER);
    expect(profile.bio).toBeUndefined();
    expect(profile.bioPending).toBeUndefined();
    expect(profile.bioStatus).toBeUndefined();
  });

  it("leaves the bio alone when only other fields change", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, { bio: "Live text" });
    await asSeller(t).mutation(api.users.updateMyProfile, {
      location: "Bloemfontein",
    });
    const profile = await load(t, SELLER);
    expect(profile.bio).toBe("Live text");
    expect(profile.bioStatus).toBeUndefined();
    expect(profile.location).toBe("Bloemfontein");
  });

  it("rejects a bio that is too long", async () => {
    const t = makeContext();
    await addProfile(t, SELLER);
    await expect(
      asSeller(t).mutation(api.users.updateMyProfile, { bio: "x".repeat(1001) })
    ).rejects.toThrow("Bio is too long");
  });
});

describe("getMyBio", () => {
  it("returns the owner's bio state", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, {
      bio: "Live",
      bioPending: "Next",
      bioStatus: "pending",
      bioRejectionReason: undefined,
    });
    expect(await asSeller(t).query(api.users.getMyBio, {})).toEqual({
      bio: "Live",
      bioPending: "Next",
      bioStatus: "pending",
    });
  });

  it("is null for guests and for users without a profile", async () => {
    const t = makeContext();
    expect(await t.query(api.users.getMyBio, {})).toBeNull();
    expect(await asSeller(t).query(api.users.getMyBio, {})).toBeNull();
  });
});

describe("admin bio review", () => {
  /**
   * Seeds an admin and a seller with a pending bio.
   *
   * @param t - Test context
   */
  async function seed(t: Ctx): Promise<void> {
    await addProfile(t, ADMIN, { role: "admin" });
    await addProfile(t, SELLER, {
      companyName: "Nkosi Boerdery",
      publicName: "Nkosi Boerdery",
      bio: "Old text",
      bioPending: "New text",
      bioStatus: "pending",
      bioSubmittedAt: 100,
    });
  }

  it("lists pending bios oldest first, for admins only", async () => {
    const t = makeContext();
    await seed(t);
    await addProfile(t, OTHER, {
      name: "Sipho Dlamini",
      bioPending: "Earlier",
      bioStatus: "pending",
      bioSubmittedAt: 50,
    });
    await addProfile(t, "user_approved", {
      bio: "Fine",
      bioStatus: "approved",
    });

    const result = await asAdmin(t).query(
      api.admin.sellerBios.listPendingBios,
      {
        paginationOpts: { numItems: 10, cursor: null },
      }
    );

    expect(result.page).toEqual([
      {
        userId: OTHER,
        publicName: "Sipho Dlamini",
        bioPending: "Earlier",
        bioSubmittedAt: 50,
      },
      {
        userId: SELLER,
        publicName: "Nkosi Boerdery",
        bioPending: "New text",
        bioSubmittedAt: 100,
        currentBio: "Old text",
      },
    ]);

    await expect(
      asSeller(t).query(api.admin.sellerBios.listPendingBios, {
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).rejects.toThrow("Admin");
    await expect(
      t.query(api.admin.sellerBios.listPendingBios, {
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).rejects.toThrow();
  });

  it("names an unnamed seller in the queue", async () => {
    const t = makeContext();
    await addProfile(t, ADMIN, { role: "admin" });
    await addProfile(t, SELLER, { bioPending: "Text", bioStatus: "pending" });
    const result = await asAdmin(t).query(
      api.admin.sellerBios.listPendingBios,
      {
        paginationOpts: { numItems: 10, cursor: null },
      }
    );
    expect(result.page[0].publicName).toBe("Unnamed seller");
  });

  it("approveBio publishes the text and writes an audit entry", async () => {
    const t = makeContext();
    await seed(t);

    await asAdmin(t).mutation(api.admin.sellerBios.approveBio, {
      userId: SELLER,
    });

    const profile = await load(t, SELLER);
    expect(profile.bio).toBe("New text");
    expect(profile.bioPending).toBeUndefined();
    expect(profile.bioStatus).toBe("approved");
    expect(profile.bioSubmittedAt).toBeUndefined();

    const audits = await t.run(async (ctx) =>
      ctx.db.query("auditLogs").collect()
    );
    expect(audits.map((a) => a.action)).toContain("APPROVE_SELLER_BIO");
    expect(audits[0].targetId).toBe(SELLER);
  });

  it("rejectBio clears the pending text, saves the reason, audits and notifies", async () => {
    const t = makeContext();
    await seed(t);

    await asAdmin(t).mutation(api.admin.sellerBios.rejectBio, {
      userId: SELLER,
      reason: "  Please remove the phone number  ",
    });

    const profile = await load(t, SELLER);
    expect(profile.bio).toBe("Old text");
    expect(profile.bioPending).toBeUndefined();
    expect(profile.bioStatus).toBe("rejected");
    expect(profile.bioRejectionReason).toBe("Please remove the phone number");

    const notifications = await t.run(async (ctx) =>
      ctx.db.query("notifications").collect()
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      recipientId: SELLER,
      message:
        "Your About text wasn't approved: Please remove the phone number",
    });
    const audits = await t.run(async (ctx) =>
      ctx.db.query("auditLogs").collect()
    );
    expect(audits.map((a) => a.action)).toContain("REJECT_SELLER_BIO");
  });

  it("rejectBio needs a reason of sensible length", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      asAdmin(t).mutation(api.admin.sellerBios.rejectBio, {
        userId: SELLER,
        reason: "   ",
      })
    ).rejects.toThrow("Give a reason");
    await expect(
      asAdmin(t).mutation(api.admin.sellerBios.rejectBio, {
        userId: SELLER,
        reason: "x".repeat(301),
      })
    ).rejects.toThrow("too long");
  });

  it("approve and reject refuse non-admins", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      asSeller(t).mutation(api.admin.sellerBios.approveBio, { userId: SELLER })
    ).rejects.toThrow("Admin");
    await expect(
      asSeller(t).mutation(api.admin.sellerBios.rejectBio, {
        userId: SELLER,
        reason: "no",
      })
    ).rejects.toThrow("Admin");
    expect((await load(t, SELLER)).bio).toBe("Old text");
  });

  it("fails cleanly for a missing profile or nothing pending", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      asAdmin(t).mutation(api.admin.sellerBios.approveBio, { userId: "nobody" })
    ).rejects.toThrow("Profile not found");

    await asAdmin(t).mutation(api.admin.sellerBios.approveBio, {
      userId: SELLER,
    });
    await expect(
      asAdmin(t).mutation(api.admin.sellerBios.approveBio, { userId: SELLER })
    ).rejects.toThrow("no About text waiting");
    await expect(
      asAdmin(t).mutation(api.admin.sellerBios.rejectBio, {
        userId: SELLER,
        reason: "late",
      })
    ).rejects.toThrow("no About text waiting");
  });
});

describe("slug assignment paths", () => {
  it("updateMyProfile renames the slug (with a redirect) when the company name changes", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, {
      companyName: "Alpha Farm",
      publicName: "Alpha Farm",
      slug: "alpha-farm",
    });

    await asSeller(t).mutation(api.users.updateMyProfile, {
      companyName: "Omega Farm",
    });

    const profile = await load(t, SELLER);
    expect(profile.slug).toBe("omega-farm");
    expect(profile.publicName).toBe("Omega Farm");
    const redirects = await t.run(async (ctx) =>
      ctx.db.query("sellerSlugRedirects").collect()
    );
    expect(redirects.map((r) => r.slug)).toEqual(["alpha-farm"]);
  });

  it("updateMyProfile gives a seller who already listed their first slug", async () => {
    const t = makeContext();
    await addProfile(t, SELLER);
    await addLot(t, SELLER);
    await asSeller(t).mutation(api.users.updateMyProfile, {
      companyName: "Fresh Farm",
    });
    expect((await load(t, SELLER)).slug).toBe("fresh-farm");
  });

  it("updateMyProfile gives a user who never listed no slug", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, { role: "buyer" });
    await asSeller(t).mutation(api.users.updateMyProfile, {
      companyName: "Fresh Farm",
    });
    expect((await load(t, SELLER)).slug).toBeUndefined();
  });

  it("updateMyProfile keeps the slug when the company name is unchanged", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, {
      companyName: "Alpha Farm",
      publicName: "Alpha Farm",
      slug: "alpha-farm",
    });
    await asSeller(t).mutation(api.users.updateMyProfile, {
      companyName: "Alpha Farm ",
      location: "Free State",
    });
    expect((await load(t, SELLER)).slug).toBe("alpha-farm");
    const redirects = await t.run(async (ctx) =>
      ctx.db.query("sellerSlugRedirects").collect()
    );
    expect(redirects).toEqual([]);
  });

  it("saving registration details refreshes the public name of a seller", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, {
      name: "Sipho Dlamini",
      publicName: "Sipho D.",
      slug: "sipho-d",
    });
    await addLot(t, SELLER);

    await asSeller(t).mutation(api.registration.saveMyDetails, {
      idType: "sa_id",
      fullName: "Thandi Nkosi",
      phoneNumber: "+27825550147",
      idNumber: SA_ID,
      streetAddress: "12 Church Street",
      town: "Malmesbury",
      postalCode: "7300",
    });

    const profile = await load(t, SELLER);
    expect(profile.publicName).toBe("Thandi N.");
    expect(profile.slug).toBe("thandi-n");
  });

  it("saving registration details gives a buyer who never listed no slug", async () => {
    const t = makeContext();
    await addProfile(t, SELLER, { role: "buyer", name: "Sipho Dlamini" });
    await asSeller(t).mutation(api.registration.saveMyDetails, {
      idType: "sa_id",
      fullName: "Thandi Nkosi",
      phoneNumber: "+27825550147",
      idNumber: SA_ID,
      streetAddress: "12 Church Street",
      town: "Malmesbury",
      postalCode: "7300",
    });
    expect((await load(t, SELLER)).slug).toBeUndefined();
  });

  describe("lot submission", () => {
    /**
     * Seeds the seller and a category, and relaxes the photo minimum.
     *
     * @param t - Test context
     * @returns The category id
     */
    async function seedSeller(t: Ctx): Promise<Id<"equipmentCategories">> {
      await addProfile(t, SELLER, {
        isVerified: true,
        companyName: "Submit Farm",
      });
      return await t.run(async (ctx) => {
        await ctx.db.insert("settings", {
          key: "min_photos_per_lot",
          value: 1,
          updatedAt: NOW,
        });
        return await ctx.db.insert("equipmentCategories", {
          name: "Tractors",
          isActive: true,
        });
      });
    }

    const lotArgs = (
      categoryId: Id<"equipmentCategories">,
      isDraft?: boolean
    ) => ({
      title: "John Deere 8R",
      categoryId,
      make: "John Deere",
      model: "8R",
      year: 2020,
      operatingHours: 100,
      location: "Pretoria",
      province: "gauteng" as const,
      description: "A fine tractor",
      startingPrice: 1000,
      reservePrice: 2000,
      durationDays: 7,
      images: { front: "img-front", additional: [] },
      conditionChecklist: {
        engine: true,
        hydraulics: true,
        tires: true,
        serviceHistory: true,
      },
      isDraft,
    });

    it("createLot assigns a slug on the first submitted lot, not for a draft", async () => {
      const t = makeContext();
      const categoryId = await seedSeller(t);

      await asSeller(t).mutation(
        api.auctions.createLot,
        lotArgs(categoryId, true)
      );
      expect((await load(t, SELLER)).slug).toBeUndefined();

      // Past the listing-creation cooldown.
      await t.run(async (ctx) => {
        const lots = await ctx.db.query("lots").collect();
        for (const lot of lots) {
          await ctx.db.patch("lots", lot._id, { createdAt: NOW - 86_400_000 });
        }
      });
      await asSeller(t).mutation(api.auctions.createLot, lotArgs(categoryId));
      expect((await load(t, SELLER)).slug).toBe("submit-farm");
    });

    it("submitLotForReview assigns a slug", async () => {
      const t = makeContext();
      const categoryId = await seedSeller(t);
      const lotId = await asSeller(t).mutation(
        api.auctions.createLot,
        lotArgs(categoryId, true)
      );
      expect((await load(t, SELLER)).slug).toBeUndefined();

      await asSeller(t).mutation(
        api.lots.mutations.lifecycle.submitLotForReview,
        {
          lotId,
        }
      );
      expect((await load(t, SELLER)).slug).toBe("submit-farm");
    });
  });
});

describe("backfillSellerSlugs", () => {
  it("assigns slugs to sellers with lots only, handling clashes, and is safe to re-run", async () => {
    const t = makeContext();
    await addProfile(t, "seller_a", { companyName: "Same Farm" });
    await addProfile(t, "seller_b", { companyName: "Same Farm" });
    await addProfile(t, "buyer_c", { role: "buyer", companyName: "Same Farm" });
    await addProfile(t, "seller_d", {
      companyName: "Kept Farm",
      slug: "kept-slug",
    });
    await addProfile(t, "seller_e");
    await addLot(t, "seller_a");
    await addLot(t, "seller_b", "sold");
    await addLot(t, "seller_d");
    await addLot(t, "seller_e");

    const first = await t.mutation(internal.migrations.backfillSellerSlugs, {});
    expect(first).toMatchObject({ isDone: true, updated: 2, processed: 5 });

    expect((await load(t, "seller_a")).slug).toBe("same-farm");
    expect((await load(t, "seller_b")).slug).toBe("same-farm-2");
    expect((await load(t, "buyer_c")).slug).toBeUndefined();
    expect((await load(t, "seller_d")).slug).toBe("kept-slug");
    // No usable name: nothing to build a slug from.
    expect((await load(t, "seller_e")).slug).toBeUndefined();

    const second = await t.mutation(
      internal.migrations.backfillSellerSlugs,
      {}
    );
    expect(second.updated).toBe(0);
    expect((await load(t, "seller_b")).slug).toBe("same-farm-2");
  });

  it("follows its own batches until every profile is done", async () => {
    const t = makeContext();
    const total = SELLER_SLUG_BACKFILL_BATCH + 5;
    for (let i = 0; i < total; i++) {
      const userId = `seller_${String(i)}`;
      await addProfile(t, userId, { companyName: `Farm ${String(i)}` });
      await addLot(t, userId);
    }

    const first = await t.mutation(internal.migrations.backfillSellerSlugs, {});
    expect(first.isDone).toBe(false);
    expect(first.processed).toBe(SELLER_SLUG_BACKFILL_BATCH);
    expect(first.continueCursor).toEqual(expect.any(String));

    const rest = await t.mutation(internal.migrations.backfillSellerSlugs, {
      cursor: first.continueCursor,
    });
    expect(rest.isDone).toBe(true);
    expect(rest.processed).toBe(5);

    const slugs = await t.run(async (ctx) =>
      (await ctx.db.query("profiles").collect()).map((p) => p.slug)
    );
    expect(slugs.filter((s) => s !== undefined)).toHaveLength(total);
  });
});
