import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Truck } from "lucide-react";

import { PhotoFrame } from "@/components/ds/PhotoFrame";
import { TransportQuoteSheet } from "@/components/ds/TransportQuoteSheet";
import { Button } from "@/components/ui/button";
import { useTransportQuote } from "@/hooks/useTransportQuote";
import { formatRand } from "@/lib/currency";
import { formatSastDate } from "@/lib/dates";
import { lotMeta } from "@/lib/myBids";
import { cn } from "@/lib/utils";

import { CollectionCard } from "./CollectionCard";
import { PaySheet } from "./PaySheet";
import { RowBadge } from "./RowBadge";
import { Figure } from "./RowLayout";
import type { WonLotRow } from "./types";

type StepState = "done" | "current" | "todo";

/**
 * The Pay, We confirm, Collect steps of a won lot, each done, current or to do.
 *
 * @param props - Component props
 * @param props.row - The won lot
 * @returns The ordered list
 */
function PaySteps({ row }: { row: WonLotRow }) {
  const paidAt = row.paidClaimedAt ?? row.confirmedAt;
  const steps: { title: string; sub: string; state: StepState }[] = [
    {
      title: "Pay",
      sub:
        row.status === "awaiting" || paidAt === undefined
          ? `by ${formatSastDate(row.payBy)}`
          : formatSastDate(paidAt),
      state: row.status === "awaiting" ? "current" : "done",
    },
    {
      title: "We confirm",
      sub:
        row.status === "confirmed" && row.confirmedAt !== undefined
          ? `Received ${formatSastDate(row.confirmedAt)}`
          : "We notify you when we receive it",
      state:
        row.status === "confirmed"
          ? "done"
          : row.status === "paid_claimed"
            ? "current"
            : "todo",
    },
    {
      title: "Collect",
      sub: "within 7 days of payment",
      state: row.status === "confirmed" ? "current" : "todo",
    },
  ];
  return (
    <ol aria-label="Payment steps" className="space-y-2">
      {steps.map((step, index) => (
        <li
          key={step.title}
          aria-current={step.state === "current" ? "step" : undefined}
          className="flex items-start gap-3"
        >
          <span
            aria-hidden="true"
            className={cn(
              "num flex size-7 shrink-0 items-center justify-center rounded-sm text-sm font-semibold",
              step.state === "done" && "bg-ok-soft text-ok-fg",
              step.state === "current" && "bg-btn text-btn-foreground",
              step.state === "todo" && "bg-muted text-muted-foreground"
            )}
          >
            {step.state === "done" ? (
              <Check className="size-4" />
            ) : (
              String(index + 1)
            )}
          </span>
          <div>
            <p className="text-[15px] leading-tight font-semibold">
              {step.title}
              {step.state === "done" ? (
                <span className="sr-only"> (done)</span>
              ) : null}
            </p>
            <p className="text-sm text-muted-foreground">{step.sub}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The money lines of a won lot: the bid, the buyer's premium, VAT, the total,
 * the deposit counted once, and what is left to pay.
 *
 * @param props - Component props
 * @param props.row - The won lot
 * @returns The definition list
 */
function PaySummary({ row }: { row: WonLotRow }) {
  const lines = [
    { label: "Your bid", amount: formatRand(row.bid) },
    { label: "Buyer's premium", amount: formatRand(row.premium) },
    { label: "VAT", amount: formatRand(row.vat) },
    { label: "Total", amount: formatRand(row.total) },
    ...(row.depositCredit > 0
      ? [
          {
            label: "Deposit paid",
            amount: `−${formatRand(row.depositCredit)}`,
          },
        ]
      : []),
  ];
  return (
    <dl className="divide-y divide-border border-y border-border text-[15px]">
      {lines.map((line) => (
        <div
          key={line.label}
          className="flex items-baseline justify-between py-2"
        >
          <dt className="text-muted-foreground">{line.label}</dt>
          <dd className="num font-semibold">{line.amount}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between py-2.5">
        <dt className="font-bold">To pay</dt>
        <dd className="num text-xl font-bold">{formatRand(row.amountDue)}</dd>
      </div>
    </dl>
  );
}

/**
 * A lot the buyer won. Unpaid: the pay summary, the three steps, "Pay by EFT"
 * (the EFT sheet with "I've paid") and the line saying collection details
 * come once payment is confirmed. Paid: the bid and total paid, the steps and
 * the collection card. Every won lot offers "Request a transport quote".
 *
 * @param props - Component props
 * @param props.row - The row from `getMyWonLots`
 * @returns The row
 */
export function WonRow({ row }: { row: WonLotRow }) {
  const [payOpen, setPayOpen] = useState(false);
  const transport = useTransportQuote(row.lotId);
  const paid = row.status === "confirmed";
  const meta = lotMeta({
    _id: row.lotId,
    title: row.title,
    year: row.year,
    location: row.location,
  });
  const label = `${row.title}${row.lotNumber === undefined ? "" : ` · Lot ${String(row.lotNumber)}`}`;

  return (
    <article
      aria-label={row.title}
      data-slot="my-bids-row"
      data-status={row.status}
      className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-3 border-b border-border py-4 md:grid-cols-[168px_minmax(0,1fr)_190px] md:gap-x-6"
    >
      <Link
        to={`/auction/${row.lotId}`}
        tabIndex={-1}
        aria-hidden="true"
        className="block self-start md:row-span-2"
      >
        <PhotoFrame src={row.imageUrl} alt="" ratio="4:3" />
      </Link>
      <div className="min-w-0 md:col-start-2 md:row-start-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <RowBadge kind="won">{paid ? "Paid" : "Won"}</RowBadge>
          {row.lotNumber === undefined ? null : (
            <span className="num text-sm text-muted-foreground">
              Lot {row.lotNumber}
            </span>
          )}
        </div>
        <h3 className="mt-1 font-display text-base leading-tight font-semibold md:text-lg">
          <Link
            to={`/auction/${row.lotId}`}
            className="inline-flex min-h-11 items-center hover:underline"
          >
            {row.title}
          </Link>
        </h3>
        {meta ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{meta}</p>
        ) : null}
        {!paid && row.closedAt !== undefined ? (
          <p className="mt-2 text-[15px]">
            Closed {formatSastDate(row.closedAt)}
          </p>
        ) : null}
      </div>

      <div className="col-span-2 space-y-4 md:col-span-2 md:col-start-2 md:row-start-2">
        {paid ? (
          <>
            <div className="grid grid-cols-2 gap-x-3">
              <Figure label="Won at">{formatRand(row.bid)}</Figure>
              <Figure label="Paid">{formatRand(row.total)}</Figure>
            </div>
            {row.confirmedAt === undefined ? null : (
              <p className="text-[15px]">
                Payment received {formatSastDate(row.confirmedAt)}
              </p>
            )}
          </>
        ) : (
          <PaySummary row={row} />
        )}
        <PaySteps row={row} />
        {paid ? (
          <CollectionCard lotId={row.lotId} />
        ) : (
          <p className="text-[15px] text-muted-foreground">
            Collection details show once we confirm your payment.
          </p>
        )}
      </div>

      {row.status !== "confirmed" ? (
        <div className="col-span-2 md:col-span-1 md:col-start-3 md:row-start-1">
          <Button
            type="button"
            variant={row.status === "awaiting" ? "default" : "outline"}
            className="w-full"
            onClick={() => {
              setPayOpen(true);
            }}
          >
            {row.status === "awaiting" ? "Pay by EFT" : "Payment details"}
          </Button>
        </div>
      ) : null}

      <div className="col-span-2 md:col-span-2 md:col-start-2">
        <button
          type="button"
          onClick={() => {
            transport.setOpen(true);
          }}
          className="flex min-h-11 w-full items-center gap-2 border-t border-border text-left text-[15px] font-semibold"
        >
          <Truck aria-hidden="true" className="size-4" />
          <span className="flex-1">Request a transport quote</span>
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>

      <PaySheet
        open={payOpen}
        onOpenChange={setPayOpen}
        row={row}
        claimed={row.status === "paid_claimed"}
      />
      <TransportQuoteSheet
        {...transport.sheetProps}
        lot={{ label, place: row.location }}
      />
    </article>
  );
}
