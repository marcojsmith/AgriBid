/**
 * Public seller page queries, addressed by the seller's name slug.
 *
 * Everything here is readable by anyone, so nothing returns a user id, email,
 * phone, KYC or verification data, or bid activity. The Clerk id never appears
 * in a URL: pages use `profiles.slug`, and an old slug redirects to the current
 * one after a rename.
 */

import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import { query, type QueryCtx } from "./_generated/server";
import { countQuery } from "./admin_utils";
import {
  LotSummaryValidator,
  resolveImageUrls,
  toLotSummaries,
} from "./auctions/helpers";
import {
  getSellerRatingSummary,
  hasEnoughReviews,
  MIN_PUBLIC_REVIEWS,
} from "./reviews";
import { provinceValidator, type Province } from "./lib/provinces";
import { firstWordOf } from "./lib/sellerSlug";
import { getViewer } from "./lib/viewer";
import type { Doc, Id } from "./_generated/dataModel";

/** Sold count shown on the page stops here. */
export const SOLD_COUNT_CAP = 1000;
/** Most recent public lots read to find a seller's province. */
const PROVINCE_SAMPLE = 20;
/** Lots in the current sale shown on the page. */
const CURRENT_LOTS_CAP = 24;
/** Assigned lots read before filtering to published sales. */
const ASSIGNED_READ_CAP = 100;
/** Sold lots listed on the page. */
const SOLD_LIST_CAP = 50;

/**
 * A trimmed string, or null when it is missing or blank.
 *
 * @param value - Text that may be missing or blank
 * @returns The trimmed text, or null
 */
function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
}

/**
 * Finds the profile behind a slug, following a rename redirect.
 *
 * @param ctx - Query context
 * @param slug - A seller slug, current or old
 * @returns The profile and whether the slug was an old one, or null
 */
async function resolveSlug(
  ctx: QueryCtx,
  slug: string
): Promise<{ profile: Doc<"profiles">; redirected: boolean } | null> {
  const current = await ctx.db
    .query("profiles")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (current) return { profile: current, redirected: false };

  const redirect = await ctx.db
    .query("sellerSlugRedirects")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (!redirect) return null;

  const owner = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", redirect.userId))
    .unique();
  if (!owner?.slug) return null;
  return { profile: owner, redirected: true };
}

/**
 * A seller's newest public lots: in a sale or sold, newest first.
 *
 * @param ctx - Query context
 * @param sellerId - The seller's user id
 * @param take - How many to return
 * @returns Up to `take` lots
 */
async function recentPublicLots(
  ctx: QueryCtx,
  sellerId: string,
  take: number
): Promise<Doc<"lots">[]> {
  const [assigned, sold] = await Promise.all(
    (["assigned", "sold"] as const).map((status) =>
      ctx.db
        .query("lots")
        .withIndex("by_seller_status", (q) =>
          q.eq("sellerId", sellerId).eq("status", status)
        )
        .order("desc")
        .take(take)
    )
  );
  return [...assigned, ...sold]
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, take);
}

/**
 * The most common province across lots, or null when none carries one.
 *
 * @param lots - Lots to tally
 * @returns The province key with the most lots
 */
function commonProvince(lots: Doc<"lots">[]): Province | null {
  const tally = new Map<Province, number>();
  for (const lot of lots) {
    if (lot.province)
      tally.set(lot.province, (tally.get(lot.province) ?? 0) + 1);
  }
  let best: Province | null = null;
  let bestCount = 0;
  for (const [province, count] of tally) {
    if (count > bestCount) {
      best = province;
      bestCount = count;
    }
  }
  return best;
}

const sellerPageValidator = v.union(
  v.object({ kind: v.literal("not_found") }),
  v.object({ kind: v.literal("redirect"), slug: v.string() }),
  v.object({
    kind: v.literal("ok"),
    seller: v.object({
      publicName: v.string(),
      slug: v.string(),
      location: v.union(v.string(), v.null()),
      province: v.union(provinceValidator, v.null()),
      vatKind: v.union(v.literal("vat"), v.literal("private")),
      soldCount: v.number(),
      memberSince: v.number(),
      bio: v.union(v.string(), v.null()),
      isOwn: v.boolean(),
      reviews: v.union(
        v.object({ avgRating: v.number(), count: v.number() }),
        v.null()
      ),
    }),
  })
);

