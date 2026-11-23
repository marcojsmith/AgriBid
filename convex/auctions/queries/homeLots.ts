// app/convex/auctions/queries/homeLots.ts
import { ConvexError, v, type ObjectType } from "convex/values";

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

/** Reserve state of a lot, computed on the server (the reserve amount is never sent). */
export const reserveStateValidator = v.union(
  v.literal("none"),
  v.literal("applies"),
  v.literal("met"),
  v.literal("not_met")
);

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
  /**
   * `none` without a reserve; `applies` until the first bid (so the amount's
   * position relative to the opening price is not leaked); then `met` or
   * `not_met`.
   */
  reserveState: reserveStateValidator,
  watchers: v.number(),
  bids: v.number(),
  /** `extendedEndTime ?? auction.endTime`. */
  effectiveEndTime: v.number(),
  leadImageUrl: v.optional(v.string()),
});

/** Validator for the `getHomeLots` result. */
export const HomeLotsResultValidator = v.object({
  /** Lots left after the filters (a lower bound when the sales were capped). */
  matched: v.number(),
  lots: v.array(HomeLotValidator),
});

/** Validator for the `getHomeFacets` result. */
export const HomeFacetsResultValidator = v.object({
  /** Buyer-visible open lots read across the sales. */
  total: v.number(),
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
  /** Lowest and highest current price of the lots (null when none). */
  priceRange: v.union(v.null(), v.object({ min: v.number(), max: v.number() })),
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
export function passes(
  lot: Doc<"lots">,
  args: Pick<HomeLotsArgs, "categoryId" | "make" | "minPrice" | "maxPrice">
): boolean {
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
 * The reserve state of a lot, computed on the server so the reserve amount is
 * never sent: `none` without a reserve, `applies` until the first bid, then
 * `met` or `not_met`.
 *
 * @param lot - The lot.
 * @param bids - Its bid count.
 * @returns The reserve state.
 */
export function reserveStateOf(lot: Doc<"lots">, bids: number) {
  if (lot.reservePrice <= 0) return "none" as const;
  if (bids === 0) return "applies" as const;
  return lot.currentPrice >= lot.reservePrice
    ? ("met" as const)
    : ("not_met" as const);
}

/**
 * Counts values and returns them largest first (ties alphabetical).
 *
 * @param values - The values to count.
 * @returns `[value, count]` pairs.
 */
export function tally(values: readonly string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
}

/**
 * Reads the buyer-visible lots still open in the given published sales.
 *
 * At most {@link HOME_LOTS_MAX_AUCTIONS} ids are accepted (more throws; repeats
 * are ignored). Per sale: one `get` (draft and closed sales are skipped) and one
 * `by_status_auctionId` read of at most {@link HOME_LOTS_READ_PER_AUCTION}+1
 * `assigned` lots. Hidden lots are dropped, and so are lots whose own close time
 * has passed in a sale that has started (a sale stays live while one lot is
 * soft-close extended, but its other lots are over).
 *
 * @param ctx - Query context.
 * @param auctionIds - The sales to read.
 * @returns The open lots with their close time, and whether any sale was capped.
 */
async function loadOpenLots(ctx: QueryCtx, auctionIds: Id<"auctions">[]) {
  if (auctionIds.length > HOME_LOTS_MAX_AUCTIONS) {
    throw new ConvexError(
      `At most ${String(HOME_LOTS_MAX_AUCTIONS)} auctions per request`
    );
  }
  const now = Date.now();
  const perAuction = await Promise.all(
    [...new Set(auctionIds)].map(async (auctionId) => {
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
      const started = auction.startTime <= now;
      return {
        capped: rows.length > HOME_LOTS_READ_PER_AUCTION,
        rows: rows
          .slice(0, HOME_LOTS_READ_PER_AUCTION)
          .filter((lot) => lot.hiddenByFlags !== true)
          .map((lot) => ({
            lot,
            effectiveEndTime: lot.extendedEndTime ?? auction.endTime,
          }))
          .filter(({ effectiveEndTime }) => !started || effectiveEndTime > now),
      };
    })
  );
  return {
    candidates: perAuction.flatMap((entry) => entry.rows),
    capped: perAuction.some((entry) => entry.capped),
  };
}

/**
 * Filter chip data for Home: lot total, category and make counts and the price
 * range of the open lots of the given sales. Separate from the grid so picking
 * a chip re-runs only {@link getHomeLotsHandler}. See {@link loadOpenLots} for
 * the reads and caps.
 *
 * @param ctx - Query context.
 * @param args - Handler arguments.
 * @param args.auctionIds - The sales to describe.
 * @returns The facets.
 */
export const getHomeFacetsHandler = async (
  ctx: QueryCtx,
  args: { auctionIds: Id<"auctions">[] }
) => {
  const { candidates, capped } = await loadOpenLots(ctx, args.auctionIds);

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
  const prices = candidates.map(({ lot }) => lot.currentPrice);
  return {
    total: candidates.length,
    capped,
    categories,
    makes: tally(candidates.map(({ lot }) => lot.make)).map(
      ([make, count]) => ({ make, count })
    ),
    priceRange: prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null,
  };
};

/**
 * The Home grid: the open lots of the given sales that pass the filters,
 * ordered by their own close time then lot number, at most `limit` (clamped to
 * 1..{@link HOME_LOTS_MAX_LIMIT}). Only the returned lots cost an image resolve
 * and two counter reads. See {@link loadOpenLots} for the other reads.
 *
 * @param ctx - Query context.
 * @param args - Handler arguments.
 * @returns The number of matching lots and the grid lots.
 */
export const getHomeLotsHandler = async (ctx: QueryCtx, args: HomeLotsArgs) => {
  const limit = Math.max(
    1,
    Math.min(
      Math.floor(args.limit ?? HOME_LOTS_DEFAULT_LIMIT) || 1,
      HOME_LOTS_MAX_LIMIT
    )
  );
  const { candidates } = await loadOpenLots(ctx, args.auctionIds);
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
      const reserveState = reserveStateOf(lot, bids);
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
        reserveState,
        watchers,
        bids,
        effectiveEndTime,
        leadImageUrl: leadImageUrl ?? undefined,
      };
    })
  );
  return { matched: matched.length, lots };
};

/**
 * Public query behind the Home lot grid. See {@link getHomeLotsHandler}.
 */
export const getHomeLots = query({
  args: homeLotsArgs,
  returns: HomeLotsResultValidator,
  handler: getHomeLotsHandler,
});

/**
 * Public query behind the Home filter chips. See {@link getHomeFacetsHandler}.
 */
export const getHomeFacets = query({
  args: { auctionIds: v.array(v.id("auctions")) },
  returns: HomeFacetsResultValidator,
  handler: getHomeFacetsHandler,
});
