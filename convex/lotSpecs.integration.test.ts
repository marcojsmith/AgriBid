/// <reference types="vite/client" />

/**
 * Integration coverage (real in-memory Convex backend) for lot specs, the
 * seller VAT profile, the public lot detail fields and the min-photos gate.
 */

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

const ADMIN = "user_admin";
const SELLER = "user_seller";
const BUYER = "user_buyer";

const createTestContext = () => convexTest(schema, modules);
type TestContext = ReturnType<typeof createTestContext>;

const asAdmin = (t: TestContext) => t.withIdentity({ subject: ADMIN });
const asSeller = (t: TestContext) => t.withIdentity({ subject: SELLER });
const asBuyer = (t: TestContext) => t.withIdentity({ subject: BUYER });

/**
 * Seeds profiles, a category and (optionally) the min-photos setting.
 *
 * @param t - The convex-test context.
 * @param minPhotos - Value for the `min_photos_per_lot` setting; omit for the default.
 * @returns The category id.
 */
async function seed(
  t: TestContext,
  minPhotos?: number
): Promise<Id<"equipmentCategories">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    for (const [userId, role] of [
      [ADMIN, "admin"],
      [SELLER, "seller"],
      [BUYER, "buyer"],
    ] as const) {
      await ctx.db.insert("profiles", {
        userId,
        name: userId,
        email: `${userId}@example.com`,
        role,
        isVerified: true,
        kycStatus: "verified",
        createdAt: now,
        updatedAt: now,
      });
    }
    if (minPhotos !== undefined) {
      await ctx.db.insert("settings", {
        key: "min_photos_per_lot",
        value: minPhotos,
        updatedAt: now,
      });
    }
    return await ctx.db.insert("equipmentCategories", {
      name: "Tractors",
      isActive: true,
    });
  });
}

/**
 * Builds createLot args.
 *
 * @param categoryId - Category of the lot.
 * @param extra - Extra/overriding args.
 * @returns Args for `api.auctions.createLot`.
 */
function lotArgs(
  categoryId: Id<"equipmentCategories">,
  extra: Record<string, unknown> = {}
) {
  return {
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
    images: { front: "img-front", additional: ["img-a", "img-b"] },
    conditionChecklist: {
      engine: true,
      hydraulics: true,
      tires: true,
      serviceHistory: true,
    },
    ...extra,
  };
}

/**
 * Inserts a lot directly.
 *
 * @param t - The convex-test context.
 * @param categoryId - Category id.
 * @param overrides - Field overrides.
 * @param overrides.status - Lot status.
 * @param overrides.images - Lot images.
 * @param overrides.images.front - Front image reference.
 * @param overrides.images.additional - Additional image references.
 * @returns The new lot id.
 */
async function insertLot(
  t: TestContext,
  categoryId: Id<"equipmentCategories">,
  overrides: {
    status?: "draft" | "pending_review" | "assigned";
    images?: { front?: string; additional: string[] };
  } = {}
): Promise<Id<"lots">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("lots", {
      title: "Tractor",
      make: "M",
      model: "X",
      year: 2020,
      operatingHours: 1,
      location: "Pretoria",
      province: "gauteng",
      categoryId,
      description: "Desc",
      reservePrice: 100,
      startingPrice: 100,
      currentPrice: 100,
      minIncrement: 10,
      sellerId: SELLER,
      status: overrides.status ?? "draft",
      images: overrides.images ?? { front: "img-front", additional: [] },
      // Old enough to stay clear of the listing-creation cooldown.
      createdAt: Date.now() - 24 * 60 * 60 * 1000,
    })
  );
}

