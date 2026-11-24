/**
 * Demo timeline for the imported webuytractors.shop catalogue.
 *
 * `seed:weeklyReset` calls {@link scheduleRetime}, which moves every imported
 * sale (those with an `auctions.seedId`) to its place on the timeline relative
 * to now, resets bidding on the live and upcoming sales, then decorates a few
 * live lots with demo bids and watchers.
 *
 * Production safety: it only touches imported sales and their lots, deletes
 * only rows made by the synthetic demo bidders (`mock-*`), never deletes a lot,
 * photo or auction, and never writes company details.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCounter, updateCounter } from "./admin_utils";
import { findWinningBid } from "./auctions/internal";
import {
  bidCounterName,
  syncAuctionLotCount,
  watcherCounterName,
} from "./lib/lotCounters";
import {
  DEMO_BIDDER_IDS,
  WBT_SEED_PREFIX,
  countLotImages,
  isDemoBidder,
  pickShowcaseLots,
  planDemoBids,
  saleWindow,
  shiftTimestamp,
} from "./lib/wbtImport";

/** Lots handled per scheduled batch (keeps each mutation well inside limits). */
const LOTS_PER_BATCH = 100;

/** How many live lots get demo bids and watchers. */
const DEMO_LOT_COUNT = 12;

/** How many lots of a live sale are scanned for showcase machines. */
const SHOWCASE_SCAN_LIMIT = 300;

const statusValidator = v.union(v.literal("published"), v.literal("closed"));
const roleValidator = v.union(
  v.literal("live"),
  v.literal("upcoming"),
  v.literal("closed")
);

/**
 * Schedules a re-time of every imported sale relative to `now`. Cheap: it only
 * reads the sale rows and schedules one batch chain per sale.
 *
 * @param ctx - Mutation context
 * @param now - Current time (ms)
 * @returns How many sales were scheduled
 */
export async function scheduleRetime(
  ctx: MutationCtx,
  now: number
): Promise<number> {
  const sales = await ctx.db
    .query("auctions")
    .withIndex("by_seedId", (q) =>
      q.gte("seedId", WBT_SEED_PREFIX).lt("seedId", "wbt;")
    )
    .take(50);
  let scheduled = 0;
  for (const sale of sales) {
    if (!sale.demoRole) continue;
    const window = saleWindow(sale.demoRole, sale.demoOrder ?? 0, now);
    await ctx.scheduler.runAfter(0, internal.wbtDemo.retimeBatch, {
      auctionId: sale._id,
      role: sale.demoRole,
      startTime: window.startTime,
      endTime: window.endTime,
      status: window.status,
      afterLotNumber: 0,
    });
    scheduled++;
  }
  return scheduled;
}

/**
 * Removes the demo bidders' bids and watches from a live or upcoming lot and
 * puts the lot back to its opening state unless a real person has bid on it.
 *
 * @param ctx - Mutation context
 * @param lot - The lot to reset
 */
async function resetOpenLot(ctx: MutationCtx, lot: Doc<"lots">): Promise<void> {
  const bids = await ctx.db
    .query("bids")
    .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
    .take(500);
  let realBids = 0;
  for (const bid of bids) {
    if (isDemoBidder(bid.bidderId)) {
      await ctx.db.delete("bids", bid._id);
    } else if (bid.status !== "voided") {
      realBids++;
    }
  }
  await updateCounter(ctx, bidCounterName(lot._id), "total", realBids, true);

  const watchers = await ctx.db
    .query("watchlist")
    .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
    .take(500);
  let realWatchers = 0;
  for (const row of watchers) {
    if (isDemoBidder(row.userId)) {
      await ctx.db.delete("watchlist", row._id);
    } else {
      realWatchers++;
    }
  }
  await updateCounter(
    ctx,
    watcherCounterName(lot._id),
    "total",
    realWatchers,
    true
  );

  if (realBids === 0) {
    await ctx.db.patch("lots", lot._id, {
      status: "assigned",
      currentPrice: lot.startingPrice,
      winnerId: undefined,
      settledAt: undefined,
      extendedEndTime: undefined,
      closingSoonNotifiedAt: undefined,
      closingSoonCursor: undefined,
      considerationDeadline: undefined,
    });
    if (lot.status === "under_consideration") {
      // Settlement released the lot's `active` slot when it entered
      // consideration; reopening it takes the slot back.
      await updateCounter(ctx, "lots", "active", 1);
    }
    await syncAuctionLotCount(ctx, lot, {
      status: "assigned",
      auctionId: lot.auctionId,
      hiddenByFlags: lot.hiddenByFlags,
    });
  } else if (lot.status === "under_consideration") {
    // Only real bids remain: the seller is now deciding on the best of those,
    // not on a demo bid that was just deleted. Still under consideration, so
    // the sale's visible-lot count is unchanged.
    const top = await findWinningBid(ctx, lot._id);
    if (top) {
      await ctx.db.patch("lots", lot._id, {
        currentPrice: top.amount,
        winnerId: top.bidderId,
      });
    }
  }
}

