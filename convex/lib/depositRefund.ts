import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * How many of the buyer's newest non-voided bids are checked when asking
 * "are you leading a lot?". A buyer with more live bids than this is checked
 * on the newest ones only (a bid on a lot that is still open is among the
 * newest in practice, since lots close within days).
 */
export const LEADING_CHECK_BID_CAP = 200;

/** Payment rows read per status for the unpaid count (a buyer has few). */
export const UNPAID_READ_CAP = 100;

/**
 * What a deposit can still give back: what was received minus what a won lot's
 * payment already used. A legacy row that names a credited lot but has no
 * credited amount counts as fully used.
 *
 * @param deposit - The deposit row
 * @returns Rand that can be refunded (never negative)
 */
export function refundableRemainder(
  deposit: Pick<
    Doc<"registrationDeposits">,
    "amount" | "receivedAmount" | "creditedAmount" | "creditedLotId"
  >
): number {
  const received = deposit.receivedAmount ?? deposit.amount;
  const credited =
    deposit.creditedLotId === undefined
      ? 0
      : (deposit.creditedAmount ?? received);
  return Math.max(0, received - credited);
}

/**
 * Counts a buyer's won-lot payments that are not confirmed yet: awaiting plus
 * paid_claimed. The one place both the payment summary and the refund guard
 * read this from.
 *
 * @param ctx - Query or mutation context
 * @param userId - The buyer
 * @returns The awaiting payments (rows) and the paid_claimed payments (rows)
 */
export async function loadUnpaidPayments(
  ctx: QueryCtx,
  userId: string
): Promise<{
  awaiting: Doc<"lotPayments">[];
  claimed: Doc<"lotPayments">[];
}> {
  const [awaiting, claimed] = await Promise.all(
    (["awaiting", "paid_claimed"] as const).map((status) =>
      ctx.db
        .query("lotPayments")
        .withIndex("by_buyerId_and_status", (q) =>
          q.eq("buyerId", userId).eq("status", status)
        )
        .take(UNPAID_READ_CAP)
    )
  );
  return { awaiting, claimed };
}

/**
 * Whether the buyer currently leads a lot that is not decided yet: still open
 * for bidding (`assigned`) or closed below reserve and waiting for the seller
 * (`under_consideration`), with `winnerId` set to them. Reads at most
 * {@link LEADING_CHECK_BID_CAP} of their newest non-voided bids, via
 * `by_bidder_timestamp`, and checks each distinct lot once.
 *
 * @param ctx - Query or mutation context
 * @param userId - The buyer
 * @returns True when they lead an open lot
 */
export async function isLeadingOpenLot(
  ctx: QueryCtx,
  userId: string
): Promise<boolean> {
  const bids = await ctx.db
    .query("bids")
    .withIndex("by_bidder_timestamp", (q) => q.eq("bidderId", userId))
    .filter((q) => q.neq(q.field("status"), "voided"))
    .order("desc")
    .take(LEADING_CHECK_BID_CAP);
  const seen = new Set<string>();
  for (const bid of bids) {
    if (seen.has(bid.lotId)) continue;
    seen.add(bid.lotId);
    const lot = await ctx.db.get("lots", bid.lotId);
    if (
      (lot?.status === "assigned" || lot?.status === "under_consideration") &&
      lot.winnerId === userId
    ) {
      return true;
    }
  }
  return false;
}
