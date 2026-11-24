/**
 * Internal functions behind `scripts/import-wbt.ts`, the webuytractors.shop
 * demo import. Every function here is `internal*`: it can only be called with
 * the deployment's admin key (the script) or from other Convex functions,
 * never from a browser. The photo upload path is `generateUploadUrl`.
 */
import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { updateCounter, getCounter } from "./admin_utils";
import { recalculateCounters } from "./lib/seedCounters";
import {
  bidCounterName,
  lotNumberCounterName,
  removeLotWatchData,
} from "./lib/lotCounters";
import { provinceValidator } from "./lib/provinces";
import { deleteAuctionImages } from "./lib/storage";
import {
  DEMO_BIDDER_IDS,
  countLotImages,
  isDemoBidder,
  WBT_BUYER_PREMIUM_PCT,
  WBT_CATEGORIES,
  WBT_SEED_PREFIX,
  WBT_SELLER_NAME,
  WBT_SELLER_USER_ID,
  WBT_SELLER_COMMISSION_PCT,
  saleWindow,
  settledAtFor,
} from "./lib/wbtImport";
import { scheduleRetime } from "./wbtDemo";

/** The sale timeline roles as a validator. */
const roleValidator = v.union(
  v.literal("live"),
  v.literal("upcoming"),
  v.literal("closed")
);

/** The most lots one `upsertLots` call may carry. */
const MAX_LOTS_PER_CALL = 20;

/** The titles the retired US/Cloud demo seed gave its sales (they had no seedId). */
export const OLD_DEMO_AUCTION_TITLES: readonly string[] = [
  "Harvest Equipment — August Clearance",
  "Construction & Utility — September Clearance",
  "Telehandler Closeout",
  "Year-End Tractor Sale",
  "Harvest & Field Equipment Sale",
  "Material Handling Sale",
  "Row Crop Tractor Sale — Next Round",
];

/**
 * Returns a one-time URL the import script POSTs a photo to. Internal, so only
 * the admin key can mint one; the URL itself expires after one hour.
 */
export const generateUploadUrl = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Creates (or refreshes) the synthetic "We Buy Tractors" seller profile that
 * owns every imported lot. The name is the real company name from the source;
 * no phone, address or email is stored. VAT status defaults to a VAT-registered
 * farming business for the demo.
 */
export const ensureSeller = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", WBT_SELLER_USER_ID))
      .unique();
    if (existing) {
      if (
        existing.sellerType === undefined ||
        existing.vatRegistered === undefined
      ) {
        await ctx.db.patch("profiles", existing._id, {
          sellerType: existing.sellerType ?? "farming_business",
          vatRegistered: existing.vatRegistered ?? true,
          updatedAt: now,
        });
      }
      return WBT_SELLER_USER_ID;
    }
    await ctx.db.insert("profiles", {
      userId: WBT_SELLER_USER_ID,
      name: WBT_SELLER_NAME,
      role: "seller",
      isVerified: true,
      kycStatus: "verified",
      sellerType: "farming_business",
      vatRegistered: true,
      createdAt: now,
      updatedAt: now,
    });
    return WBT_SELLER_USER_ID;
  },
});

/**
 * Creates or updates one imported sale, keyed on `seedId`. The window is set
 * relative to now from the sale's timeline role (weeklyReset keeps it fresh).
 */