describe("lot specs on createLot", () => {
  it("stores specs and image angles", async () => {
    const t = createTestContext();
    const categoryId = await seed(t, 1);
    const lotId = await asSeller(t).mutation(
      api.auctions.createLot,
      lotArgs(categoryId, {
        powerKw: 150,
        drive: "4wd",
        transmission: "16x16",
        frontTyrePct: 80,
        rearTyrePct: 60,
        serialNumber: "SN-1",
        imageAngles: { "img-front": "front", "img-a": "rear" },
      })
    );
    const lot = await t.run(async (ctx) => ctx.db.get("lots", lotId));
    expect(lot).toMatchObject({
      powerKw: 150,
      drive: "4wd",
      transmission: "16x16",
      frontTyrePct: 80,
      rearTyrePct: 60,
      serialNumber: "SN-1",
      imageAngles: { "img-front": "front", "img-a": "rear" },
    });
  });

  it("rejects out-of-range specs", async () => {
    const t = createTestContext();
    const categoryId = await seed(t, 1);
    await expect(
      asSeller(t).mutation(
        api.auctions.createLot,
        lotArgs(categoryId, { frontTyrePct: 150 })
      )
    ).rejects.toThrow("Front tyre % must be between 0 and 100");
  });

  it("rejects image angles that do not reference the lot's images", async () => {
    const t = createTestContext();
    const categoryId = await seed(t, 1);
    await expect(
      asSeller(t).mutation(
        api.auctions.createLot,
        lotArgs(categoryId, { imageAngles: { "other-img": "front" } })
      )
    ).rejects.toThrow("Image angles must reference the lot's own images");
  });

  it("rejects unauthenticated callers", async () => {
    const t = createTestContext();
    const categoryId = await seed(t, 1);
    await expect(
      t.mutation(api.auctions.createLot, lotArgs(categoryId))
    ).rejects.toThrow();
  });
});

describe("lot specs on saveDraft", () => {
  it("stores specs on a new draft and patches an existing one", async () => {
    const t = createTestContext();
    const categoryId = await seed(t);
    const draftId = await asSeller(t).mutation(api.auctions.saveDraft, {
      title: "Draft",
      images: { front: "img-front", additional: [] },
      categoryId,
      powerKw: 90,
      imageAngles: { "img-front": "front" },
    });
    expect(
      (await t.run(async (ctx) => ctx.db.get("lots", draftId)))?.powerKw
    ).toBe(90);

    await asSeller(t).mutation(api.auctions.saveDraft, {
      lotId: draftId,
      rearTyrePct: 40,
      drive: "tracks",
    });
    const lot = await t.run(async (ctx) => ctx.db.get("lots", draftId));
    expect(lot).toMatchObject({
      powerKw: 90,
      rearTyrePct: 40,
      drive: "tracks",
    });
  });

  it("rejects invalid specs and mismatched angles on update", async () => {
    const t = createTestContext();
    const categoryId = await seed(t);
    const lotId = await insertLot(t, categoryId);
    await expect(
      asSeller(t).mutation(api.auctions.saveDraft, {
        lotId,
        powerKw: -5,
      })
    ).rejects.toThrow("Power must be between 0 and 2000 kW");
    await expect(
      asSeller(t).mutation(api.auctions.saveDraft, {
        lotId,
        imageAngles: { nope: "rear" },
      })
    ).rejects.toThrow("Image angles must reference the lot's own images");
  });
});

describe("adminUpdateLot specs", () => {
  it("lets an admin set specs without the min-photos gate", async () => {
    const t = createTestContext();
    const categoryId = await seed(t); // default minimum is 8 photos
    const lotId = await insertLot(t, categoryId, {
      status: "pending_review",
    });
    await asAdmin(t).mutation(api.auctions.adminUpdateLot, {
      lotId,
      updates: {
        powerKw: 200,
        serialNumber: "ABC",
        imageAngles: { "img-front": "front" },
      },
    });
    const lot = await t.run(async (ctx) => ctx.db.get("lots", lotId));
    expect(lot).toMatchObject({ powerKw: 200, serialNumber: "ABC" });
  });

  it("rejects non-admins and invalid specs", async () => {
    const t = createTestContext();
    const categoryId = await seed(t);
    const lotId = await insertLot(t, categoryId);
    await expect(
      asBuyer(t).mutation(api.auctions.adminUpdateLot, {
        lotId,
        updates: { powerKw: 10 },
      })
    ).rejects.toThrow();
    await expect(
      asAdmin(t).mutation(api.auctions.adminUpdateLot, {
        lotId,
        updates: { serialNumber: "x".repeat(101) },
      })
    ).rejects.toThrow("Serial number must be at most 100 characters");
    await expect(
      asAdmin(t).mutation(api.auctions.adminUpdateLot, {
        lotId,
        updates: { imageAngles: { nope: "front" } },
      })
    ).rejects.toThrow("Image angles must reference the lot's own images");
  });
});

