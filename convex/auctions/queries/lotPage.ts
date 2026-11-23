import { v } from "convex/values";

import { query, type QueryCtx } from "./shared";
import type { Doc, Id } from "../../_generated/dataModel";
import { getAuthUser, resolveUserId } from "../../lib/auth";
import { getBidCount } from "../../lib/lotCounters";

/** Public lot statuses whose bid history may be shown. */
const PUBLIC_STATUSES: readonly string[] = ["assigned", "sold", "unsold"];

/** Most bids the lot page lists; the rest are summarised as a count. */
export const LOT_BID_HISTORY_LIMIT = 20;

/** Bids read to find the caller's own highest bid on one lot. */
const MY_BIDS_READ_CAP = 200;

/**
 * Hash used to mask bidder ids. Not a security boundary on its own: the salt
 * (`BIDDER_LABEL_SALT`) is server-side only, so labels cannot be matched back
 * to a user id by anyone who lacks it.
 *
 * @param text - The text to hash
 * @returns A non-negative 53-bit integer
 */
export function hashText(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * The masked label of a bidder on one lot: "Bidder 7••41". Stable for a given
 * bidder and lot, different across lots, and not reversible to the user id.
 *
 * @param bidderId - The bidder's user id
 * @param lotId - The lot
 * @param salt - Server-side salt
 * @returns The label
 */
export function maskedBidderLabel(
  bidderId: string,
  lotId: string,
  salt: string
): string {
  const digits = String(
    hashText(`${salt}:${lotId}:${bidderId}`) % 1000
  ).padStart(3, "0");
  return `Bidder ${digits[0]}••${digits.slice(1)}`;
}

/** Validator for one row of the public bid history. */
const BidHistoryRowValidator = v.object({
  _id: v.id("bids"),
  amount: v.number(),
  timestamp: v.number(),
  /** "You" for the caller's own bids, otherwise a masked label. */
  label: v.string(),
  isMine: v.boolean(),
});

/**
 * Whether anyone may see a lot's bids.
 *
 * @param lot - The lot, or null
 * @returns True for a public lot
 */
function isPublicLot(lot: Doc<"lots"> | null): lot is Doc<"lots"> {
  return lot !== null && PUBLIC_STATUSES.includes(lot.status);
}

/**
 * Public: the newest bids on a lot with masked bidder labels, "You" for the
 * caller's own bids, and the total count. Bounded to
 * {@link LOT_BID_HISTORY_LIMIT} rows. Bidder ids and names are never returned.
 *
 * @param ctx - Query context
 * @param args - Query arguments
 * @param args.lotId - The lot
 * @returns Recent bids and the total number of bids
 */
export async function getLotBidHistoryHandler(
  ctx: QueryCtx,
  args: { lotId: Id<"lots"> }
) {
  const lot = await ctx.db.get("lots", args.lotId);
  if (!isPublicLot(lot)) return { bids: [], total: 0 };

  const authUser = await getAuthUser(ctx);
  const myId = authUser ? resolveUserId(authUser) : null;
  const salt = process.env.BIDDER_LABEL_SALT ?? "agribid-bidder-label";

  const rows = await ctx.db
    .query("bids")
    .withIndex("by_lot", (q) => q.eq("lotId", args.lotId))
    .order("desc")
    .take(LOT_BID_HISTORY_LIMIT * 2);
  const valid = rows
    .filter((bid) => bid.status !== "voided")
    .slice(0, LOT_BID_HISTORY_LIMIT);

  return {
    bids: valid.map((bid) => {
      const isMine = myId !== null && bid.bidderId === myId;
      return {
        _id: bid._id,
        amount: bid.amount,
        timestamp: bid.timestamp,
        label: isMine ? "You" : maskedBidderLabel(bid.bidderId, lot._id, salt),
        isMine,
      };
    }),
    total: await getBidCount(ctx, lot._id),
  };
}

/** Public query: masked bid history for the lot page. */
export const getLotBidHistory = query({
  args: { lotId: v.id("lots") },
  returns: v.object({
    bids: v.array(BidHistoryRowValidator),
    total: v.number(),
  }),
  handler: getLotBidHistoryHandler,
});

/**
 * The caller's position on a lot: `leading` when their bid is the highest,
 * `outbid` when they have bid but someone is higher, `none` otherwise (also
 * for signed-out callers).
 *
 * @param ctx - Query context
 * @param args - Query arguments
 * @param args.lotId - The lot
 * @returns The state and the caller's highest valid bid
 */
export async function getMyLotBidStateHandler(
  ctx: QueryCtx,
  args: { lotId: Id<"lots"> }
) {
  const none = { state: "none" as const, myHighest: null };
  const authUser = await getAuthUser(ctx);
  const myId = authUser ? resolveUserId(authUser) : null;
  if (myId === null) return none;

  const mine = await ctx.db
    .query("bids")
    .withIndex("by_bidder_lot", (q) =>
      q.eq("bidderId", myId).eq("lotId", args.lotId)
    )
    .take(MY_BIDS_READ_CAP);
  const myAmounts = mine
    .filter((bid) => bid.status !== "voided")
    .map((bid) => bid.amount);
  if (myAmounts.length === 0) return none;
  const myHighest = Math.max(...myAmounts);

  const top = await ctx.db
    .query("bids")
    .withIndex("by_lot_amount", (q) => q.eq("lotId", args.lotId))
    .order("desc")
    .filter((q) => q.neq(q.field("status"), "voided"))
    .first();
  const leading = top !== null && top.bidderId === myId;
  return {
    state: leading ? ("leading" as const) : ("outbid" as const),
    myHighest,
  };
}

/** Authed query: is the caller leading or outbid on this lot. */
export const getMyLotBidState = query({
  args: { lotId: v.id("lots") },
  returns: v.object({
    state: v.union(
      v.literal("none"),
      v.literal("leading"),
      v.literal("outbid")
    ),
    myHighest: v.union(v.number(), v.null()),
  }),
  handler: getMyLotBidStateHandler,
});

/** A neighbouring lot in the same sale. */
const NeighbourValidator = v.union(
  v.null(),
  v.object({ _id: v.id("lots"), lotNumber: v.number() })
);

/**
 * Public: the lots before and after this one in its sale (by lot number), for
 * the "‹ Lot 2 · Lot 4 ›" navigation. Hidden and non-public lots are skipped.
 *
 * @param ctx - Query context
 * @param args - Query arguments
 * @param args.lotId - The lot
 * @returns The previous and next lot, each null at the ends of the sale
 */
export async function getLotNeighboursHandler(
  ctx: QueryCtx,
  args: { lotId: Id<"lots"> }
) {
  const lot = await ctx.db.get("lots", args.lotId);
  const auctionId = lot?.auctionId;
  const lotNumber = lot?.lotNumber;
  if (!isPublicLot(lot) || auctionId === undefined || lotNumber === undefined) {
    return { prev: null, next: null };
  }

  const pick = async (direction: "prev" | "next") => {
    const rows = await ctx.db
      .query("lots")
      .withIndex("by_auctionId_lotNumber", (q) =>
        direction === "prev"
          ? q.eq("auctionId", auctionId).lt("lotNumber", lotNumber)
          : q.eq("auctionId", auctionId).gt("lotNumber", lotNumber)
      )
      .order(direction === "prev" ? "desc" : "asc")
      .take(10);
    const found = rows.find(
      (row) =>
        PUBLIC_STATUSES.includes(row.status) &&
        row.hiddenByFlags !== true &&
        row.lotNumber !== undefined
    );
    return found?.lotNumber !== undefined
      ? { _id: found._id, lotNumber: found.lotNumber }
      : null;
  };

  const [prev, next] = await Promise.all([pick("prev"), pick("next")]);
  return { prev, next };
}

/** Public query: previous and next lot of the sale. */
export const getLotNeighbours = query({
  args: { lotId: v.id("lots") },
  returns: v.object({ prev: NeighbourValidator, next: NeighbourValidator }),
  handler: getLotNeighboursHandler,
});
