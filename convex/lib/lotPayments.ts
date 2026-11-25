/**
 * Won-lot payment records: one `lotPayments` row per lot that sells with a
 * winner. Created in the same mutation that marks the lot sold, so a sold lot
 * always has exactly one record (lots sold before this shipped have none).
 */

import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getBuyerPremiumPct } from "../admin/platformSettings";
import { getVatRateHandler } from "../admin/settings";
import { activeBuyerFees } from "../auctions/helpers";
import { addBusinessDays } from "./businessDays";
import {
  calculateBuyerTotal,
  premiumFromRate,
  vatBaseForSeller,
} from "./buyerTotal";
import { percentToFraction, resolveBuyerPremium } from "./buyerPremium";
import { formatNotificationRand, notifyUser } from "./notify";
import { generateReference } from "./registration";
import { resolveLotSellerVat } from "./sellerVat";
import { isDemoBidder } from "./wbtImport";

/** Business days a buyer has to pay after the lot is sold. */
export const PAY_BY_BUSINESS_DAYS = 2;

/** Days after confirmation that the buyer has to collect the lot. */
export const COLLECT_WITHIN_DAYS = 7;

/** How many times a unique payment reference is retried before giving up. */
const REFERENCE_ATTEMPTS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Formats a deadline for a notification in SAST, e.g. `Thu 26 Nov, 11:00`.
 *
 * @param ms - Epoch milliseconds
 * @returns The text
 */
