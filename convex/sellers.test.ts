/// <reference types="vite/client" />

/**
 * Integration coverage for the public seller page queries, the trimmed old
 * public queries (`getSellerInfo`, `getSellerReviews`) and seller reports.
 */

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import { assignSellerSlug } from "./lib/sellerSlugs";
import schema from "./schema";
import type { Doc, Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const SELLER = "user_seller_clerk_id";
const OTHER = "user_other_clerk_id";
const ADMIN = "user_admin_clerk_id";
const PAGE = { numItems: 20, cursor: null };

/** Strings that must never appear in a public seller page result. */
const PRIVATE_STRINGS = [
  SELLER,
  "seller@private.example",
  "+27825550147",
  "kycStatus",
  "emailVerified",
  "phoneVerified",
  "bankingVerified",
  "taxNumberVerified",
  "bidsPlaced",
  "userId",
  "sellerId",
  "winnerId",
  "bidderId",
];

/**
 * Asserts a public result carries nothing private.
 *
 * @param result - The query result
 */
function expectNoPrivateData(result: unknown): void {
  const json = JSON.stringify(result);
  for (const text of PRIVATE_STRINGS) {
    expect(json).not.toContain(text);
  }
}

/**
 * Inserts a profile.
 *
 * @param t - Test context
 * @param userId - The user id
 * @param extra - Extra profile fields
 */
async function addProfile(
  t: Ctx,
  userId: string,
  extra: Partial<Doc<"profiles">> = {}
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("profiles", {
      userId,
      role: "buyer",
      isVerified: false,
      createdAt: NOW - 100 * HOUR,
      updatedAt: NOW,
      ...extra,
    });
  });
}

/**
 * Inserts a seller profile with private fields set, and gives it a slug.
 *
 * @param t - Test context
 * @param extra - Extra profile fields
 * @returns The seller's slug
 */
async function addSeller(
  t: Ctx,
  extra: Partial<Doc<"profiles">> = {}
): Promise<string> {
  await addProfile(t, SELLER, {
    role: "seller",
    isVerified: true,
    kycStatus: "verified",
    email: "seller@private.example",
    name: "Thandi Nkosi",
    companyName: "Nkosi Boerdery",
    location: "Wolmaransstad",
    emailVerified: true,
    phoneVerified: true,
    bankingVerified: true,
    taxNumberVerified: true,
    ...extra,
  });
  return await t.run(async (ctx) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", SELLER))
      .unique();
    if (!profile) throw new Error("missing");
    const slug = await assignSellerSlug(ctx, profile);
    if (!slug) throw new Error("no slug");
    return slug;
  });
}

/**
 * Inserts a published sale.
 *
 * @param t - Test context
 * @param title - The sale title
 * @param status - The sale status
 * @returns The auction id
 */
async function addSale(
  t: Ctx,
  title = "November Sale",
  status: Doc<"auctions">["status"] = "published"
): Promise<Id<"auctions">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("auctions", {
      title,
      status,
      startTime: NOW - 2 * HOUR,
      endTime: NOW + 5 * HOUR,
      createdBy: "admin",
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}

/**
 * Inserts a lot for the seller.
 *
 * @param t - Test context
 * @param extra - Lot fields to set
 * @returns The lot id
 */
async function addLot(
  t: Ctx,
  extra: Partial<Doc<"lots">> = {}
): Promise<Id<"lots">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("lots", {
      title: "JD 8R",
      make: "John Deere",
      model: "8R",
      year: 2020,
      operatingHours: 100,
      location: "Free State",
      reservePrice: 1000,
      startingPrice: 500,
      currentPrice: 800,
      minIncrement: 10,
      sellerId: SELLER,
      images: { additional: [] },
      status: "assigned",
      ...extra,
    })
  );
}

/**
 * Inserts `count` reviews of the seller by distinct reviewers.
 *
 * @param t - Test context
 * @param count - How many reviews
 * @param lotId - A lot to hang them on
 */