describe("cold start video validation", () => {
  // convex-test does not record a stored file's content type, so the accept
  // path is covered by the helper unit tests in lib/lotSpecs.test.ts.
  it("rejects a non-video or missing file on every write path", async () => {
    const t = createTestContext();
    const categoryId = await seed(t, 1);
    const image = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["i"], { type: "image/png" }))
    );
    const missing = await t.run(async (ctx) => {
      const id = await ctx.storage.store(
        new Blob(["v"], { type: "video/mp4" })
      );
      await ctx.storage.delete(id);
      return id;
    });
    const lotId = await insertLot(t, categoryId);

    await expect(
      asSeller(t).mutation(
        api.auctions.createLot,
        lotArgs(categoryId, { coldStartVideo: image })
      )
    ).rejects.toThrow("Cold start video must be a video file");
    await expect(
      asSeller(t).mutation(api.auctions.saveDraft, {
        lotId,
        coldStartVideo: image,
      })
    ).rejects.toThrow("Cold start video must be a video file");
    await expect(
      asSeller(t).mutation(api.auctions.saveDraft, {
        title: "New draft",
        images: { front: "img-front", additional: [] },
        coldStartVideo: image,
      })
    ).rejects.toThrow("Cold start video must be a video file");
    await expect(
      asAdmin(t).mutation(api.auctions.adminUpdateLot, {
        lotId,
        updates: { coldStartVideo: missing },
      })
    ).rejects.toThrow("Cold start video file not found");
  });
});

describe("min photos gate", () => {
  it("rejects createLot submissions below the minimum but allows drafts", async () => {
    const t = createTestContext();
    const categoryId = await seed(t); // default 8
    await expect(
      asSeller(t).mutation(api.auctions.createLot, lotArgs(categoryId))
    ).rejects.toThrow("At least 8 photos are required (you have 3)");

    const draftId = await asSeller(t).mutation(
      api.auctions.createLot,
      lotArgs(categoryId, { isDraft: true })
    );
    expect(draftId).toBeDefined();
  });

  it("accepts createLot when the photo count meets the setting", async () => {
    const t = createTestContext();
    const categoryId = await seed(t, 3);
    const lotId = await asSeller(t).mutation(
      api.auctions.createLot,
      lotArgs(categoryId)
    );
    expect(lotId).toBeDefined();
  });

  it("gates submitLotForReview", async () => {
    const t = createTestContext();
    const categoryId = await seed(t);
    const lotId = await insertLot(t, categoryId);
    await expect(
      asSeller(t).mutation(api.lots.mutations.lifecycle.submitLotForReview, {
        lotId,
      })
    ).rejects.toThrow("At least 8 photos are required (you have 1)");

    await t.run(async (ctx) =>
      ctx.db.insert("settings", {
        key: "min_photos_per_lot",
        value: 1,
        updatedAt: Date.now(),
      })
    );
    const result = await asSeller(t).mutation(
      api.lots.mutations.lifecycle.submitLotForReview,
      { lotId }
    );
    expect(result.success).toBe(true);
  });

  it("does not gate saveDraft edits of a pending_review lot", async () => {
    const t = createTestContext();
    const categoryId = await seed(t); // default 8, lot has 1 photo
    const lotId = await insertLot(t, categoryId, { status: "pending_review" });
    await asSeller(t).mutation(api.auctions.saveDraft, {
      lotId,
      title: "New",
    });
    const lot = await t.run(async (ctx) => ctx.db.get("lots", lotId));
    expect(lot?.title).toBe("New");
  });

  it("counts a photo reference used twice only once", async () => {
    const t = createTestContext();
    const categoryId = await seed(t, 3);
    await expect(
      asSeller(t).mutation(
        api.auctions.createLot,
        lotArgs(categoryId, {
          images: { front: "img-a", additional: ["img-a", "img-b"] },
        })
      )
    ).rejects.toThrow("At least 3 photos are required (you have 2)");
  });

  it("does not gate approval (grandfathered)", async () => {
    const t = createTestContext();
    const categoryId = await seed(t);
    const lotId = await insertLot(t, categoryId, { status: "pending_review" });
    const result = await asAdmin(t).mutation(
      api.lots.mutations.lifecycle.approveLot,
      { lotId }
    );
    expect(result.success).toBe(true);
  });
});