/**
 * Public seller page header data for a slug.
 *
 * - `redirect` when the slug is an old one (follow `slug`);
 * - `not_found` when nothing is behind the slug or the seller has no public
 *   lots (in a sale or sold);
 * - `ok` with the public header otherwise. The About text is the approved text
 *   only, and reviews appear only once there are {@link MIN_PUBLIC_REVIEWS}.
 */
export const getSellerPage = query({
  args: { slug: v.string() },
  returns: sellerPageValidator,
  handler: async (ctx, args) => {
    const resolved = await resolveSlug(ctx, args.slug);
    if (!resolved) return { kind: "not_found" as const };
    const { profile, redirected } = resolved;
    const slug = profile.slug;
    if (!slug) return { kind: "not_found" as const };

    const publicLots = await recentPublicLots(
      ctx,
      profile.userId,
      PROVINCE_SAMPLE
    );
    if (publicLots.length === 0) return { kind: "not_found" as const };
    if (redirected) return { kind: "redirect" as const, slug };

    const [soldCount, rating, viewer] = await Promise.all([
      countQuery(
        ctx.db
          .query("lots")
          .withIndex("by_seller_status", (q) =>
            q.eq("sellerId", profile.userId).eq("status", "sold")
          )
      ),
      getSellerRatingSummary(ctx, profile.userId),
      getViewer(ctx),
    ]);

    return {
      kind: "ok" as const,
      seller: {
        publicName: profile.publicName ?? slug,
        slug,
        location: nonEmpty(profile.location),
        province: commonProvince(publicLots),
        vatKind:
          profile.vatRegistered === true
            ? ("vat" as const)
            : ("private" as const),
        soldCount: Math.min(soldCount, SOLD_COUNT_CAP),
        memberSince: profile.createdAt,
        bio: nonEmpty(profile.bio),
        isOwn: viewer.userId !== null && viewer.userId === profile.userId,
        reviews:
          rating.avgRating !== undefined &&
          rating.reviewCount >= MIN_PUBLIC_REVIEWS
            ? { avgRating: rating.avgRating, count: rating.reviewCount }
            : null,
      },
    };
  },
});

/**
 * The seller's lots in published sales, grouped by the sale holding most of them.
 *
 * @param ctx - Query context
 * @param sellerId - The seller's user id
 * @returns Up to {@link CURRENT_LOTS_CAP} lots by lot number, and the main sale
 */
async function currentLots(ctx: QueryCtx, sellerId: string) {
  const assigned = await ctx.db
    .query("lots")
    .withIndex("by_seller_status", (q) =>
      q.eq("sellerId", sellerId).eq("status", "assigned")
    )
    .take(ASSIGNED_READ_CAP);

  const auctionIds = [
    ...new Set(
      assigned.flatMap((lot) => (lot.auctionId ? [lot.auctionId] : []))
    ),
  ];
  const auctions = new Map<Id<"auctions">, Doc<"auctions">>();
  for (const auction of await Promise.all(
    auctionIds.map((id) => ctx.db.get("auctions", id))
  )) {
    if (auction?.status === "published") auctions.set(auction._id, auction);
  }

  const visible = assigned
    .filter(
      (lot) =>
        lot.hiddenByFlags !== true &&
        lot.auctionId !== undefined &&
        auctions.has(lot.auctionId)
    )
    .sort(
      (a, b) =>
        (a.lotNumber ?? Number.MAX_SAFE_INTEGER) -
        (b.lotNumber ?? Number.MAX_SAFE_INTEGER)
    );

  const perSale = new Map<Id<"auctions">, number>();
  for (const lot of visible) {
    if (lot.auctionId) {
      perSale.set(lot.auctionId, (perSale.get(lot.auctionId) ?? 0) + 1);
    }
  }
  let mainSale: Doc<"auctions"> | null = null;
  let mainCount = 0;
  for (const [auctionId, count] of perSale) {
    const auction = auctions.get(auctionId);
    if (auction && count > mainCount) {
      mainSale = auction;
      mainCount = count;
    }
  }

  return { lots: visible.slice(0, CURRENT_LOTS_CAP), mainSale };
}