async function addReviews(
  t: Ctx,
  count: number,
  lotId: Id<"lots">
): Promise<void> {
  await t.run(async (ctx) => {
    for (let i = 0; i < count; i++) {
      const reviewerId = `reviewer_${String(i)}_clerk_id`;
      await ctx.db.insert("profiles", {
        userId: reviewerId,
        name: `Reviewer${String(i)} Surname${String(i)}`,
        email: `reviewer${String(i)}@private.example`,
        role: "buyer",
        isVerified: true,
        createdAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("reviews", {
        lotId,
        reviewerId,
        revieweeId: SELLER,
        rating: 5 - (i % 2),
        comment: `Comment ${String(i)}`,
        createdAt: NOW - i * HOUR,
        ...(i === 0 && {
          response: { text: "Thanks!", createdAt: NOW },
        }),
      });
    }
  });
}

describe("getSellerPage", () => {
  it("is not_found for an unknown slug", async () => {
    const t = makeContext();
    expect(await t.query(api.sellers.getSellerPage, { slug: "nope" })).toEqual({
      kind: "not_found",
    });
  });

  it("is not_found when the seller has no public lots", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    await addLot(t, { status: "draft" });
    await addLot(t, { status: "unsold" });
    expect(await t.query(api.sellers.getSellerPage, { slug })).toEqual({
      kind: "not_found",
    });
  });

  it("is not_found while the seller's only lots sit in an unpublished sale", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    const draftSale = await addSale(t, "Draft Sale", "draft");
    await addLot(t, { auctionId: draftSale, province: "gauteng" });
    expect(await t.query(api.sellers.getSellerPage, { slug })).toEqual({
      kind: "not_found",
    });

    const published = await addSale(t);
    await addLot(t, { auctionId: published, province: "north_west" });
    expect(await t.query(api.sellers.getSellerPage, { slug })).toMatchObject({
      kind: "ok",
      seller: { province: "north_west" },
    });
  });

  it("returns the public header without anything private", async () => {
    const t = makeContext();
    const slug = await addSeller(t, {
      vatRegistered: true,
      bio: "Farming since 1980.",
    });
    const auctionId = await addSale(t);
    await addLot(t, { auctionId, province: "north_west" });
    await addLot(t, { auctionId, province: "north_west" });
    await addLot(t, { auctionId, province: "gauteng" });
    await addLot(t, { status: "sold", province: "free_state" });

    const result = await t.query(api.sellers.getSellerPage, { slug });

    expect(result).toEqual({
      kind: "ok",
      seller: {
        publicName: "Nkosi Boerdery",
        slug: "nkosi-boerdery",
        location: "Wolmaransstad",
        province: "north_west",
        vatKind: "vat",
        soldCount: 1,
        memberSince: NOW - 100 * HOUR,
        bio: "Farming since 1980.",
        isOwn: false,
        reviews: null,
      },
    });
    expectNoPrivateData(result);
  });

  it("shows Private seller unless the seller is VAT registered", async () => {
    const t = makeContext();
    const slug = await addSeller(t, { vatRegistered: false });
    await addLot(t, { status: "sold" });
    const result = await t.query(api.sellers.getSellerPage, { slug });
    expect(result).toMatchObject({
      kind: "ok",
      seller: { vatKind: "private", province: null, bio: null },
    });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", SELLER))
        .unique();
      if (profile) {
        await ctx.db.patch("profiles", profile._id, {
          vatRegistered: undefined,
          location: "  ",
        });
      }
    });
    expect(await t.query(api.sellers.getSellerPage, { slug })).toMatchObject({
      seller: { vatKind: "private", location: null },
    });
  });

  it("never shows the pending About text, only the approved one", async () => {
    const t = makeContext();
    const slug = await addSeller(t, {
      bio: "Approved text",
      bioPending: "Unreviewed text",
      bioStatus: "pending",
    });
    await addLot(t, { status: "sold" });
    const result = await t.query(api.sellers.getSellerPage, { slug });
    expect(result).toMatchObject({ seller: { bio: "Approved text" } });
    expect(JSON.stringify(result)).not.toContain("Unreviewed");
  });

  it("flags isOwn for the seller only, without exposing the id", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    await addLot(t, { status: "sold" });

    const own = await t
      .withIdentity({ subject: SELLER })
      .query(api.sellers.getSellerPage, { slug });
    expect(own).toMatchObject({ seller: { isOwn: true } });
    expectNoPrivateData(own);

    const other = await t
      .withIdentity({ subject: OTHER })
      .query(api.sellers.getSellerPage, { slug });
    expect(other).toMatchObject({ seller: { isOwn: false } });
  });

  it("hides reviews below three and shows the rating from three", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    const lotId = await addLot(t, { status: "sold" });

    await addReviews(t, 2, lotId);
    expect(await t.query(api.sellers.getSellerPage, { slug })).toMatchObject({
      seller: { reviews: null },
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("reviews", {
        lotId,
        reviewerId: "reviewer_extra",
        revieweeId: SELLER,
        rating: 3,
        createdAt: NOW,
      });
    });
    // Ratings are 5, 4 and 3.
    expect(await t.query(api.sellers.getSellerPage, { slug })).toMatchObject({
      seller: { reviews: { avgRating: 4, count: 3 } },
    });
  });

  it("redirects an old slug to the current one", async () => {
    const t = makeContext();
    const oldSlug = await addSeller(t);
    await addLot(t, { status: "sold" });
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", SELLER))
        .unique();
      if (!profile) throw new Error("missing");
      const renamed = { ...profile, companyName: "Brand New Name" };
      await ctx.db.patch("profiles", profile._id, {
        companyName: "Brand New Name",
      });
      await assignSellerSlug(ctx, renamed);
    });

    expect(await t.query(api.sellers.getSellerPage, { slug: oldSlug })).toEqual(
      { kind: "redirect", slug: "brand-new-name" }
    );
    expect(
      await t.query(api.sellers.getSellerPage, { slug: "brand-new-name" })
    ).toMatchObject({ kind: "ok", seller: { publicName: "Brand New Name" } });
  });

  it("is not_found for a redirect whose seller has no public lots", async () => {
    const t = makeContext();
    const oldSlug = await addSeller(t);
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", SELLER))
        .unique();
      if (!profile) throw new Error("missing");
      await ctx.db.insert("sellerSlugRedirects", {
        slug: "ghost",
        userId: "nobody",
        createdAt: NOW,
      });
      await ctx.db.patch("profiles", profile._id, { slug: "other-slug" });
    });
    await addLot(t, { status: "draft" });
    expect(await t.query(api.sellers.getSellerPage, { slug: "ghost" })).toEqual(
      {
        kind: "not_found",
      }
    );
    expect(await t.query(api.sellers.getSellerPage, { slug: oldSlug })).toEqual(
      { kind: "not_found" }
    );
  });
});

