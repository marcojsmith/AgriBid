/**
 * Won-lot payments, buyer and seller side. Every function needs a signed-in
 * user and only touches the caller's own data. Records are created by
 * settlement (`lib/lotPayments.createLotPayment`); the admin confirm step lives
 * in `admin/lotPayments.ts`.
 *
 * The seller's phone and collection address are decrypted for the winner only
 * after an admin has confirmed payment, and never appear in a public query.
 */

import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { logActivity } from "./userActivity";
import { resolveImageUrls } from "./auctions/helpers";
import { requireAuth, requireProfile, resolveUserId } from "./lib/auth";
import { decryptPII, encryptPII } from "./lib/encryption";
import { collectByFrom } from "./lib/lotPayments";

/** Longest accepted collection address. */
export const MAX_COLLECTION_ADDRESS_LENGTH = 300;

/** Payment rows read for the summary (a buyer has few open ones). */
const SUMMARY_READ_CAP = 100;

const paymentStatusValidator = v.union(
  v.literal("awaiting"),
  v.literal("paid_claimed"),
  v.literal("confirmed")
);

const SuccessValidator = v.object({ success: v.boolean() });

/** The buyer-visible payment fields (no `confirmedBy`). */
const paymentFields = {
  paymentId: v.id("lotPayments"),
  reference: v.string(),
  bid: v.number(),
  premium: v.number(),
  vat: v.number(),
  total: v.number(),
  depositCredit: v.number(),
  amountDue: v.number(),
  vatKind: v.union(v.literal("vat"), v.literal("private")),
  status: paymentStatusValidator,
  payBy: v.number(),
  paidClaimedAt: v.optional(v.number()),
  confirmedAt: v.optional(v.number()),
  /** Confirmation plus seven days; only when confirmed. */
  collectBy: v.optional(v.number()),
  createdAt: v.number(),
};

const WonLotValidator = v.object({
  lotId: v.id("lots"),
  title: v.string(),
  year: v.number(),
  location: v.string(),
  province: v.optional(v.string()),
  lotNumber: v.optional(v.number()),
  imageUrl: v.optional(v.string()),
  auctionTitle: v.optional(v.string()),
  /** When the lot closed (settled). */
  closedAt: v.optional(v.number()),
  ...paymentFields,
});

const WonLotPageValidator = v.object({
  page: v.array(WonLotValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
  pageStatus: v.optional(v.union(v.string(), v.null())),
  splitCursor: v.optional(v.union(v.string(), v.null())),
});

/**
 * The caller's user id, throwing when signed out.
 *
 * @param ctx - Query or mutation context
 * @returns The user id
 */
async function callerId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const authUser = await requireAuth(ctx);
  const userId = resolveUserId(authUser);
  if (!userId) throw new ConvexError("Not authenticated");
  return userId;
}

/**
 * The seller name winners see: the company name when set, otherwise the first
 * name and the surname's initial (`Thandi N.`).
 *
 * @param profile - The seller's profile
 * @returns The display name
 */
export async function sellerDisplayName(
  profile: Doc<"profiles"> | null
): Promise<string> {
  if (!profile) return "Seller";
  const company = profile.companyName?.trim();
  if (company) return company;
  const [first, last] = await Promise.all([
    decryptPII(profile.firstName),
    decryptPII(profile.lastName),
  ]);
  let firstName = first?.trim();
  let lastName = last?.trim();
  if (!firstName) {
    // No separate names: split the registration full name, else the display name.
    const parts = ((await decryptPII(profile.fullName)) ?? profile.name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    firstName = parts[0];
    lastName = parts.length > 1 ? parts[parts.length - 1] : undefined;
  }
  if (!firstName) return "Seller";
  const initial = lastName?.charAt(0).toUpperCase();
  return initial ? `${firstName} ${initial}.` : firstName;
}

/**
 * Buyer: the lots the caller won, newest first, each with its payment.
 */
export const getMyWonLots = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: WonLotPageValidator,
  handler: async (ctx, args) => {
    const userId = await callerId(ctx);
    const result = await ctx.db
      .query("lotPayments")
      .withIndex("by_buyerId_and_createdAt", (q) => q.eq("buyerId", userId))
      .order("desc")
      .paginate(args.paginationOpts);

    const rows = await Promise.all(
      result.page.map(async (payment) => {
        const lot = await ctx.db.get("lots", payment.lotId);
        if (!lot) return null;
        const [auction, images] = await Promise.all([
          lot.auctionId
            ? ctx.db.get("auctions", lot.auctionId)
            : Promise.resolve(null),
          resolveImageUrls(ctx.storage, lot.images, { limit: 0 }),
        ]);
        return {
          lotId: lot._id,
          title: lot.title,
          year: lot.year,
          location: lot.location,
          province: lot.province,
          lotNumber: lot.lotNumber,
          imageUrl: images.front,
          auctionTitle: auction?.title,
          closedAt: lot.settledAt,
          paymentId: payment._id,
          reference: payment.reference,
          bid: payment.bid,
          premium: payment.premium,
          vat: payment.vat,
          total: payment.total,
          depositCredit: payment.depositCredit,
          amountDue: payment.amountDue,
          vatKind: payment.vatKind,
          status: payment.status,
          payBy: payment.payBy,
          paidClaimedAt: payment.paidClaimedAt,
          confirmedAt: payment.confirmedAt,
          collectBy:
            payment.confirmedAt === undefined
              ? undefined
              : collectByFrom(payment.confirmedAt),
          createdAt: payment.createdAt,
        };
      })
    );
    return {
      ...result,
      page: rows.filter((row) => row !== null),
    };
  },
});