describe("seller VAT profile", () => {
  it("lets a user set their own VAT status and seller type", async () => {
    const t = createTestContext();
    await seed(t);
    await asSeller(t).mutation(api.users.updateMyProfile, {
      vatRegistered: false,
      sellerType: "private_farmer",
    });
    const me = await asSeller(t).query(api.users.getMyProfile, {});
    expect(me?.profile).toMatchObject({
      vatRegistered: false,
      sellerType: "private_farmer",
    });
  });

  it("lets an admin set a seller's profile, audits it and lists it", async () => {
    const t = createTestContext();
    await seed(t);
    await asAdmin(t).mutation(api.users.adminSetSellerVatProfile, {
      userId: SELLER,
      vatRegistered: true,
      sellerType: "dealer",
    });
    const audits = await t.run(async (ctx) =>
      (await ctx.db.query("auditLogs").collect()).filter(
        (row) => row.action === "UPDATE_SELLER_VAT_PROFILE"
      )
    );
    expect(audits).toHaveLength(1);

    const listed = await asAdmin(t).query(api.users.listAllProfiles, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page.find((p) => p.userId === SELLER)).toMatchObject({
      vatRegistered: true,
      sellerType: "dealer",
    });
  });

  it("rejects non-admins and unknown profiles", async () => {
    const t = createTestContext();
    await seed(t);
    await expect(
      asBuyer(t).mutation(api.users.adminSetSellerVatProfile, {
        userId: SELLER,
        vatRegistered: false,
      })
    ).rejects.toThrow();
    await expect(
      asAdmin(t).mutation(api.users.adminSetSellerVatProfile, {
        userId: "ghost",
        vatRegistered: false,
      })
    ).rejects.toThrow("Profile not found");
  });
});

describe("public lot detail", () => {
  it("exposes specs, cold start video url and the seller VAT kind", async () => {
    const t = createTestContext();
    const categoryId = await seed(t);
    const lotId = await insertLot(t, categoryId, {
      status: "assigned",
      images: { front: "https://img.test/front.jpg", additional: [] },
    });
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["video"]))
    );
    await t.run(async (ctx) => {
      await ctx.db.patch("lots", lotId, {
        powerKw: 120,
        drive: "2wd",
        serialNumber: "SN9",
        imageAngles: { "https://img.test/front.jpg": "front" },
        coldStartVideo: storageId,
      });
    });

    // Unset VAT status resolves to the worst case: VAT-registered.
    const detail = await t.query(api.auctions.getLotById, { lotId });
    expect(detail).toMatchObject({
      powerKw: 120,
      drive: "2wd",
      serialNumber: "SN9",
      imageAngles: { "https://img.test/front.jpg": "front" },
      sellerVatKind: "vat",
    });
    expect(detail?.coldStartVideoUrl).toEqual(expect.any(String));
    expect(detail?.sellerTypeLabel).toBeUndefined();

    await asAdmin(t).mutation(api.users.adminSetSellerVatProfile, {
      userId: SELLER,
      vatRegistered: false,
      sellerType: "private_farmer",
    });
    const after = await t.query(api.auctions.getLotById, { lotId });
    expect(after).toMatchObject({
      sellerVatKind: "private",
      sellerTypeLabel: "Private farmer",
    });
  });
});