describe("getSellerPageLots", () => {
  it("returns empty lists for an unknown slug", async () => {
    const t = makeContext();
    expect(await t.query(api.sellers.getSellerPageLots, { slug: "x" })).toEqual(
      {
        current: [],
        currentSale: null,
        sold: [],
        soldTotal: 0,
      }
    );
  });

  it("lists current lots in published sales by lot number, with the main sale", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    const sale = await addSale(t, "Main Sale");
    const small = await addSale(t, "Small Sale");
    const draftSale = await addSale(t, "Draft Sale", "draft");
    await addLot(t, { auctionId: sale, lotNumber: 3, title: "Third" });
    await addLot(t, { auctionId: sale, lotNumber: 1, title: "First" });
    await addLot(t, { auctionId: sale, title: "No number" });
    await addLot(t, { auctionId: small, lotNumber: 2, title: "Other sale" });
    await addLot(t, { auctionId: draftSale, lotNumber: 1, title: "In draft" });
    await addLot(t, {
      auctionId: sale,
      lotNumber: 9,
      title: "Hidden",
      hiddenByFlags: true,
    });
    await addLot(t, { title: "Not in a sale" });

    const result = await t.query(api.sellers.getSellerPageLots, { slug });

    expect(result.current.map((lot) => lot.title)).toEqual([
      "First",
      "Other sale",
      "Third",
      "No number",
    ]);
    expect(result.currentSale).toEqual({
      auctionId: sale,
      title: "Main Sale",
      endTime: NOW + 5 * HOUR,
    });
    expectNoPrivateData(result);
    expect(JSON.stringify(result)).not.toContain("reservePrice");
  });

  it("caps the current lots at 24", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    const sale = await addSale(t);
    for (let i = 1; i <= 26; i++) {
      await addLot(t, { auctionId: sale, lotNumber: i });
    }
    const result = await t.query(api.sellers.getSellerPageLots, { slug });
    expect(result.current).toHaveLength(24);
    expect(result.current[23].lotNumber).toBe(24);
  });

  it("lists sold lots newest first with price, date and photo", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    const storageId = await t.run(
      async (ctx) => await ctx.storage.store(new Blob(["img"]))
    );
    await addLot(t, {
      status: "sold",
      title: "Older",
      currentPrice: 100_000,
      settledAt: NOW - 10 * HOUR,
    });
    await addLot(t, {
      status: "sold",
      title: "Newer",
      currentPrice: 250_000,
      settledAt: NOW - HOUR,
      images: { front: storageId, additional: [] },
      winnerId: "buyer_clerk_id",
    });
    await addLot(t, { status: "sold", title: "Undated", currentPrice: 5 });

    const result = await t.query(api.sellers.getSellerPageLots, { slug });

    expect(result.sold.map((lot) => lot.title)).toEqual([
      "Newer",
      "Older",
      "Undated",
    ]);
    expect(result.sold[0]).toMatchObject({
      soldPrice: 250_000,
      soldAt: NOW - HOUR,
    });
    expect(result.sold[0].image).toEqual(expect.any(String));
    expect(result.sold[1].image).toBeNull();
    expect(result.sold[2].soldAt).toBeNull();
    expect(result.soldTotal).toBe(3);
    expectNoPrivateData(result);
    expect(JSON.stringify(result)).not.toContain("buyer_clerk_id");
  });

  it("follows an old slug like the current one", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    await addLot(t, { status: "sold", title: "Sold one" });
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", SELLER))
        .unique();
      if (!profile) throw new Error("missing");
      await ctx.db.patch("profiles", profile._id, { slug: "renamed" });
      await ctx.db.insert("sellerSlugRedirects", {
        slug,
        userId: SELLER,
        createdAt: NOW,
      });
    });
    const result = await t.query(api.sellers.getSellerPageLots, { slug });
    expect(result.sold.map((lot) => lot.title)).toEqual(["Sold one"]);
  });
});

