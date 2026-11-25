/**
 * Admin side of won-lot payments: the queue and the manual "payment received"
 * step. Queries return no decrypted PII; the buyer is shown by the plain
 * display name the admin deposits page already uses.
 */

import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import { mutation, query } from "../_generated/server";
import { logAudit } from "../admin_utils";
import { requireAdmin } from "../lib/auth";
import { notifyUser } from "../lib/notify";
import { pushLotsWon } from "../lib/pushToUser";

const statusValidator = v.union(
  v.literal("awaiting"),
  v.literal("paid_claimed"),
  v.literal("confirmed")
);

/** One payment in the admin queue. */
const PaymentRowValidator = v.object({
  paymentId: v.id("lotPayments"),
  lotId: v.id("lots"),
  lotTitle: v.string(),
  lotNumber: v.optional(v.number()),
  buyerId: v.string(),
  buyerName: v.optional(v.string()),
  reference: v.string(),
  status: statusValidator,
  total: v.number(),
  depositCredit: v.number(),
  amountDue: v.number(),
  payBy: v.number(),
  paidClaimedAt: v.optional(v.number()),
  confirmedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * Admin: lot payments, newest activity first, optionally one status.
 */
export const listLotPayments = query({
  args: {
    status: v.optional(statusValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(PaymentRowValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { status } = args;
    const result =
      status === undefined
        ? await ctx.db
            .query("lotPayments")
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("lotPayments")
            .withIndex("by_status_and_updatedAt", (q) => q.eq("status", status))
            .order("desc")
            .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map(async (payment) => {
        const [lot, buyer] = await Promise.all([
          ctx.db.get("lots", payment.lotId),
          ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", payment.buyerId))
            .unique(),
        ]);
        return {
          paymentId: payment._id,
          lotId: payment.lotId,
          lotTitle: lot?.title ?? "Unknown lot",
          lotNumber: lot?.lotNumber,
          buyerId: payment.buyerId,
          buyerName: buyer?.name,
          reference: payment.reference,
          status: payment.status,
          total: payment.total,
          depositCredit: payment.depositCredit,
          amountDue: payment.amountDue,
          payBy: payment.payBy,
          paidClaimedAt: payment.paidClaimedAt,
          confirmedAt: payment.confirmedAt,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        };
      })
    );
    return { ...result, page };
  },
});

/**
 * Admin: the EFT arrived. Allowed from awaiting or paid_claimed; the buyer is
 * told their collection details are ready.
 */
export const confirmLotPayment = mutation({
  args: { paymentId: v.id("lotPayments") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const payment = await ctx.db.get("lotPayments", args.paymentId);
    if (!payment) throw new ConvexError("Payment not found.");
    if (payment.status === "confirmed") {
      throw new ConvexError("This payment is already confirmed.");
    }

    const lot = await ctx.db.get("lots", payment.lotId);
    const now = Date.now();
    await ctx.db.patch("lotPayments", payment._id, {
      status: "confirmed",
      confirmedAt: now,
      confirmedBy: admin.userId ?? admin._id,
      updatedAt: now,
    });
    const label =
      lot?.lotNumber === undefined
        ? "your lot"
        : `Lot ${String(lot.lotNumber)}`;
    const message = `Payment received for ${label}. Collection details are in My bids.`;
    await notifyUser(ctx, {
      recipientId: payment.buyerId,
      type: "success",
      title: "Payment received",
      message,
      link: "/dashboard/bids",
    });
    await pushLotsWon(ctx, payment.buyerId, {
      title: "Payment received",
      body: message,
      url: "/dashboard/bids",
      tag: `paid-${payment.lotId}`,
    });
    await logAudit(ctx, {
      action: "LOT_PAYMENT_CONFIRMED",
      targetId: payment.lotId,
      targetType: "lot",
      details: `${payment.reference}: ${String(payment.amountDue)} due, confirmed`,
    });
    return { success: true };
  },
});
