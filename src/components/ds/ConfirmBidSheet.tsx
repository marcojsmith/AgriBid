import { Button } from "@/components/ui/button";
import { formatRand } from "@/lib/currency";
import { PAYMENT_WINDOW_HOURS } from "@/lib/auctionRules";
import type { BidError, ConfirmBreakdown } from "@/lib/lotPage";

import { Banner } from "./Banner";
import { BottomSheet } from "./BottomSheet";

interface ConfirmBidSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being bid on: "New Holland T6070 · Lot 3". */
  lotLabel: string;
  /** The maths of the bid. */
  breakdown: ConfirmBreakdown;
  /** Submits the bid. */
  onConfirm: () => void;
  /** Sets the bid to a new minimum after "someone bid before you". */
  onReviseBid: (amount: number) => void;
  /** True while the bid is being sent. */
  busy: boolean;
  /** Why the last attempt failed, if it did. */
  error: BidError | null;
}

/**
 * The confirm sheet shown before every bid: your bid, buyer's premium, VAT and
 * "If you win, you pay", the binding-bid line, then "Confirm bid R x" and
 * "Cancel". A failed attempt shows its reason above the buttons; when the
 * server named a new minimum (someone bid in the meantime, or the bid was too
 * low) the main button becomes "Bid R minimum" and updates the figures.
 *
 * @param props - Component props
 * @param props.open - Whether the sheet is open
 * @param props.onOpenChange - Called when the sheet asks to close
 * @param props.lotLabel - The lot being bid on
 * @param props.breakdown - Rows and total from `confirmBreakdown`
 * @param props.onConfirm - Submits the bid
 * @param props.onReviseBid - Re-prices the bid at a new minimum
 * @param props.busy - Whether the bid is being sent
 * @param props.error - The last failure, if any
 * @returns The sheet
 */
export function ConfirmBidSheet({
  open,
  onOpenChange,
  lotLabel,
  breakdown,
  onConfirm,
  onReviseBid,
  busy,
  error,
}: ConfirmBidSheetProps) {
  const bid = breakdown.rows[0]?.amount ?? 0;
  const newMinimum = error?.minimum;
  const blocked = error?.kind === "closed" || error?.kind === "unverified";
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm your bid"
      actions={
        <div className="flex w-full flex-col gap-2">
          {newMinimum !== undefined ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                onReviseBid(newMinimum);
              }}
            >
              Bid {formatRand(newMinimum)}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              disabled={busy || blocked}
              onClick={onConfirm}
            >
              {busy ? "Placing your bid…" : `Confirm bid ${formatRand(bid)}`}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
        </div>
      }
    >
      <p className="text-[15px] text-muted-foreground">{lotLabel}</p>
      <dl className="mt-3 divide-y divide-border border-y border-border text-[15px]">
        {breakdown.rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between py-2.5"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="num font-bold">{formatRand(row.amount)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between py-3">
          <dt className="font-bold">If you win, you pay</dt>
          <dd className="num text-xl font-bold">
            {formatRand(breakdown.total)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[15px] text-muted-foreground">
        Your bid is binding. If you win, pay by EFT within{" "}
        {PAYMENT_WINDOW_HOURS} hours.
      </p>
      {error ? (
        <Banner kind="warn" className="mt-3">
          {error.message}
        </Banner>
      ) : null}
    </BottomSheet>
  );
}
