// app/convex/auctions/queries/eventLots.ts
import { ConvexError, v, type ObjectType } from "convex/values";

import { query, type QueryCtx } from "./shared";
import { compareLotsInSale, pickLeadImageRef } from "./events";
import {
  HomeFacetsResultValidator,
  HomeLotValidator,
  passes,
  reserveStateOf,
  tally,
} from "./homeLots";
import { resolveUrlCached } from "../../image_cache";
import {
  getAuctionLotCount,
  getBidCount,
  getWatcherCount,
} from "../../lib/lotCounters";
import {
  EVENT_LOTS_DEFAULT_LIMIT,
  EVENT_LOTS_MAX_LIMIT,
  EVENT_LOTS_MAX_SEARCH_LENGTH,
  EVENT_LOTS_READ_PER_STATUS,
} from "../../constants";
import type { Doc, Id } from "../../_generated/dataModel";

/** Lot statuses buyers can see on a sale page. */
const EVENT_LOT_STATUSES = ["assigned", "sold", "unsold"] as const;

/** Validator for one lot card on the event page: the Home card plus its status. */
export const EventLotValidator = HomeLotValidator.extend({
  /** `assigned` is open for bidding; `sold` and `unsold` are final. */
  status: v.union(
    v.literal("assigned"),
    v.literal("sold"),
    v.literal("unsold")
  ),
});

/** Validator for the `getEventLots` result. */
export const EventLotsResultValidator = v.object({
  /** Lots left after the filters (a lower bound when the sale was capped). */
  matched: v.number(),
  lots: v.array(EventLotValidator),
});

/** Validator for the `getEventFacets` result: the Home facets plus outcomes. */
export const EventFacetsResultValidator = HomeFacetsResultValidator.extend({
  outcomes: v.object({
    sold: v.number(),
    notSold: v.number(),
    /** Always 0 until lots can be "under consideration" (design D6). */
    underConsideration: v.number(),
    /** What the sold lots sold for, in total (rand). */
    soldTotal: v.number(),
  }),
});

/** Arguments of `getEventLots`. */
const eventLotsArgs = {
  auctionId: v.id("auctions"),
  /** Matches make, model or title, case-insensitively. */
  search: v.optional(v.string()),
  categoryId: v.optional(v.id("equipmentCategories")),
  make: v.optional(v.string()),
  minPrice: v.optional(v.number()),
  maxPrice: v.optional(v.number()),
  /** Closed sales: only sold, or only not-sold lots. */
  outcome: v.optional(v.union(v.literal("sold"), v.literal("not_sold"))),
  sort: v.optional(
    v.union(
      v.literal("lot_number"),
      v.literal("price_asc"),
      v.literal("most_watched")
    )
  ),
  limit: v.optional(v.number()),
};

type EventLotsArgs = ObjectType<typeof eventLotsArgs>;

/**
 * Reads the buyer-visible lots of one published or closed sale: for each of
 * `assigned`, `sold` and `unsold`, one `by_status_auctionId` read of at most
 * {@link EVENT_LOTS_READ_PER_STATUS}+1 lots. Hidden (flagged) lots are dropped.
 * Draft and missing sales read nothing.
 *
 * @param ctx - Query context.
 * @param auctionId - The sale.
 * @returns The lots and whether any status was capped.
 */
async function loadEventLots(ctx: QueryCtx, auctionId: Id<"auctions">) {
  const auction = await ctx.db.get("auctions", auctionId);
  if (!auction || auction.status === "draft") {
    return { auction: null, lots: [] as Doc<"lots">[], capped: false };
  }
  const perStatus = await Promise.all(
    EVENT_LOT_STATUSES.map((status) =>
      ctx.db
        .query("lots")
        .withIndex("by_status_auctionId", (q) =>
          q.eq("status", status).eq("auctionId", auctionId)
        )
        .take(EVENT_LOTS_READ_PER_STATUS + 1)
    )
  );
  return {
    auction,
    capped: perStatus.some((rows) => rows.length > EVENT_LOTS_READ_PER_STATUS),
    lots: perStatus
      .flatMap((rows) => rows.slice(0, EVENT_LOTS_READ_PER_STATUS))
      .filter((lot) => lot.hiddenByFlags !== true),
  };
}

/**
 * Filter chip data for the event page: lot total, category and make counts,
 * the price range and, for finished sales, the sold / not-sold counts and the
 * sold total. Separate from the list so picking a chip re-runs only
 * {@link getEventLotsHandler}. See {@link loadEventLots} for the reads and caps.
 *
 * @param ctx - Query context.
 * @param args - Handler arguments.
 * @param args.auctionId - The sale.
 * @returns The facets.
 */