describe("getSellerPageReviews", () => {
  it("is empty below three reviews", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    const lotId = await addLot(t, { status: "sold" });
    await addReviews(t, 2, lotId);
    expect(
      await t.query(api.sellers.getSellerPageReviews, {
        slug,
        paginationOpts: PAGE,
      })
    ).toEqual({ page: [], isDone: true, continueCursor: "" });
  });

  it("is empty for an unknown slug", async () => {
    const t = makeContext();
    expect(
      await t.query(api.sellers.getSellerPageReviews, {
        slug: "nope",
        paginationOpts: PAGE,
      })
    ).toEqual({ page: [], isDone: true, continueCursor: "" });
  });

  it("returns reviews newest first with first names only", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    const lotId = await addLot(t, { status: "sold" });
    await addReviews(t, 4, lotId);
    await t.run(async (ctx) => {
      await ctx.db.insert("reviews", {
        lotId,
        reviewerId: "ghost_reviewer",
        revieweeId: SELLER,
        rating: 1,
        createdAt: NOW - 50 * HOUR,
      });
    });

    const result = await t.query(api.sellers.getSellerPageReviews, {
      slug,
      paginationOpts: PAGE,
    });

    expect(result.page.map((r) => r.reviewerFirstName)).toEqual([
      "Reviewer0",
      "Reviewer1",
      "Reviewer2",
      "Reviewer3",
      "Buyer",
    ]);
    expect(result.page[0]).toEqual({
      rating: 5,
      comment: "Comment 0",
      createdAt: NOW,
      reviewerFirstName: "Reviewer0",
      response: { text: "Thanks!", createdAt: NOW },
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain("Surname");
    expect(json).not.toContain("reviewer0@private.example");
    expect(json).not.toContain("reviewer_0_clerk_id");
    expect(json).not.toContain("lotId");
  });

  it("uses the account name, and falls back to the public name when there is none", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    const lotId = await addLot(t, { status: "sold" });
    await addReviews(t, 3, lotId);
    await t.run(async (ctx) => {
      const reviewer = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", "reviewer_1_clerk_id"))
        .unique();
      if (reviewer) {
        await ctx.db.patch("profiles", reviewer._id, {
          name: undefined,
          publicName: "Sipho D.",
        });
      }
      const other = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", "reviewer_2_clerk_id"))
        .unique();
      if (other) {
        await ctx.db.patch("profiles", other._id, {
          publicName: "Ndlovu Farms",
        });
      }
    });
    const result = await t.query(api.sellers.getSellerPageReviews, {
      slug,
      paginationOpts: PAGE,
    });
    const names = result.page.map((r) => r.reviewerFirstName);
    expect(names).toContain("Sipho");
    expect(names).toContain("Reviewer2");
    expect(names).not.toContain("Ndlovu");
  });
});

