import { ConfirmBidSheet } from "@/components/ds/ConfirmBidSheet";
import { Button } from "@/components/ui/button";
import { useLotBid } from "@/hooks/useLotBid";
import { useNow } from "@/hooks/useNow";
import { formatRand } from "@/lib/currency";
import { formatSastDate } from "@/lib/dates";
import { confirmBreakdown } from "@/lib/lotPage";
import { bidRowBadge, rowClosesAt } from "@/lib/myBids";

import { ClosesLine } from "./ClosesLine";
import { RowBadge } from "./RowBadge";
import { Figure, RowLayout } from "./RowLayout";
import type { MyBidRow } from "./types";

interface BidRowProps {
  row: MyBidRow;
  /** The platform VAT rate (%); the bid button waits for it. */
  vatRatePct: number | undefined;
  /** False while the buyer's registration stops them bidding: no button. */
  canBid: boolean;
}

/**
 * The one-tap "Bid R x" button of an outbid row and the confirm sheet behind
 * it. It reuses the lot page's bid flow (`useLotBid`, `ConfirmBidSheet`,
 * `confirmBreakdown`), so totals, errors and toasts are the same.
 *
 * @param props - Component props
 * @param props.row - The outbid row
 * @param props.vatRatePct - VAT rate in percent
 * @returns The button and sheet
 */
function BidAction({
  row,
  vatRatePct,
}: {
  row: MyBidRow;
  vatRatePct: number | undefined;
}) {
  const bid = useLotBid({
    lotId: row._id,
    minimum: row.nextMinBid,
    window: row,
  });
  const breakdown = confirmBreakdown({
    bid: bid.amount,
    premiumFraction: row.buyerPremiumFraction,
    fixedFees: row.buyerFixedFees,
    vatRatePct: vatRatePct ?? 0,
    seller: row.sellerVatKind,
  });
  const lotLabel = `${row.title}${row.lotNumber === undefined ? "" : ` · Lot ${String(row.lotNumber)}`}`;
  return (
    <>
      <Button
        type="button"
        className="w-full"
        disabled={vatRatePct === undefined}
        onClick={() => {
          bid.startBid(row.nextMinBid);
        }}
      >
        Bid {formatRand(row.nextMinBid)}
      </Button>
      <ConfirmBidSheet
        open={bid.confirmOpen}
        onOpenChange={(open) => {
          if (!open) bid.closeConfirm();
        }}
        lotLabel={lotLabel}
        breakdown={breakdown}
        onConfirm={() => {
          void bid.confirm();
        }}
        onReviseBid={bid.reviseBid}
        busy={bid.busy}
        error={bid.error}
      />
    </>
  );
}

/**
 * A lot the buyer is bidding on: open for bids (Outbid, Leading or Extended)
 * or with the seller (Under consideration). An open lot shows the buyer's bid,
 * the current bid, the closing line and, when outbid, a one-tap "Bid R x" that
 * opens the confirm sheet. A lot with the seller shows the seller's deadline.
 *
 * @param props - Component props
 * @param props.row - The row from `getMyBidsOverview`
 * @param props.vatRatePct - VAT rate in percent
 * @param props.canBid - Whether the buyer may bid right now
 * @returns The row
 */
export function BidRow({ row, vatRatePct, canBid }: BidRowProps) {
  const now = useNow(5000);
  const badge = bidRowBadge(row, now);
  const lot = {
    ...row,
    photo: row.images.front,
  };

  if (badge === "consideration") {
    return (
      <RowLayout
        label={row.title}
        lot={lot}
        badge={<RowBadge kind="consideration">Under consideration</RowBadge>}
        figures={
          <>
            <Figure label="Your bid">{formatRand(row.myHighestBid)}</Figure>
            {row.isLeadingConsideration ? (
              <Figure label="Reserve">Not met</Figure>
            ) : (
              <Figure label="Top bid">{formatRand(row.currentPrice)}</Figure>
            )}
          </>
        }
        footer={
          <p className="text-[15px] text-muted-foreground">
            {row.isLeadingConsideration
              ? row.considerationDeadline === undefined
                ? "Your bid is with the seller. We'll notify you either way."
                : `Your bid is with the seller. They have until ${formatSastDate(row.considerationDeadline)} to accept. We'll notify you either way.`
              : "The seller is deciding on the top bid."}
          </p>
        }
      />
    );
  }

  const closesAt = rowClosesAt(row);
  return (
    <RowLayout
      label={row.title}
      lot={lot}
      badge={
        badge === "extended" ? (
          <RowBadge kind="extended">Extended +2 min</RowBadge>
        ) : badge === "leading" ? (
          <RowBadge kind="leading">Leading</RowBadge>
        ) : (
          <RowBadge kind="outbid">Outbid</RowBadge>
        )
      }
      figures={
        <>
          <Figure label="Your bid">{formatRand(row.myHighestBid)}</Figure>
          <Figure label="Current bid">{formatRand(row.currentPrice)}</Figure>
        </>
      }
      footer={
        <>
          {closesAt === undefined ? null : <ClosesLine closesAt={closesAt} />}
          {badge === "extended" ? (
            <p className="text-sm text-muted-foreground">
              A bid in the last 2 minutes added 2 minutes.
            </p>
          ) : null}
        </>
      }
      action={
        canBid &&
        !row.isWinning &&
        (closesAt === undefined || closesAt > now) ? (
          <BidAction row={row} vatRatePct={vatRatePct} />
        ) : null
      }
    />
  );
}
