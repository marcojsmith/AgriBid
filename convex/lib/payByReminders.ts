import type { MutationCtx } from "../_generated/server";
import { formatNotificationRand, notifyUser } from "./notify";
import { formatPayBy } from "./lotPayments";
import { pushLotsWon } from "./pushToUser";

/** A reminder goes out once the pay-by deadline is within this window. */
export const PAY_BY_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Payments reminded per run; a full batch asks the cron wrapper to rerun. */
export const PAY_BY_REMINDER_BATCH = 100;

/**
 * Sends the "payment due tomorrow" reminder, once per payment: every
 * `awaiting` payment whose pay-by deadline is still ahead but within 24 hours
 * and that has no `reminderSentAt`. Writes the in-app notification always and
 * the push unless the buyer switched "Lots you win" off, then stamps
 * `reminderSentAt` so the reminder never repeats.
 *
 * Payments already past their deadline are not reminded ("due tomorrow" would
 * be wrong), and a buyer who claimed to have paid is left alone.
 *
 * @param ctx - Mutation context
 * @param now - Current time (ms)
 * @returns How many reminders were sent and whether more may remain
 */
export async function sendPayByRemindersHandler(
  ctx: MutationCtx,
  now: number
): Promise<{ sent: number; hasMore: boolean }> {
  const due = await ctx.db
    .query("lotPayments")
    .withIndex("by_status_and_reminderSentAt_and_payBy", (q) =>
      q
        .eq("status", "awaiting")
        .eq("reminderSentAt", undefined)
        .gt("payBy", now)
        .lte("payBy", now + PAY_BY_REMINDER_WINDOW_MS)
    )
    .take(PAY_BY_REMINDER_BATCH);

  for (const payment of due) {
    const lot = await ctx.db.get("lots", payment.lotId);
    const label =
      lot?.lotNumber === undefined
        ? "your lot"
        : `Lot ${String(lot.lotNumber)}`;
    const body = `Pay ${formatNotificationRand(payment.amountDue)} for ${label} by ${formatPayBy(payment.payBy)}.`;
    await ctx.db.patch("lotPayments", payment._id, {
      reminderSentAt: now,
      updatedAt: now,
    });
    // Nothing left to pay (the deposit covered it): only waiting for an admin
    // to confirm, so there is nothing to remind the buyer about.
    if (payment.amountDue <= 0) continue;
    await notifyUser(ctx, {
      recipientId: payment.buyerId,
      type: "warning",
      title: "Payment due tomorrow",
      message: body,
      link: "/dashboard/bids",
    });
    await pushLotsWon(ctx, payment.buyerId, {
      title: "Payment due tomorrow",
      body,
      url: "/dashboard/bids",
      tag: `payby-${payment.lotId}`,
    });
  }
  return {
    sent: due.length,
    hasMore: due.length >= PAY_BY_REMINDER_BATCH,
  };
}