describe("getSellerSlugByUserId", () => {
  it("returns null for a seller with no public lot", async () => {
    const t = makeContext();
    await addSeller(t);
    await addLot(t, { status: "draft" });
    expect(
      await t.query(api.sellers.getSellerSlugByUserId, { userId: SELLER })
    ).toBeNull();
  });

  it("returns the slug, or null when there is none", async () => {
    const t = makeContext();
    const slug = await addSeller(t);
    await addLot(t, { status: "sold" });
    await addProfile(t, OTHER);
    expect(
      await t.query(api.sellers.getSellerSlugByUserId, { userId: SELLER })
    ).toBe(slug);
    expect(
      await t.query(api.sellers.getSellerSlugByUserId, { userId: OTHER })
    ).toBeNull();
    expect(
      await t.query(api.sellers.getSellerSlugByUserId, { userId: "nobody" })
    ).toBeNull();
  });
});

describe("getSellerInfo privacy", () => {
  const PRIVATE_FIELDS = [
    "kycStatus",
    "emailVerified",
    "phoneVerified",
    "bankingVerified",
    "taxNumberVerified",
    "bidsPlaced",
    "avgSalePrice",
  ];

  /**
   * Seeds a seller with sold lots and bids placed.
   *
   * @param t - Test context
   */
  async function seed(t: Ctx): Promise<void> {
    await addSeller(t);
    await addProfile(t, ADMIN, { role: "admin" });
    await addProfile(t, OTHER);
    await addLot(t, { status: "sold", currentPrice: 100 });
    await addLot(t, { status: "sold", currentPrice: 300 });
    await t.run(async (ctx) => {
      const lot = await ctx.db.query("lots").first();
      if (!lot) throw new Error("missing");
      await ctx.db.insert("bids", {
        lotId: lot._id,
        bidderId: SELLER,
        amount: 5,
        timestamp: NOW,
        status: "valid",
      });
    });
  }

  it("gives an anonymous caller none of the private fields", async () => {
    const t = makeContext();
    await seed(t);
    const info = await t.query(api.auctions.getSellerInfo, {
      sellerId: SELLER,
    });
    expect(info).toMatchObject({ itemsSold: 2, role: "seller" });
    const json = JSON.stringify(info);
    for (const field of PRIVATE_FIELDS) {
      expect(json).not.toContain(`"${field}"`);
    }
  });

  it("gives another signed-in user none of the private fields", async () => {
    const t = makeContext();
    await seed(t);
    const info = await t
      .withIdentity({ subject: OTHER })
      .query(api.auctions.getSellerInfo, { sellerId: SELLER });
    const json = JSON.stringify(info);
    for (const field of PRIVATE_FIELDS) {
      expect(json).not.toContain(`"${field}"`);
    }
  });

  it("gives the seller their private fields", async () => {
    const t = makeContext();
    await seed(t);
    const info = await t
      .withIdentity({ subject: SELLER })
      .query(api.auctions.getSellerInfo, { sellerId: SELLER });
    expect(info).toMatchObject({
      kycStatus: "verified",
      emailVerified: true,
      phoneVerified: true,
      bankingVerified: true,
      taxNumberVerified: true,
      bidsPlaced: 1,
      avgSalePrice: 200,
    });
  });

  it("gives an admin the private fields", async () => {
    const t = makeContext();
    await seed(t);
    const info = await t
      .withIdentity({ subject: ADMIN })
      .query(api.auctions.getSellerInfo, { sellerId: SELLER });
    expect(info).toMatchObject({ kycStatus: "verified", bidsPlaced: 1 });
  });

  it("leaves avgSalePrice out for an owner with no sold lots", async () => {
    const t = makeContext();
    await addSeller(t);
    const info = await t
      .withIdentity({ subject: SELLER })
      .query(api.auctions.getSellerInfo, { sellerId: SELLER });
    expect(info?.avgSalePrice).toBeUndefined();
    expect(info?.bidsPlaced).toBe(0);
  });

  it("hides the rating below three reviews, except from the seller", async () => {
    const t = makeContext();
    await seed(t);
    const lotId = await addLot(t, { status: "sold" });
    await addReviews(t, 2, lotId);

    const anon = await t.query(api.auctions.getSellerInfo, {
      sellerId: SELLER,
    });
    expect(anon).toMatchObject({ reviewCount: 0 });
    expect(anon?.avgRating).toBeUndefined();

    const owner = await t
      .withIdentity({ subject: SELLER })
      .query(api.auctions.getSellerInfo, { sellerId: SELLER });
    expect(owner).toMatchObject({ reviewCount: 2, avgRating: 4.5 });
  });

  it("shows the rating from three reviews", async () => {
    const t = makeContext();
    await seed(t);
    const lotId = await addLot(t, { status: "sold" });
    await addReviews(t, 3, lotId);
    const info = await t.query(api.auctions.getSellerInfo, {
      sellerId: SELLER,
    });
    expect(info).toMatchObject({ reviewCount: 3 });
  });

  it("returns null for an unknown seller", async () => {
    const t = makeContext();
    expect(
      await t.query(api.auctions.getSellerInfo, { sellerId: "nobody" })
    ).toBeNull();
  });
});