export function formatPayBy(ms: number): string {
  const d = new Date(ms + SAST_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${WEEKDAYS[d.getUTCDay()]} ${String(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}, ${hh}:${mm}`;
}

/**
 * The collect-by deadline of a confirmed payment.
 *
 * @param confirmedAt - When the payment was confirmed
 * @returns Epoch milliseconds
 */
export function collectByFrom(confirmedAt: number): number {
  return confirmedAt + COLLECT_WITHIN_DAYS * DAY_MS;
}

/**
 * Whether a payment or deposit reference is already used by either table, so
 * the two kinds of reference can never collide.
 *
 * @param ctx - Query or mutation context
 * @param reference - The candidate
 * @returns True when taken
 */
export async function isReferenceTaken(
  ctx: QueryCtx,
  reference: string
): Promise<boolean> {
  const [deposit, payment] = await Promise.all([
    ctx.db
      .query("registrationDeposits")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .first(),
    ctx.db
      .query("lotPayments")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .first(),
  ]);
  return deposit !== null || payment !== null;
}

/**
 * Generates a payment reference unique across deposits and lot payments.
 *
 * @param ctx - Query or mutation context
 * @param rand - Random source (injectable for tests)
 * @returns The reference
 * @throws ConvexError after five collisions
 */
export async function generateUniqueReference(
  ctx: QueryCtx,
  rand?: () => number
): Promise<string> {
  for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt++) {
    const reference = generateReference(rand);
    if (!(await isReferenceTaken(ctx, reference))) return reference;
  }
  throw new ConvexError("Couldn't create a payment reference. Try again.");
}

/**
 * The buyer's premium and fixed buyer fees for a lot, resolved the way the lot
 * page (`toLotDetail`) resolves them, so the payment equals what was promised.
 *
 * @param ctx - Query or mutation context
 * @param lot - The lot
 * @returns Premium fraction and fixed fees in rand
 */
export async function resolveLotBuyerFees(
  ctx: QueryCtx,
  lot: Doc<"lots">
): Promise<{ fraction: number; fixedFees: number }> {
  const premium = await resolveBuyerPremium(ctx, lot);
  const fees = await activeBuyerFees(ctx);
  const fraction =
    premium.rate ??
    fees.rowsFraction ??
    percentToFraction(await getBuyerPremiumPct(ctx));
  return { fraction, fixedFees: fees.fixedFees };
}

/**
 * Creates the payment record for a lot that was just sold to `winnerId`.
 * Idempotent: an existing record for the lot is returned untouched.
 *
 * Amounts use the lot-page maths (`calculateBuyerTotal`, whole rand). The
 * winner's received registration deposit is credited once, against their first
 * won lot. Notifies the winner.
 *
 * @param ctx - Mutation context
 * @param lot - The lot (any snapshot; only fee and seller fields are read)
 * @param winnerId - The winning buyer
 * @param bid - The hammer price
 * @param at - The sale time (settlement or accept time)
 * @returns The payment record, or null for a showcase demo bidder (the
 *   imported demo sales never produce real payments)
 */
export async function createLotPayment(
  ctx: MutationCtx,
  lot: Doc<"lots">,
  winnerId: string,
  bid: number,
  at: number
): Promise<Doc<"lotPayments"> | null> {
  if (isDemoBidder(winnerId)) return null;
  const existing = await ctx.db
    .query("lotPayments")
    .withIndex("by_lotId", (q) => q.eq("lotId", lot._id))
    .first();
  if (existing) return existing;

  const [sellerProfile, vatRate, buyerFees, reference] = await Promise.all([
    ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", lot.sellerId))
      .unique(),
    getVatRateHandler(ctx),
    resolveLotBuyerFees(ctx, lot),
    generateUniqueReference(ctx),
  ]);
  const { vatKind } = resolveLotSellerVat(lot, sellerProfile);
  const { premium, vat, total } = calculateBuyerTotal({
    bid,
    premium: premiumFromRate(bid, buyerFees.fraction) + buyerFees.fixedFees,
    vatRatePct: vatRate.vatRatePct,
    vatBase: vatBaseForSeller(vatKind),
  });

  const payBy = addBusinessDays(at, PAY_BY_BUSINESS_DAYS);

  const paymentId = await ctx.db.insert("lotPayments", {
    lotId: lot._id,
    buyerId: winnerId,
    sellerId: lot.sellerId,
    reference,
    bid: Math.round(bid),
    premium,
    vat,
    total,
    depositCredit: 0,
    amountDue: total,
    vatKind,
    status: "awaiting",
    payBy,
    createdAt: at,
    updatedAt: at,
  });
  // Credits the buyer's earliest awaiting payment (this one, unless an older
  // one is still waiting) when their deposit is received and not yet used.
  await applyDepositCredit(ctx, winnerId, at);
  const current = await ctx.db.get("lotPayments", paymentId);

  const label =
    lot.lotNumber === undefined
      ? lot.title
      : `Lot ${String(lot.lotNumber)} ${lot.title}`;
  await notifyUser(ctx, {
    recipientId: winnerId,
    type: "success",
    title: "You won this lot",
    message: `You won ${label}. Pay ${formatNotificationRand(current?.amountDue ?? total)} by ${formatPayBy(payBy)}.`,
    link: "/dashboard/bids",
  });

  const created = await ctx.db.get("lotPayments", paymentId);
  if (!created) throw new ConvexError("Couldn't create the payment record.");
  return created;
}

/**
 * Credits a buyer's received registration deposit, once, against their earliest
 * awaiting payment ("credited once, against the first won lot"). The credit is
 * `min(deposit, total)`; what is left over can still be refunded.
 *
 * Called when a payment is created and when an admin marks the deposit
 * received, so it works whichever happens first. Does nothing unless the
 * deposit is `received` and not yet credited, and the buyer has an awaiting
 * payment.
 *
 * @param ctx - Mutation context
 * @param buyerId - The buyer
 * @param at - Timestamp for the updates
 * @returns The payment that received the credit, or null
 */
export async function applyDepositCredit(
  ctx: MutationCtx,
  buyerId: string,
  at: number
): Promise<Doc<"lotPayments"> | null> {
  const deposit = await ctx.db
    .query("registrationDeposits")
    .withIndex("by_userId", (q) => q.eq("userId", buyerId))
    .unique();
  if (deposit?.status !== "received" || deposit.creditedLotId !== undefined) {
    return null;
  }
  const awaiting = await ctx.db
    .query("lotPayments")
    .withIndex("by_buyerId_and_status", (q) =>
      q.eq("buyerId", buyerId).eq("status", "awaiting")
    )
    .take(100);
  const target = awaiting.reduce<Doc<"lotPayments"> | null>(
    (best, row) =>
      best === null || row.createdAt < best.createdAt ? row : best,
    null
  );
  if (!target) return null;

  const credit = Math.max(
    0,
    Math.min(deposit.receivedAmount ?? deposit.amount, target.total)
  );
  await ctx.db.patch("lotPayments", target._id, {
    depositCredit: credit,
    amountDue: target.total - credit,
    updatedAt: at,
  });
  await ctx.db.patch("registrationDeposits", deposit._id, {
    creditedLotId: target.lotId,
    creditedAt: at,
    creditedAmount: credit,
    updatedAt: at,
  });
  return { ...target, depositCredit: credit, amountDue: target.total - credit };
}

/**
 * Clears the credited-lot fields on every deposit. For the dev seed clears that
 * delete all `lotPayments` rows, so no deposit is left pointing at a payment
 * that no longer exists.
 *
 * @param ctx - Mutation context
 */
export async function releaseAllDepositCredits(
  ctx: MutationCtx
): Promise<void> {
  // Dev-only clears: a bounded read is plenty (one deposit per user).
  const deposits = await ctx.db.query("registrationDeposits").take(5000);
  for (const deposit of deposits) {
    if (deposit.creditedLotId === undefined) continue;
    await ctx.db.patch("registrationDeposits", deposit._id, {
      creditedLotId: undefined,
      creditedAt: undefined,
      creditedAmount: undefined,
    });
  }
}

/**
 * Looks up a lot's payment record.
 *
 * @param ctx - Query or mutation context
 * @param lotId - The lot
 * @returns The record, or null
 */
export async function getLotPaymentByLot(
  ctx: QueryCtx,
  lotId: Id<"lots">
): Promise<Doc<"lotPayments"> | null> {
  return await ctx.db
    .query("lotPayments")
    .withIndex("by_lotId", (q) => q.eq("lotId", lotId))
    .first();
}