/**
 * Shifts a closed lot's settle time and its single winning bid by the amount
 * the sale moved, keeping the real sold/unsold outcome untouched.
 *
 * @param ctx - Mutation context
 * @param lot - The closed lot
 * @param delta - How far the sale moved (ms)
 */
async function shiftClosedLot(
  ctx: MutationCtx,
  lot: Doc<"lots">,
  delta: number
): Promise<void> {
  await ctx.db.patch("lots", lot._id, {
    settledAt: shiftTimestamp(lot.settledAt, delta),
    // A lot under consideration keeps its 48h window relative to the close.
    considerationDeadline: shiftTimestamp(lot.considerationDeadline, delta),
  });
  const bids = await ctx.db
    .query("bids")
    .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
    .take(10);
  for (const bid of bids) {
    if (isDemoBidder(bid.bidderId)) {
      await ctx.db.patch("bids", bid._id, { timestamp: bid.timestamp + delta });
    }
  }
}

/**
 * One batch of a sale re-time. Walks the sale's lots in lot-number order
 * (`afterLotNumber` is the cursor).
 *
 * The first batch (no `delta` yet) computes how far the sale moves and moves
 * the sale itself straight away, then hands `delta` to every later batch. That
 * way a second overlapping chain sees an already-moved sale (a near-zero
 * delta) instead of shifting lots twice, and the settle cron never sees a
 * past-due sale with freshly reset lots.
 */
export const retimeBatch = internalMutation({
  args: {
    auctionId: v.id("auctions"),
    role: roleValidator,
    startTime: v.number(),
    endTime: v.number(),
    status: statusValidator,
    afterLotNumber: v.number(),
    delta: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auction = await ctx.db.get("auctions", args.auctionId);
    if (!auction?.seedId?.startsWith(WBT_SEED_PREFIX)) return null;
    const delta = args.delta ?? args.endTime - auction.endTime;
    if (args.delta === undefined) {
      await ctx.db.patch("auctions", auction._id, {
        startTime: args.startTime,
        endTime: args.endTime,
        status: args.status,
        updatedAt: Date.now(),
      });
    }

    const lots = await ctx.db
      .query("lots")
      .withIndex("by_auctionId_lotNumber", (q) =>
        q.eq("auctionId", args.auctionId).gt("lotNumber", args.afterLotNumber)
      )
      .take(LOTS_PER_BATCH);
    const lastNumber = lots[lots.length - 1]?.lotNumber;
    if (lots.length === LOTS_PER_BATCH && lastNumber !== undefined) {
      // Lots sharing the boundary number must not be skipped by the cursor.
      const seen = new Set(lots.map((lot) => lot._id));
      const sameNumber = await ctx.db
        .query("lots")
        .withIndex("by_auctionId_lotNumber", (q) =>
          q.eq("auctionId", args.auctionId).eq("lotNumber", lastNumber)
        )
        .take(20);
      for (const lot of sameNumber) {
        if (!seen.has(lot._id)) lots.push(lot);
      }
    }

    for (const lot of lots) {
      if (args.role === "closed") {
        await shiftClosedLot(ctx, lot, delta);
      } else {
        await resetOpenLot(ctx, lot);
      }
    }

    if (lots.length >= LOTS_PER_BATCH) {
      const last = lastNumber ?? args.afterLotNumber;
      await ctx.scheduler.runAfter(0, internal.wbtDemo.retimeBatch, {
        ...args,
        delta,
        afterLotNumber: last,
      });
      return null;
    }

    if (args.role === "live") {
      await ctx.scheduler.runAfter(0, internal.wbtDemo.seedLiveDemo, {
        auctionId: auction._id,
      });
    }
    return null;
  },
});