describe("getSellerReviews privacy", () => {
  it("returns an empty page below three reviews, except to the seller and admins", async () => {
    const t = makeContext();
    await addSeller(t);
    await addProfile(t, ADMIN, { role: "admin" });
    const lotId = await addLot(t, { status: "sold" });
    await addReviews(t, 2, lotId);

    const args = { sellerId: SELLER, paginationOpts: PAGE };
    const anon = await t.query(api.reviews.getSellerReviews, args);
    expect(anon.page).toEqual([]);
    expect(anon.isDone).toBe(true);

    const owner = await t
      .withIdentity({ subject: SELLER })
      .query(api.reviews.getSellerReviews, args);
    expect(owner.page).toHaveLength(2);

    const admin = await t
      .withIdentity({ subject: ADMIN })
      .query(api.reviews.getSellerReviews, args);
    expect(admin.page).toHaveLength(2);
  });

  it("gives first names only once the threshold is met", async () => {
    const t = makeContext();
    await addSeller(t);
    const lotId = await addLot(t, { status: "sold" });
    await addReviews(t, 3, lotId);
    const result = await t.query(api.reviews.getSellerReviews, {
      sellerId: SELLER,
      paginationOpts: PAGE,
    });
    expect(result.page.map((r) => r.reviewerName)).toEqual([
      "Reviewer0",
      "Reviewer1",
      "Reviewer2",
    ]);
    expect(JSON.stringify(result)).not.toContain("Surname");
  });
});

