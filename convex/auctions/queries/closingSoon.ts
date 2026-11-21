// app/convex/auctions/queries/closingSoon.ts
import { v } from "convex/values";

import { query, type QueryCtx } from "./shared";
import { compareLotsInSale, pickLeadImageRef } from "./events";
import { resolveUrlCached } from "../../image_cache";
import { provinceValidator } from "../../lib/provinces";
import {
  CLOSING_SOON_ENDED_AUCTION_CAP,
  CLOSING_SOON_EXTENSION_LOOKBACK_MS,
  CLOSING_SOON_LOT_LIMIT,
  CLOSING_SOON_LOTS_PER_AUCTION,
  CLOSING_SOON_UPCOMING_AUCTION_CAP,
  CLOSING_SOON_WINDOW_MS,
} from "../../constants";
import type { Doc, Id } from "../../_generated/dataModel";

/** Validator for one lot on the Home "Closing soon" strip. */
export const ClosingSoonLotValidator = v.object({
  _id: v.id("lots"),
  title: v.string(),
  make: v.string(),
  model: v.string(),
  year: v.number(),
  lotNumber: v.optional(v.number()),
  auctionId: v.id("auctions"),
  auctionTitle: v.string(),
  currentPrice: v.number(),
  startingPrice: v.number(),
  /** True once at least one bid exists (drives "Current bid" vs "Opening bid"). */
  hasBids: v.boolean(),
  /** `extendedEndTime ?? auction.endTime`. */
  effectiveEndTime: v.number(),
  leadImageUrl: v.optional(v.string()),
  location: v.string(),
  province: v.optional(provinceValidator),
});

interface ClosingSoonCandidate {
  lot: Doc<"lots">;
  auctionTitle: string;
  effectiveEndTime: number;
}

/**
 * Reads the buyer-visible lots of one sale that end inside `[now, windowEnd]`.
 *
 * @param ctx - Query context.
 * @param auction - A published sale that has started.
 * @param now - Current time (ms).
 * @param windowEnd - Latest end time to include (ms).
 * @returns Candidates with their own effective end time.
 */
async function candidatesForAuction(
  ctx: QueryCtx,
  auction: Doc<"auctions">,
  now: number,
  windowEnd: number
): Promise<ClosingSoonCandidate[]> {
  const lots = await ctx.db
    .query("lots")
    .withIndex("by_status_auctionId", (q) =>
      q.eq("status", "assigned").eq("auctionId", auction._id)
    )
    .take(CLOSING_SOON_LOTS_PER_AUCTION);

  return lots.flatMap((lot) => {
    const effectiveEndTime = lot.extendedEndTime ?? auction.endTime;
    if (lot.hiddenByFlags === true) return [];
    if (effectiveEndTime <= now || effectiveEndTime > windowEnd) return [];
    return [{ lot, auctionTitle: auction.title, effectiveEndTime }];
  });
}

/**
 * Returns up to `limit` (max {@link CLOSING_SOON_LOT_LIMIT}) buyer-visible lots
 * that end within the next 24 hours across published, started sales, soonest
 * first. Public; drafts, unassigned, hidden, sold/unsold lots and lots of
 * unpublished sales are never returned.
 *
 * A lot's end is `extendedEndTime ?? auction.endTime`. Soft-close extensions
 * have no maximum, so two bounded index reads on `auctions.by_status_endTime`
 * find the sales to look at:
 * 1. sales ending in `[now, now + 24h]`, soonest first, at most
 *    {@link CLOSING_SOON_UPCOMING_AUCTION_CAP};
 * 2. sales that ended in `[now - 24h, now)`, most recent first, at most
 *    {@link CLOSING_SOON_ENDED_AUCTION_CAP}; these are only soft-close
 *    candidates (settle crons may leave them `published`), and a lot from them
 *    is kept only if its own `extendedEndTime` is still in the future.
 * A lot running on more than 24 h past its sale's `endTime` is not listed.
 *
 * Reads at most 30 sales, then 13 `assigned` lots per sale (390 lot documents;
 * lots beyond the 13th in a sale, in creation order, are not considered), then
 * for the 12 returned lots one image resolve and one `bids` read each: about
 * 450 documents in the worst case.
 *
 * `Date.now()` is fixed when Convex caches the result, so the list can include
 * a lot that has ended since; the client must also drop lots whose
 * `effectiveEndTime` has passed. The query re-runs when a read lot changes
 * (including on bids to those lots), which is acceptable at this cap.
 *
 * @param ctx - Query context.
 * @param args - Handler arguments.
 * @param args.limit - Maximum lots to return, clamped to 1..12.
 * @returns Lean lot cards ordered by `effectiveEndTime` ascending.
 */
export const getClosingSoonLotsHandler = async (
  ctx: QueryCtx,
  args: { limit: number }
) => {
  const now = Date.now();
  const windowEnd = now + CLOSING_SOON_WINDOW_MS;
  const limit = Math.max(
    1,
    Math.min(Math.floor(args.limit) || 1, CLOSING_SOON_LOT_LIMIT)
  );

  const [endingSoon, recentlyEnded] = await Promise.all([
    ctx.db
      .query("auctions")
      .withIndex("by_status_endTime", (q) =>
        q
          .eq("status", "published")
          .gte("endTime", now)
          .lte("endTime", windowEnd)
      )
      .order("asc")
      .take(CLOSING_SOON_UPCOMING_AUCTION_CAP),
    ctx.db
      .query("auctions")
      .withIndex("by_status_endTime", (q) =>
        q
          .eq("status", "published")
          .gte("endTime", now - CLOSING_SOON_EXTENSION_LOOKBACK_MS)
          .lt("endTime", now)
      )
      .order("desc")
      .take(CLOSING_SOON_ENDED_AUCTION_CAP),
  ]);

  // Upcoming sales that have not opened yet are not live, so skip them.
  const auctions = [...endingSoon, ...recentlyEnded].filter(
    (auction) => auction.startTime <= now
  );
  const perAuction = await Promise.all(
    auctions.map((auction) =>
      candidatesForAuction(ctx, auction, now, windowEnd)
    )
  );

  const top = perAuction
    .flat()
    .sort(
      (a, b) =>
        a.effectiveEndTime - b.effectiveEndTime ||
        compareLotsInSale(a.lot, b.lot)
    )
    .slice(0, limit);

  return await Promise.all(
    top.map(async ({ lot, auctionTitle, effectiveEndTime }) => {
      const ref = pickLeadImageRef(lot.images);
      const [leadImageUrl, firstBid] = await Promise.all([
        ref ? resolveUrlCached(ctx.storage, ref) : undefined,
        ctx.db
          .query("bids")
          .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
          .filter((q) => q.neq(q.field("status"), "voided"))
          .first(),
      ]);
      return {
        _id: lot._id,
        title: lot.title,
        make: lot.make,
        model: lot.model,
        year: lot.year,
        lotNumber: lot.lotNumber,
        // Assigned lots always carry an auctionId (index equality above).
        auctionId: lot.auctionId as Id<"auctions">,
        auctionTitle,
        currentPrice: lot.currentPrice,
        startingPrice: lot.startingPrice,
        hasBids: firstBid !== null,
        effectiveEndTime,
        leadImageUrl: leadImageUrl ?? undefined,
        location: lot.location,
        province: lot.province,
      };
    })
  );
};

export const getClosingSoonLots = query({
  args: { limit: v.number() },
  returns: v.array(ClosingSoonLotValidator),
  handler: getClosingSoonLotsHandler,
});
