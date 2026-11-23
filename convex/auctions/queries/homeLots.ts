// app/convex/auctions/queries/homeLots.ts
import { v, type ObjectType } from "convex/values";

import { query, type QueryCtx } from "./shared";
import { compareLotsInSale, pickLeadImageRef } from "./events";
import { resolveUrlCached } from "../../image_cache";
import { getBidCount, getWatcherCount } from "../../lib/lotCounters";
import { provinceValidator } from "../../lib/provinces";
import {
  HOME_LOTS_DEFAULT_LIMIT,
  HOME_LOTS_MAX_AUCTIONS,
  HOME_LOTS_MAX_LIMIT,
  HOME_LOTS_READ_PER_AUCTION,
} from "../../constants";
import type { Doc, Id } from "../../_generated/dataModel";

/** Validator for one lot card on the Home grid. */
export const HomeLotValidator = v.object({
  _id: v.id("lots"),
  title: v.string(),
  make: v.string(),
  model: v.string(),
  year: v.number(),
  operatingHours: v.number(),
  location: v.string(),
  province: v.optional(provinceValidator),
  lotNumber: v.optional(v.number()),
  auctionId: v.id("auctions"),
  startingPrice: v.number(),
  currentPrice: v.number(),
  /** True when the lot has a reserve (`reservePrice > 0`). */
  hasReserve: v.boolean(),
  /** True when `currentPrice >= reservePrice` (only meaningful with a reserve). */
  reserveMet: v.boolean(),
  watchers: v.number(),
  bids: v.number(),
  /** `extendedEndTime ?? auction.endTime`. */
  effectiveEndTime: v.number(),
  leadImageUrl: v.optional(v.string()),
});

/** Validator for the whole `getHomeLots` result. */
export const HomeLotsResultValidator = v.object({
  /** Buyer-visible lots read across the sales, before any filter. */
  total: v.number(),
  /** Lots left after the filters. */
  matched: v.number(),
  /** True when a sale held more lots than were read (counts are lower bounds). */
  capped: v.boolean(),
  categories: v.array(
    v.object({
      categoryId: v.id("equipmentCategories"),
      name: v.string(),
      count: v.number(),
    })
  ),
  makes: v.array(v.object({ make: v.string(), count: v.number() })),
  /** Lowest and highest current price of the unfiltered lots (null when none). */
  priceRange: v.union(v.null(), v.object({ min: v.number(), max: v.number() })),
  lots: v.array(HomeLotValidator),
});

/** Arguments of `getHomeLots`. */
const homeLotsArgs = {
  auctionIds: v.array(v.id("auctions")),
  categoryId: v.optional(v.id("equipmentCategories")),
  make: v.optional(v.string()),
  minPrice: v.optional(v.number()),
  maxPrice: v.optional(v.number()),
  limit: v.optional(v.number()),
};

type HomeLotsArgs = ObjectType<typeof homeLotsArgs>;

interface Candidate {
  lot: Doc<"lots">;
  effectiveEndTime: number;
}

/**
 * Whether a lot passes the grid filters (category, make, price range).
 *
 * @param lot - The lot.
 * @param args - The filters.
 * @returns True when every given filter matches.
 */
function passes(lot: Doc<"lots">, args: HomeLotsArgs): boolean {
  if (args.categoryId !== undefined && lot.categoryId !== args.categoryId) {
    return false;
  }
  if (args.make !== undefined && lot.make !== args.make) return false;
  if (args.minPrice !== undefined && lot.currentPrice < args.minPrice) {
    return false;
  }
  if (args.maxPrice !== undefined && lot.currentPrice > args.maxPrice) {
    return false;
  }
  return true;
}

/**
 * Counts values and returns them largest first (ties alphabetical).
 *
 * @param values - The values to count.
 * @returns `[value, count]` pairs.
 */
function tally(values: readonly string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
}

/**
 * Home grid data: the lots of the given published sales plus the filter
 * facets (category and make counts, price range) for the chips.
 *
 * Reads at most {@link HOME_LOTS_MAX_AUCTIONS} sales (`ctx.db.get`; draft and
 * closed sales are skipped) and, per sale, at most
 * {@link HOME_LOTS_READ_PER_AUCTION}+1 `assigned` lots through
 * `by_status_auctionId`. Hidden lots are dropped. Category and make counts and
 * the price range describe every lot read, so the chips keep their numbers while
 * a filter is active; `matched` and `lots` follow the filters. Lots are ordered
 * by their own close time, then lot number. Only the returned lots (at most
 * {@link HOME_LOTS_MAX_LIMIT}) cost an image resolve and two counter reads.
 *
 * @param ctx - Query context.
 * @param args - Handler arguments.
 * @returns The grid lots and the facets.
 */