/**
 * The lots on a seller's page: the current sale and the sold history. A slug
 * that has been renamed behaves like the current one. A slug with nothing
 * behind it returns empty lists.
 */
export const getSellerPageLots = query({
  args: { slug: v.string() },
  returns: v.object({
    current: v.array(LotSummaryValidator),
    currentSale: v.union(
      v.object({
        auctionId: v.id("auctions"),
        title: v.string(),
        endTime: v.number(),
      }),
      v.null()
    ),
    sold: v.array(
      v.object({
        lotId: v.id("lots"),
        title: v.string(),
        image: v.union(v.string(), v.null()),
        soldPrice: v.number(),
        soldAt: v.union(v.number(), v.null()),
      })
    ),
    soldTotal: v.number(),
  }),
  handler: async (ctx, args) => {
    const resolved = await resolveSlug(ctx, args.slug);
    if (!resolved) {
      return { current: [], currentSale: null, sold: [], soldTotal: 0 };
    }
    const sellerId = resolved.profile.userId;

    const [{ lots, mainSale }, soldLots, soldCount] = await Promise.all([
      currentLots(ctx, sellerId),
      ctx.db
        .query("lots")
        .withIndex("by_seller_status", (q) =>
          q.eq("sellerId", sellerId).eq("status", "sold")
        )
        .order("desc")
        .take(SOLD_LIST_CAP),
      countQuery(
        ctx.db
          .query("lots")
          .withIndex("by_seller_status", (q) =>
            q.eq("sellerId", sellerId).eq("status", "sold")
          )
      ),
    ]);

    const current = await toLotSummaries(ctx, lots);

    const sold = await Promise.all(
      soldLots
        // Newest sale first; lots with no recorded sale date go last.
        .sort(
          (a, b) =>
            (b.settledAt ?? Number.NEGATIVE_INFINITY) -
              (a.settledAt ?? Number.NEGATIVE_INFINITY) ||
            b._creationTime - a._creationTime
        )
        .map(async (lot) => {
          const images = await resolveImageUrls(ctx.storage, lot.images, {
            limit: 0,
          });
          return {
            lotId: lot._id,
            title: lot.title,
            image: images.front ?? null,
            soldPrice: lot.currentPrice,
            soldAt: lot.settledAt ?? null,
          };
        })
    );

    return {
      current,
      currentSale: mainSale
        ? {
            auctionId: mainSale._id,
            title: mainSale.title,
            endTime: mainSale.endTime,
          }
        : null,
      sold,
      soldTotal: Math.min(soldCount, SOLD_COUNT_CAP),
    };
  },
});

/**
 * Reviews for a seller's page, newest first. Empty until the seller has
 * {@link MIN_PUBLIC_REVIEWS} reviews. Reviewers appear by first name only.
 */
export const getSellerPageReviews = query({
  args: { slug: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        rating: v.number(),
        comment: v.optional(v.string()),
        createdAt: v.number(),
        reviewerFirstName: v.string(),
        response: v.optional(
          v.object({ text: v.string(), createdAt: v.number() })
        ),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const empty = { page: [], isDone: true, continueCursor: "" };
    const resolved = await resolveSlug(ctx, args.slug);
    if (!resolved) return empty;
    const sellerId = resolved.profile.userId;
    if (!(await hasEnoughReviews(ctx, sellerId))) return empty;

    const results = await ctx.db
      .query("reviews")
      .withIndex("by_reviewee_createdAt", (q) => q.eq("revieweeId", sellerId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      results.page.map(async (review) => {
        const reviewer = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", review.reviewerId))
          .unique();
        return {
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          reviewerFirstName:
            firstWordOf(reviewer?.publicName ?? reviewer?.name) ?? "Buyer",
          response: review.response,
        };
      })
    );

    return {
      page,
      isDone: results.isDone,
      continueCursor: results.continueCursor,
    };
  },
});

/**
 * The slug for a seller's user id, so old `/profile/:userId` links can redirect
 * to `/sellers/:slug`. Null when the user has no slug.
 */
export const getSellerSlugByUserId = query({
  args: { userId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    return profile?.slug ?? null;
  },
});