/**
 * Buyer: "I've paid". Moves an awaiting payment to `paid_claimed` so admins
 * see it in their queue. Safe to repeat; refused once confirmed.
 */
export const claimLotPaid = mutation({
  args: { lotId: v.id("lots") },
  returns: SuccessValidator,
  handler: async (ctx, args) => {
    const userId = await callerId(ctx);
    const payment = await ctx.db
      .query("lotPayments")
      .withIndex("by_lotId", (q) => q.eq("lotId", args.lotId))
      .first();
    // Same answer for "no such payment" and "someone else's": don't reveal it.
    if (payment?.buyerId !== userId) {
      throw new ConvexError("No payment found for this lot.");
    }
    if (payment.status === "paid_claimed") return { success: true };
    if (payment.status !== "awaiting") {
      throw new ConvexError("This payment is already confirmed.");
    }
    const now = Date.now();
    await ctx.db.patch("lotPayments", payment._id, {
      status: "paid_claimed",
      paidClaimedAt: now,
      updatedAt: now,
    });
    // The buyer's own activity feed, not the admin audit log (which would
    // record the buyer as an admin).
    await logActivity(ctx, {
      userId,
      type: "payment_claimed",
      description: `Marked ${payment.reference} as paid`,
      relatedId: payment.lotId,
    });
    return { success: true };
  },
});

/**
 * Buyer: how the caller collects a lot they won. Null unless the caller is the
 * payment's buyer and an admin has confirmed it, so the seller's phone and
 * address stay private until then.
 */
export const getMyCollectionDetails = query({
  args: { lotId: v.id("lots") },
  returns: v.union(
    v.null(),
    v.object({
      sellerName: v.string(),
      sellerPhone: v.union(v.string(), v.null()),
      collectionAddress: v.union(v.string(), v.null()),
      collectBy: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await callerId(ctx);
    const payment = await ctx.db
      .query("lotPayments")
      .withIndex("by_lotId", (q) => q.eq("lotId", args.lotId))
      .first();
    if (
      payment?.buyerId !== userId ||
      payment.status !== "confirmed" ||
      payment.confirmedAt === undefined
    ) {
      return null;
    }
    const seller = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", payment.sellerId))
      .unique();
    const [sellerName, sellerPhone, collectionAddress] = await Promise.all([
      sellerDisplayName(seller),
      decryptPII(seller?.phoneNumber),
      decryptPII(seller?.collectionAddress),
    ]);
    return {
      sellerName,
      sellerPhone: sellerPhone ?? null,
      collectionAddress: collectionAddress ?? null,
      collectBy: collectByFrom(payment.confirmedAt),
    };
  },
});

/**
 * Buyer: payment counts for the Account banner and the refund guard.
 * `unpaidCount` is awaiting plus paid_claimed; the "next" fields describe the
 * earliest awaiting payment only (a claimed one is waiting on an admin).
 */
export const getMyPaymentSummary = query({
  args: {},
  returns: v.object({
    /** Awaiting plus paid_claimed: every payment not yet confirmed. */
    unpaidCount: v.number(),
    awaitingCount: v.number(),
    claimedCount: v.number(),
    /** The next three are the earliest AWAITING payment (null when none). */
    nextPayBy: v.union(v.number(), v.null()),
    nextAmountDue: v.union(v.number(), v.null()),
    nextLotId: v.union(v.id("lots"), v.null()),
  }),
  handler: async (ctx) => {
    const userId = await callerId(ctx);
    const [awaiting, claimed] = await Promise.all(
      (["awaiting", "paid_claimed"] as const).map((status) =>
        ctx.db
          .query("lotPayments")
          .withIndex("by_buyerId_and_status", (q) =>
            q.eq("buyerId", userId).eq("status", status)
          )
          .take(SUMMARY_READ_CAP)
      )
    );
    const next = awaiting.reduce<Doc<"lotPayments"> | null>(
      (best, row) => (best === null || row.payBy < best.payBy ? row : best),
      null
    );
    return {
      unpaidCount: awaiting.length + claimed.length,
      awaitingCount: awaiting.length,
      claimedCount: claimed.length,
      nextPayBy: next?.payBy ?? null,
      nextAmountDue: next?.amountDue ?? null,
      nextLotId: next?.lotId ?? null,
    };
  },
});

/**
 * Seller: set or clear where winners collect lots. Trimmed, capped at 300
 * characters and encrypted at rest; an empty string clears it.
 */
export const updateMyCollectionAddress = mutation({
  args: { address: v.string() },
  returns: SuccessValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const address = args.address.trim();
    if (address.length > MAX_COLLECTION_ADDRESS_LENGTH) {
      throw new ConvexError(
        `The address can be at most ${String(MAX_COLLECTION_ADDRESS_LENGTH)} characters.`
      );
    }
    await ctx.db.patch("profiles", profile._id, {
      collectionAddress: address === "" ? undefined : await encryptPII(address),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Seller: the caller's own collection address, decrypted. Owner only.
 */
export const getMyCollectionAddress = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    return (await decryptPII(profile.collectionAddress)) ?? null;
  },
});