export const getHomeLotsHandler = async (ctx: QueryCtx, args: HomeLotsArgs) => {
  const limit = Math.max(
    1,
    Math.min(
      Math.floor(args.limit ?? HOME_LOTS_DEFAULT_LIMIT) || 1,
      HOME_LOTS_MAX_LIMIT
    )
  );
  const ids = [...new Set(args.auctionIds)].slice(0, HOME_LOTS_MAX_AUCTIONS);

  const perAuction = await Promise.all(
    ids.map(async (auctionId) => {
      const auction = await ctx.db.get("auctions", auctionId);
      if (auction?.status !== "published") {
        return { rows: [] as Candidate[], capped: false };
      }
      const rows = await ctx.db
        .query("lots")
        .withIndex("by_status_auctionId", (q) =>
          q.eq("status", "assigned").eq("auctionId", auctionId)
        )
        .take(HOME_LOTS_READ_PER_AUCTION + 1);
      return {
        capped: rows.length > HOME_LOTS_READ_PER_AUCTION,
        rows: rows
          .slice(0, HOME_LOTS_READ_PER_AUCTION)
          .filter((lot) => lot.hiddenByFlags !== true)
          .map((lot) => ({
            lot,
            effectiveEndTime: lot.extendedEndTime ?? auction.endTime,
          })),
      };
    })
  );
  const candidates = perAuction.flatMap((entry) => entry.rows);
  const capped = perAuction.some((entry) => entry.capped);

  const categoryNames = new Map<Id<"equipmentCategories">, string>();
  const categoryIds = [
    ...new Set(
      candidates.flatMap(({ lot }) => (lot.categoryId ? [lot.categoryId] : []))
    ),
  ];
  await Promise.all(
    categoryIds.map(async (id) => {
      const category = await ctx.db.get("equipmentCategories", id);
      if (category?.isActive === true) categoryNames.set(id, category.name);
    })
  );

  const categories = tally(
    candidates.flatMap(({ lot }) =>
      lot.categoryId && categoryNames.has(lot.categoryId)
        ? [lot.categoryId]
        : []
    )
  ).map(([categoryId, count]) => ({
    categoryId: categoryId as Id<"equipmentCategories">,
    name: categoryNames.get(categoryId as Id<"equipmentCategories">) ?? "",
    count,
  }));
  const makes = tally(candidates.map(({ lot }) => lot.make)).map(
    ([make, count]) => ({ make, count })
  );
  const prices = candidates.map(({ lot }) => lot.currentPrice);

  const matched = candidates
    .filter(({ lot }) => passes(lot, args))
    .sort(
      (a, b) =>
        a.effectiveEndTime - b.effectiveEndTime ||
        compareLotsInSale(a.lot, b.lot)
    );

  const lots = await Promise.all(
    matched.slice(0, limit).map(async ({ lot, effectiveEndTime }) => {
      const ref = pickLeadImageRef(lot.images);
      const [leadImageUrl, watchers, bids] = await Promise.all([
        ref ? resolveUrlCached(ctx.storage, ref) : undefined,
        getWatcherCount(ctx, lot._id),
        getBidCount(ctx, lot._id),
      ]);
      return {
        _id: lot._id,
        title: lot.title,
        make: lot.make,
        model: lot.model,
        year: lot.year,
        operatingHours: lot.operatingHours,
        location: lot.location,
        province: lot.province,
        lotNumber: lot.lotNumber,
        // Assigned lots always carry an auctionId (index equality above).
        auctionId: lot.auctionId as Id<"auctions">,
        startingPrice: lot.startingPrice,
        currentPrice: lot.currentPrice,
        hasReserve: lot.reservePrice > 0,
        reserveMet: lot.currentPrice >= lot.reservePrice,
        watchers,
        bids,
        effectiveEndTime,
        leadImageUrl: leadImageUrl ?? undefined,
      };
    })
  );

  return {
    total: candidates.length,
    matched: matched.length,
    capped,
    categories,
    makes,
    priceRange: prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null,
    lots,
  };
};

/**
 * Public query behind the Home lot grid and its filter chips. See
 * {@link getHomeLotsHandler} for the reads and caps.
 */
export const getHomeLots = query({
  args: homeLotsArgs,
  returns: HomeLotsResultValidator,
  handler: getHomeLotsHandler,
});