/**
 * Gives a few live lots a short demo bid history and some demo watchers so the
 * hero's "most engaged lot", bid counts and watcher counts are populated. Only
 * lots nobody has bid on are touched, and every row uses a `mock-*` id so the
 * next reset can remove it again.
 */
export const seedLiveDemo = internalMutation({
  args: { auctionId: v.id("auctions") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const auction = await ctx.db.get("auctions", args.auctionId);
    if (!auction?.seedId?.startsWith(WBT_SEED_PREFIX)) return 0;
    const now = Date.now();
    const lots = await ctx.db
      .query("lots")
      .withIndex("by_auctionId_lotNumber", (q) =>
        q.eq("auctionId", args.auctionId)
      )
      .take(SHOWCASE_SCAN_LIMIT);
    const open = lots.filter((lot) => lot.status === "assigned");
    // Decorate the best machines, so the most-engaged (featured) lot is a
    // good showcase and not a non-runner.
    const categoryNames = new Map<Id<"equipmentCategories">, string>();
    for (const lot of open) {
      if (lot.categoryId && !categoryNames.has(lot.categoryId)) {
        const category = await ctx.db.get(
          "equipmentCategories",
          lot.categoryId
        );
        categoryNames.set(lot.categoryId, category?.name ?? "");
      }
    }
    const picks = pickShowcaseLots(
      open.map((lot) => ({
        title: lot.title,
        description: lot.description,
        startingPrice: lot.startingPrice,
        photoCount: countLotImages(lot.images),
        preferred:
          lot.categoryId !== undefined &&
          categoryNames.get(lot.categoryId) === "Tractor",
      })),
      DEMO_LOT_COUNT
    );

    let decorated = 0;
    for (const [position, openIndex] of picks.entries()) {
      const lot = open[openIndex];
      const existing = await ctx.db
        .query("bids")
        .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
        .first();
      if (existing) continue;

      // The best machine (position 0) gets the longest history (4 bids) and
      // the most watchers, so it is the most engaged lot.
      const plan = planDemoBids(
        lot.startingPrice,
        lot.minIncrement,
        position === 0 ? 2 : position
      );
      for (const bid of plan) {
        await ctx.db.insert("bids", {
          lotId: lot._id,
          bidderId: bid.bidderId,
          amount: bid.amount,
          timestamp: now - bid.agoMs,
          status: "valid",
        });
      }
      await ctx.db.patch("lots", lot._id, {
        currentPrice: plan[plan.length - 1].amount,
      });
      await updateCounter(
        ctx,
        bidCounterName(lot._id),
        "total",
        plan.length,
        true
      );
      await addDemoWatchers(ctx, lot._id, Math.max(1, 6 - position));
      decorated++;
    }
    await ctx.scheduler.runAfter(
      0,
      internal.engagement.refreshEngagementScores,
      {}
    );
    return decorated;
  },
});

/**
 * Adds demo watchers to a lot and sets its watcher counter to the real count.
 *
 * @param ctx - Mutation context
 * @param lotId - The lot
 * @param count - How many demo watchers to add
 */
async function addDemoWatchers(
  ctx: MutationCtx,
  lotId: Id<"lots">,
  count: number
): Promise<void> {
  for (const userId of DEMO_BIDDER_IDS.slice(0, count)) {
    const existing = await ctx.db
      .query("watchlist")
      .withIndex("by_user_lot", (q) =>
        q.eq("userId", userId).eq("lotId", lotId)
      )
      .first();
    if (!existing) await ctx.db.insert("watchlist", { userId, lotId });
  }
  const rows = await ctx.db
    .query("watchlist")
    .withIndex("by_lot", (q) => q.eq("lotId", lotId))
    .take(500);
  const counter = await getCounter(ctx, watcherCounterName(lotId));
  if ((counter?.total ?? 0) !== rows.length) {
    await updateCounter(
      ctx,
      watcherCounterName(lotId),
      "total",
      rows.length,
      true
    );
  }
}