export const getEventFacetsHandler = async (
  ctx: QueryCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  const { auction, lots, capped } = await loadEventLots(ctx, args.auctionId);
  // The chips tally the lots read (capped); the sale's total is exact, from its
  // counter, whenever the backfill has created it. Only `total` is exact: the
  // chip counts, price range and sold figures still come from the capped read.
  // A draft or missing sale reads nothing, so its counter is never exposed.
  const exactTotal = auction
    ? await getAuctionLotCount(ctx, args.auctionId)
    : null;

  const categoryNames = new Map<Id<"equipmentCategories">, string>();
  const categoryIds = [
    ...new Set(lots.flatMap((lot) => (lot.categoryId ? [lot.categoryId] : []))),
  ];
  await Promise.all(
    categoryIds.map(async (id) => {
      const category = await ctx.db.get("equipmentCategories", id);
      if (category?.isActive === true) categoryNames.set(id, category.name);
    })
  );
  const prices = lots.map((lot) => lot.currentPrice);
  const sold = lots.filter((lot) => lot.status === "sold");
  return {
    total: exactTotal ?? lots.length,
    capped: exactTotal === null && capped,
    categories: tally(
      lots.flatMap((lot) =>
        lot.categoryId && categoryNames.has(lot.categoryId)
          ? [lot.categoryId]
          : []
      )
    ).map(([categoryId, count]) => ({
      categoryId: categoryId as Id<"equipmentCategories">,
      name: categoryNames.get(categoryId as Id<"equipmentCategories">) ?? "",
      count,
    })),
    makes: tally(lots.map((lot) => lot.make)).map(([make, count]) => ({
      make,
      count,
    })),
    priceRange: prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null,
    outcomes: {
      sold: sold.length,
      notSold: lots.filter((lot) => lot.status === "unsold").length,
      underConsideration: 0,
      soldTotal: sold.reduce((sum, lot) => sum + lot.currentPrice, 0),
    },
  };
};

/**
 * The event page lot list: the sale's buyer-visible lots that pass the
 * filters, sorted by lot number (default), lowest current price or most
 * watchers, at most `limit` (clamped to 1..{@link EVENT_LOTS_MAX_LIMIT}). The
 * reserve amount is never sent, only its state. Only the returned lots cost an
 * image resolve and two counter reads (every read lot costs one when sorting by
 * watchers).
 *
 * @param ctx - Query context.
 * @param args - Handler arguments.
 * @returns The number of matching lots and the page of lots.
 */
export const getEventLotsHandler = async (
  ctx: QueryCtx,
  args: EventLotsArgs
) => {
  const typed = args.search?.trim() ?? "";
  if (typed.length > EVENT_LOTS_MAX_SEARCH_LENGTH) {
    throw new ConvexError(
      `Search is limited to ${String(EVENT_LOTS_MAX_SEARCH_LENGTH)} characters`
    );
  }
  const search = typed.toLowerCase();
  const limit = Math.max(
    1,
    Math.min(
      Math.floor(args.limit ?? EVENT_LOTS_DEFAULT_LIMIT) || 1,
      EVENT_LOTS_MAX_LIMIT
    )
  );
  const { auction, lots } = await loadEventLots(ctx, args.auctionId);
  if (!auction) return { matched: 0, lots: [] };

  const matched = lots
    .filter((lot) => passes(lot, args))
    .filter(
      (lot) =>
        args.outcome === undefined ||
        lot.status === (args.outcome === "sold" ? "sold" : "unsold")
    )
    .filter(
      (lot) =>
        search === "" ||
        `${lot.make} ${lot.model} ${lot.title}`.toLowerCase().includes(search)
    );

  const sort = args.sort ?? "lot_number";
  let ordered: { lot: Doc<"lots">; watchers?: number }[];
  if (sort === "most_watched") {
    const withWatchers = await Promise.all(
      matched.map(async (lot) => ({
        lot,
        watchers: await getWatcherCount(ctx, lot._id),
      }))
    );
    ordered = withWatchers.sort(
      (a, b) => b.watchers - a.watchers || compareLotsInSale(a.lot, b.lot)
    );
  } else {
    ordered = matched
      .map((lot) => ({ lot }))
      .sort((a, b) =>
        sort === "price_asc"
          ? a.lot.currentPrice - b.lot.currentPrice ||
            compareLotsInSale(a.lot, b.lot)
          : compareLotsInSale(a.lot, b.lot)
      );
  }

  const page = await Promise.all(
    ordered.slice(0, limit).map(async ({ lot, watchers: known }) => {
      const ref = pickLeadImageRef(lot.images);
      const [leadImageUrl, watchers, bids] = await Promise.all([
        ref ? resolveUrlCached(ctx.storage, ref) : undefined,
        known ?? getWatcherCount(ctx, lot._id),
        getBidCount(ctx, lot._id),
      ]);
      const open = lot.status === "assigned";
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
        auctionId: args.auctionId,
        startingPrice: lot.startingPrice,
        currentPrice: lot.currentPrice,
        reserveState: open ? reserveStateOf(lot, bids) : ("none" as const),
        watchers,
        bids,
        effectiveEndTime: lot.extendedEndTime ?? auction.endTime,
        leadImageUrl: leadImageUrl ?? undefined,
        status: lot.status as "assigned" | "sold" | "unsold",
      };
    })
  );
  return { matched: matched.length, lots: page };
};

/**
 * Public query behind the event page lot list. See {@link getEventLotsHandler}.
 */
export const getEventLots = query({
  args: eventLotsArgs,
  returns: EventLotsResultValidator,
  handler: getEventLotsHandler,
});

/**
 * Public query behind the event page filter chips. See
 * {@link getEventFacetsHandler}.
 */
export const getEventFacets = query({
  args: { auctionId: v.id("auctions") },
  returns: EventFacetsResultValidator,
  handler: getEventFacetsHandler,
});