export const upsertSale = internalMutation({
  args: {
    seedId: v.string(),
    role: roleValidator,
    closedOrder: v.number(),
    title: v.string(),
    description: v.string(),
  },
  returns: v.id("auctions"),
  handler: async (ctx, args) => {
    if (!args.seedId.startsWith(WBT_SEED_PREFIX)) {
      throw new Error("Sale seedId must start with the import prefix");
    }
    const now = Date.now();
    const window = saleWindow(args.role, args.closedOrder, now);
    const fields = {
      title: args.title,
      description: args.description,
      startTime: window.startTime,
      endTime: window.endTime,
      status: window.status,
      defaultBuyerPremiumPct: WBT_BUYER_PREMIUM_PCT / 100,
      defaultSellerCommissionPct: WBT_SELLER_COMMISSION_PCT / 100,
      seedId: args.seedId,
      demoRole: args.role,
      demoOrder: args.closedOrder,
      updatedAt: now,
    };
    const existing = await ctx.db
      .query("auctions")
      .withIndex("by_seedId", (q) => q.eq("seedId", args.seedId))
      .unique();
    if (existing) {
      await ctx.db.patch("auctions", existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("auctions", {
      ...fields,
      createdBy: "system:import",
      createdAt: now,
    });
  },
});

/**
 * Lists the imported lots and how many photos each already has, so a re-run
 * can skip downloading photos for lots that are in place. Bounded to 2000.
 */
export const listImportedLots = internalQuery({
  args: {},
  returns: v.array(v.object({ seedId: v.string(), photoCount: v.number() })),
  handler: async (ctx) => {
    const lots = await ctx.db
      .query("lots")
      .withIndex("by_seedId", (q) =>
        q.gte("seedId", WBT_SEED_PREFIX).lt("seedId", "wbt;")
      )
      .take(2000);
    return lots.map((lot) => ({
      seedId: lot.seedId ?? "",
      photoCount: countLotImages(lot.images),
    }));
  },
});

/** One imported lot, as sent by the script. */
const lotInput = v.object({
  seedId: v.string(),
  title: v.string(),
  make: v.string(),
  model: v.string(),
  year: v.number(),
  operatingHours: v.number(),
  location: v.string(),
  province: v.optional(provinceValidator),
  category: v.string(),
  description: v.optional(v.string()),
  lotNumber: v.number(),
  /** Convex storage ids of the uploaded photos, lead photo first. Empty keeps the stored photos. */
  photos: v.array(v.string()),
  status: v.union(
    v.literal("assigned"),
    v.literal("sold"),
    v.literal("unsold")
  ),
  startingPrice: v.number(),
  currentPrice: v.number(),
  reservePrice: v.number(),
  minIncrement: v.number(),
  hasWinningBid: v.boolean(),
  bidCount: v.number(),
  /** Position in the sale (0-based) and the sale's lot count, for settle times. */
  index: v.number(),
  total: v.number(),
});

/**
 * Looks up a category id by name, creating the category when the seed has not
 * run yet.
 *
 * @param ctx - Mutation context
 * @param name - The category name
 * @returns The category id
 */
async function categoryIdFor(
  ctx: MutationCtx,
  name: string
): Promise<Id<"equipmentCategories">> {
  const existing = await ctx.db
    .query("equipmentCategories")
    .withIndex("by_name", (q) => q.eq("name", name))
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert("equipmentCategories", {
    name,
    isActive: true,
  });
}

/**
 * Creates or updates a batch of lots in one imported sale, keyed on `seedId`.
 * Re-running with the same input changes nothing but `updatedAt`-style fields.
 *
 * Prices and outcomes come from the source: sold lots get the real winning
 * price, ONE valid bid row (a rotating demo bidder) so the history and winner
 * are consistent, and a bid counter equal to the source's real bid count;
 * unsold lots get no bid rows. Lots snapshot the auction's 12% buyer premium
 * (`premiumSource: "auction"`).
 */
export const upsertLots = internalMutation({
  args: {
    auctionId: v.id("auctions"),
    lots: v.array(lotInput),
  },
  returns: v.object({ created: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    if (args.lots.length > MAX_LOTS_PER_CALL) {
      throw new Error(`At most ${MAX_LOTS_PER_CALL.toString()} lots per call`);
    }
    const auction = await ctx.db.get("auctions", args.auctionId);
    if (!auction?.seedId?.startsWith(WBT_SEED_PREFIX)) {
      throw new Error("Not an imported sale");
    }
    const seller = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", WBT_SELLER_USER_ID))
      .unique();
    if (!seller) throw new Error("Run ensureSeller first");

    const now = Date.now();
    let created = 0;
    let updated = 0;
    let maxNumber = 0;

    for (const input of args.lots) {
      if (!input.seedId.startsWith(WBT_SEED_PREFIX)) {
        throw new Error("Lot seedId must start with the import prefix");
      }
      if (!WBT_CATEGORIES.some((name) => name === input.category)) {
        throw new Error(`Unknown category ${input.category}`);
      }
      maxNumber = Math.max(maxNumber, input.lotNumber);
      const closed = input.status !== "assigned";
      const settledAt = closed
        ? settledAtFor(auction.endTime, input.index, input.total)
        : undefined;
      const existing = await ctx.db
        .query("lots")
        .withIndex("by_seedId", (q) => q.eq("seedId", input.seedId))
        .first();

      const images =
        input.photos.length > 0
          ? { front: input.photos[0], additional: input.photos.slice(1) }
          : (existing?.images ?? { additional: [] });
      const winnerId =
        input.status === "sold"
          ? DEMO_BIDDER_IDS[input.index % DEMO_BIDDER_IDS.length]
          : undefined;

      const fields = {
        title: input.title,
        make: input.make,
        model: input.model,
        year: input.year,
        operatingHours: input.operatingHours,
        location: input.location,
        province: input.province,
        categoryId: await categoryIdFor(ctx, input.category),
        description: input.description,
        reservePrice: input.reservePrice,
        startingPrice: input.startingPrice,
        currentPrice: input.currentPrice,
        minIncrement: input.minIncrement,
        sellerId: WBT_SELLER_USER_ID,
        status: input.status,
        auctionId: args.auctionId,
        lotNumber: input.lotNumber,
        settledAt,
        winnerId,
        images,
        resolvedBuyerPremiumPct: WBT_BUYER_PREMIUM_PCT / 100,
        premiumSource: "auction" as const,
        resolvedSellerCommissionPct: WBT_SELLER_COMMISSION_PCT / 100,
        commissionSource: "auction" as const,
        sellerVatRegistered: seller.vatRegistered ?? true,
        sellerType: seller.sellerType ?? "farming_business",
        seedId: input.seedId,
      };

      let lotId: Id<"lots">;
      if (existing) {
        lotId = existing._id;
        updated++;
        const existingBids = await ctx.db
          .query("bids")
          .withIndex("by_lot", (q) => q.eq("lotId", lotId))
          .take(500);
        const hasRealBid = existingBids.some(
          (bid) => !isDemoBidder(bid.bidderId) && bid.status !== "voided"
        );
        if (hasRealBid) {
          // A real person has bid: refresh the descriptive fields only, never
          // the price, status, winner or bid history.
          await ctx.db.patch("lots", existing._id, {
            ...fields,
            currentPrice: existing.currentPrice,
            status: existing.status,
            winnerId: existing.winnerId,
            settledAt: existing.settledAt,
          });
          continue;
        }
        await ctx.db.patch("lots", existing._id, fields);
        // Only demo bids are left: clear them so the bid history matches the
        // refreshed outcome (a sold lot gets its one winning bid below).
        for (const bid of existingBids) {
          await ctx.db.delete("bids", bid._id);
        }
      } else {
        lotId = await ctx.db.insert("lots", { ...fields, createdAt: now });
        created++;
      }

      if (input.status === "sold" && winnerId && settledAt !== undefined) {
        await ctx.db.insert("bids", {
          lotId,
          bidderId: winnerId,
          amount: input.currentPrice,
          timestamp: settledAt - 60_000,
          status: "valid",
        });
      }
      if (existing && !closed) {
        await updateCounter(ctx, bidCounterName(lotId), "total", 0, true);
      }
      if (closed) {
        await updateCounter(
          ctx,
          bidCounterName(lotId),
          "total",
          input.bidCount,
          true
        );
      }
    }

    // The sale's lot-number counter must never trail the numbers we assigned.
    const counterName = lotNumberCounterName(args.auctionId);
    const counter = await getCounter(ctx, counterName);
    if ((counter?.total ?? 0) < maxNumber) {
      await updateCounter(ctx, counterName, "total", maxNumber, true);
    }
    return { created, updated };
  },
});

/**
 * Finishes an import: recalculates the global dashboard counters and schedules
 * the same timeline re-time `seed:weeklyReset` runs, so the live sale is live
 * and has demo engagement as soon as the import ends. Idempotent.
 */
export const finalizeImport = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await recalculateCounters(ctx);
    await scheduleRetime(ctx, Date.now());
    return null;
  },
});