describe("reporting a seller", () => {
  /**
   * Seeds a seller with a public lot and a signed-in reporter.
   *
   * @param t - Test context
   * @returns The seller's slug
   */
  async function seed(t: Ctx): Promise<string> {
    const slug = await addSeller(t);
    await addLot(t, { status: "sold" });
    await addProfile(t, OTHER);
    return slug;
  }

  const asReporter = (t: Ctx) => t.withIdentity({ subject: OTHER });

  it("reportSellerBySlug files a report against the seller", async () => {
    const t = makeContext();
    const slug = await seed(t);
    await expect(
      asReporter(t).mutation(api.profileFlags.reportSellerBySlug, {
        slug,
        reason: "misleading_listing",
        details: "Photos are not of the machine",
      })
    ).resolves.toEqual({ success: true });

    const flags = await t.run(
      async (ctx) => await ctx.db.query("profileFlags").collect()
    );
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      reportedUserId: SELLER,
      reporterId: OTHER,
      reason: "misleading_listing",
      status: "pending",
    });
  });

  it("resolves an old slug", async () => {
    const t = makeContext();
    const slug = await seed(t);
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", SELLER))
        .unique();
      if (!profile) throw new Error("missing");
      await ctx.db.patch("profiles", profile._id, { slug: "renamed" });
      await ctx.db.insert("sellerSlugRedirects", {
        slug,
        userId: SELLER,
        createdAt: NOW,
      });
    });
    await asReporter(t).mutation(api.profileFlags.reportSellerBySlug, {
      slug,
      reason: "suspected_fraud",
    });
    const flags = await t.run(
      async (ctx) => await ctx.db.query("profileFlags").collect()
    );
    expect(flags[0]).toMatchObject({ reportedUserId: SELLER });
  });

  it("rejects an unknown slug", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      asReporter(t).mutation(api.profileFlags.reportSellerBySlug, {
        slug: "nobody",
        reason: "other",
      })
    ).rejects.toThrow("Seller not found");
  });

  it("rejects a redirect whose seller is gone", async () => {
    const t = makeContext();
    await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("sellerSlugRedirects", {
        slug: "orphan",
        userId: "deleted_user",
        createdAt: NOW,
      });
    });
    await expect(
      asReporter(t).mutation(api.profileFlags.reportSellerBySlug, {
        slug: "orphan",
        reason: "other",
      })
    ).rejects.toThrow("Seller not found");
  });

  it("applies the self-report and duplicate rules", async () => {
    const t = makeContext();
    const slug = await seed(t);
    await expect(
      t
        .withIdentity({ subject: SELLER })
        .mutation(api.profileFlags.reportSellerBySlug, {
          slug,
          reason: "other",
        })
    ).rejects.toThrow("You cannot report your own profile");

    await asReporter(t).mutation(api.profileFlags.reportSellerBySlug, {
      slug,
      reason: "offensive_content",
    });
    await expect(
      asReporter(t).mutation(api.profileFlags.reportSellerBySlug, {
        slug,
        reason: "other",
      })
    ).rejects.toThrow("You have already reported this profile");
  });

  it("requires a signed-in reporter", async () => {
    const t = makeContext();
    const slug = await seed(t);
    await expect(
      t.mutation(api.profileFlags.reportSellerBySlug, { slug, reason: "other" })
    ).rejects.toThrow();
  });

  it("reportProfile accepts the new reasons and rejects the retired ones", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      asReporter(t).mutation(api.profileFlags.reportProfile, {
        reportedUserId: SELLER,
        reason: "offensive_content",
      })
    ).resolves.toEqual({ success: true });
    await expect(
      asReporter(t).mutation(api.profileFlags.reportProfile, {
        reportedUserId: SELLER,
        // Retired reason: the validator refuses it for new reports.
        reason: "fake_account" as never,
      })
    ).rejects.toThrow();
  });

  it("admins still list reports that carry a retired reason", async () => {
    const t = makeContext();
    await seed(t);
    await addProfile(t, ADMIN, { role: "admin" });
    await t.run(async (ctx) => {
      await ctx.db.insert("profileFlags", {
        reportedUserId: SELLER,
        reporterId: OTHER,
        reason: "fake_account",
        status: "pending",
        createdAt: NOW,
      });
      await ctx.db.insert("profileFlags", {
        reportedUserId: SELLER,
        reporterId: "another",
        reason: "suspected_fraud",
        status: "pending",
        createdAt: NOW,
      });
    });
    const flags = await t
      .withIdentity({ subject: ADMIN })
      .query(api.profileFlags.getAllPendingProfileFlags, {});
    expect(flags.map((f) => f.reason).sort()).toEqual([
      "fake_account",
      "suspected_fraud",
    ]);
  });
});
