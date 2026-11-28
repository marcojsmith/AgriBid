/**
 * Looking up a seller by page slug, shared by the public seller page queries
 * and `reportSellerBySlug` so both agree on what "a seller page exists" means.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Lots in the current sale shown on the page. */
const CURRENT_LOTS_CAP = 24;
/** Assigned lots read before filtering to published sales. */
const ASSIGNED_READ_CAP = 100;

/**
 * Finds the profile behind a slug, following a rename redirect.
 *
 * @param ctx - Query context
 * @param slug - A seller slug, current or old
 * @returns The profile and whether the slug was an old one, or null
 */
export async function resolveSlug(
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
 * A seller's newest public lots, newest first: sold lots and lots in a
 * published sale. A lot in a draft sale is not public yet.
 *
 * @param ctx - Query context
 * @param sellerId - The seller's user id
 * @param take - How many to return
 * @returns Up to `take` lots
 */
export async function recentPublicLots(
  ctx: QueryCtx,
  sellerId: string,
  take: number
): Promise<Doc<"lots">[]> {
  const [sold, current] = await Promise.all([
    ctx.db
      .query("lots")
      .withIndex("by_seller_status", (q) =>
        q.eq("sellerId", sellerId).eq("status", "sold")
      )
      .order("desc")
      .take(take),
    currentLots(ctx, sellerId),
  ]);
  return [...sold, ...current.lots]
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, take);
}

/**
 * The seller's lots in published sales, grouped by the sale holding most of them.
 *
 * @param ctx - Query context
 * @param sellerId - The seller's user id
 * @returns Up to {@link CURRENT_LOTS_CAP} lots by lot number, and the main sale
 */
export async function currentLots(ctx: QueryCtx, sellerId: string) {
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
 * Resolves a slug (current or renamed) to a seller whose page exists: one with
 * at least one public lot (sold, or in a published sale). Anything else is the
 * same "no such seller" answer, so callers cannot probe for hidden slugs.
 *
 * @param ctx - Query or mutation context
 * @param slug - A seller slug, current or old
 * @param sample - How many recent public lots to return (at least 1)
 * @returns The profile, whether the slug was an old one, and the recent public lots; or null
 */
export async function resolvePublicSeller(
  ctx: QueryCtx,
  slug: string,
  sample = 1
): Promise<{
  profile: Doc<"profiles">;
  redirected: boolean;
  publicLots: Doc<"lots">[];
} | null> {
  const resolved = await resolveSlug(ctx, slug);
  if (!resolved) return null;
  const publicLots = await recentPublicLots(
    ctx,
    resolved.profile.userId,
    Math.max(1, sample)
  );
  if (publicLots.length === 0) return null;
  return { ...resolved, publicLots };
}
