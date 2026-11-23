import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface BackLinkProps {
  /** Where the link goes. */
  to: string;
  children: string;
  className?: string;
}

/**
 * The back link above a page: a chevron and the place it returns to, such as
 * "Year End Auction · 85 lots". 44px tall for a thumb.
 *
 * @param props - Component props
 * @param props.to - Link target
 * @param props.children - The label
 * @param props.className - Extra classes merged onto the link
 * @returns The link
 */
export function BackLink({ to, children, className }: BackLinkProps) {
  return (
    <Link
      data-slot="back-link"
      to={to}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 text-[15px] font-medium",
        className
      )}
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}

/** A neighbouring lot. */
export interface LotNavTarget {
  /** Link target of the lot. */
  to: string;
  /** The lot number. */
  number: number;
}

interface LotNavProps {
  prev: LotNavTarget | null;
  next: LotNavTarget | null;
  className?: string;
}

/**
 * Previous and next lot of the sale: "‹ Lot 2 · Lot 4 ›". An end of the sale
 * simply has no link on that side.
 *
 * @param props - Component props
 * @param props.prev - The lot before, or null
 * @param props.next - The lot after, or null
 * @param props.className - Extra classes merged onto the nav
 * @returns The nav, or null when there is nothing to link to
 */
export function LotNav({ prev, next, className }: LotNavProps) {
  if (!prev && !next) return null;
  return (
    <nav
      data-slot="lot-nav"
      aria-label="Lots in this sale"
      className={cn(
        "flex items-center gap-5 text-[15px] font-medium",
        className
      )}
    >
      {prev ? (
        <Link
          to={prev.to}
          className="inline-flex min-h-11 items-center gap-1"
          aria-label={`Previous lot, lot ${String(prev.number)}`}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Lot {prev.number}
        </Link>
      ) : null}
      {next ? (
        <Link
          to={next.to}
          className="inline-flex min-h-11 items-center gap-1"
          aria-label={`Next lot, lot ${String(next.number)}`}
        >
          Lot {next.number}
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