/** One row of the retire-old-demo report. */
const retireRow = v.object({
  kind: v.union(v.literal("lot"), v.literal("auction")),
  id: v.string(),
  title: v.string(),
  seedId: v.optional(v.string()),
});

/**
 * One-off clean-up of the retired demo seed's lots and sales.
 *
 * Old demo lots are those whose `seedId` is set and does NOT start with the
 * import prefix; old demo sales are those with an exact old demo title and no
 * `seedId`. Lots without any `seedId` (created by real users) and every other
 * sale are never touched. Dry run unless `apply` is true: it then only lists
 * what it would delete.
 */
export const retireOldDemo = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  returns: v.object({
    applied: v.boolean(),
    rows: v.array(retireRow),
  }),
  handler: async (ctx, args) => {
    const apply = args.apply === true;
    const below = await ctx.db
      .query("lots")
      .withIndex("by_seedId", (q) =>
        q.gte("seedId", "").lt("seedId", WBT_SEED_PREFIX)
      )
      .take(500);
    const above = await ctx.db
      .query("lots")
      .withIndex("by_seedId", (q) => q.gte("seedId", "wbt;"))
      .take(500);
    const lots = [...below, ...above];

    const lotIds = new Set<Id<"lots">>(lots.map((lot) => lot._id));
    const titled = (await ctx.db.query("auctions").take(500)).filter(
      (a) => a.seedId === undefined && OLD_DEMO_AUCTION_TITLES.includes(a.title)
    );
    // A sale that still holds a lot this step is not deleting (for example a
    // real user's lot an admin assigned to it) is left alone.
    const auctions: Doc<"auctions">[] = [];
    for (const auction of titled) {
      const held = await ctx.db
        .query("lots")
        .withIndex("by_auctionId_lotNumber", (q) =>
          q.eq("auctionId", auction._id)
        )
        .take(500);
      if (held.every((lot) => lotIds.has(lot._id))) auctions.push(auction);
    }

    const rows: {
      kind: "lot" | "auction";
      id: string;
      title: string;
      seedId?: string;
    }[] = [
      ...lots.map((lot) => ({
        kind: "lot" as const,
        id: lot._id,
        title: lot.title,
        seedId: lot.seedId,
      })),
      ...auctions.map((auction) => ({
        kind: "auction" as const,
        id: auction._id,
        title: auction.title,
      })),
    ];
    if (!apply) return { applied: false, rows };

    for (const lot of lots) {
      await deleteLotAndRelated(ctx, lot);
    }
    for (const auction of auctions) {
      const counter = await getCounter(ctx, lotNumberCounterName(auction._id));
      if (counter) await ctx.db.delete("counters", counter._id);
      await ctx.db.delete("auctions", auction._id);
    }
    await recalculateCounters(ctx);
    return { applied: true, rows };
  },
});

/**
 * Deletes a demo lot with the rows that only exist because of it.
 *
 * @param ctx - Mutation context
 * @param lot - The lot to remove
 */
async function deleteLotAndRelated(
  ctx: MutationCtx,
  lot: Doc<"lots">
): Promise<void> {
  const bids = await ctx.db
    .query("bids")
    .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
    .take(200);
  for (const bid of bids) await ctx.db.delete("bids", bid._id);
  const proxies = await ctx.db
    .query("proxy_bids")
    .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
    .take(200);
  for (const proxy of proxies) await ctx.db.delete("proxy_bids", proxy._id);
  const fees = await ctx.db
    .query("lotFees")
    .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
    .take(50);
  for (const fee of fees) await ctx.db.delete("lotFees", fee._id);
  const flags = await ctx.db
    .query("lotFlags")
    .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
    .take(50);
  for (const flag of flags) await ctx.db.delete("lotFlags", flag._id);
  await removeLotWatchData(ctx, lot._id);
  await deleteAuctionImages(ctx, lot.images);
  await ctx.db.delete("lots", lot._id);
}
