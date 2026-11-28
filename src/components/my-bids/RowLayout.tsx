import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { PhotoFrame } from "@/components/ds/PhotoFrame";
import { lotMeta, type RowLot } from "@/lib/myBids";

interface RowLayoutProps {
  lot: RowLot;
  /** The pill (Outbid, Won, ...). */
  badge: ReactNode;
  /** The buyer's figures: two labelled amounts. */
  figures?: ReactNode;
  /** Text under the figures: closing time, notes. */
  footer?: ReactNode;
  /** The button or links at the bottom (right on desktop). */
  action?: ReactNode;
  /** The accessible name of the row. */
  label: string;
}

/**
 * The shared shape of a My bids row. Phone: a 96px photo beside the badge,
 * title and meta, then the figures, footer and action full width. From `md`:
 * a 168px photo, the details in the middle and the figures and action in a
 * right column.
 *
 * @param props - Component props
 * @param props.lot - The lot facts
 * @param props.badge - The pill beside the lot number
 * @param props.figures - Two labelled amounts
 * @param props.footer - Text under the figures
 * @param props.action - The button at the bottom
 * @param props.label - Accessible name of the row
 * @returns The row
 */
export function RowLayout({
  lot,
  badge,
  figures,
  footer,
  action,
  label,
}: RowLayoutProps) {
  const meta = lotMeta(lot);
  return (
    <article
      aria-label={label}
      data-slot="my-bids-row"
      className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-3 border-b border-border py-4 md:grid-cols-[168px_minmax(0,1fr)_190px] md:gap-x-6"
    >
      <Link
        to={`/auction/${lot._id}`}
        tabIndex={-1}
        aria-hidden="true"
        className="block self-start md:row-span-2"
      >
        <PhotoFrame src={lot.photo} alt="" ratio="4:3" />
      </Link>
      <div className="min-w-0 md:col-start-2 md:row-start-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {badge}
          {lot.lotNumber !== undefined ? (
            <span className="num text-sm text-muted-foreground">
              Lot {lot.lotNumber}
            </span>
          ) : null}
        </div>
        <h3 className="mt-1 font-display text-base leading-tight font-semibold md:text-lg">
          <Link
            to={`/auction/${lot._id}`}
            className="inline-flex min-h-11 items-center hover:underline"
          >
            {lot.title}
          </Link>
        </h3>
        {meta ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{meta}</p>
        ) : null}
      </div>
      {figures ? (
        <div className="col-span-2 grid grid-cols-2 gap-x-3 md:col-span-1 md:col-start-3 md:row-start-1 md:grid-cols-1 md:gap-y-2">
          {figures}
        </div>
      ) : null}
      {footer ? (
        <div className="col-span-2 space-y-1.5 md:col-span-1 md:col-start-2 md:row-start-2 md:self-end">
          {footer}
        </div>
      ) : null}
      {action ? (
        <div className="col-span-2 md:col-span-1 md:col-start-3 md:row-start-2 md:self-end">
          {action}
        </div>
      ) : null}
    </article>
  );
}

/**
 * One labelled amount: a 14px muted label over a bold figure.
 *
 * @param props - Component props
 * @param props.label - What the amount is ("Your bid")
 * @param props.children - The figure
 * @returns The block
 */
export function Figure({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="num text-xl leading-tight font-bold">{children}</p>
    </div>
  );
}
