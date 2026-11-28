import { Eye } from "lucide-react";

import { formatRand } from "@/lib/currency";
import { cn } from "@/lib/utils";

import { LotChip } from "./LotChip";
import { PhotoFrame } from "./PhotoFrame";
import { ReservePill, type ReserveState } from "./ReservePill";
import { StatusPill, type LotOutcome } from "./StatusPill";
import { WatchButton } from "./WatchButton";

/**
 * The state of a lot card: `open` (no bids yet), `current-bid`, or a closed
 * outcome: `sold`, `not-sold`, `under-consideration`.
 */
export type LotCardState = "open" | "current-bid" | LotOutcome;

/** The lot facts a card shows. Plain data: pages map their Convex documents to this. */
export interface LotCardLot {
  /** Lot number, shown on the chip. */
  number: number | string;
  title: string;
  /** Link to the lot page. */
  href: string;
  /** Photo URL; a branded empty state shows when missing. */
  photoSrc?: string | null;
  year?: number | null;
  /** Hour-meter reading. Dropped when missing. */
  hours?: number | null;
  /** Town. */
  town?: string | null;
}

interface LotCardProps {
  lot: LotCardLot;
  state: LotCardState;
  /**
   * The figure for the state: the opening bid (open), the current bid, what
   * it sold for, the highest bid (not sold) or the top bid (under consideration).
   * Leave it out for a lot that closed with no bids: the card then shows only
   * its status, never an opening price as a "highest bid".
   */
  price?: number;
  /** Number of watchers (open) or bids (every other state). */
  count?: number;
  /** Reserve state for open and current-bid lots. No reserve pill is shown when missing, so a page never claims a state it does not know. */
  reserve?: ReserveState;
  /** The relative close line, e.g. "2d 3h". Shown as "Closes in 2d 3h" under the town. */
  closesIn?: string;
  /** Whether the viewer watches this lot (open and current-bid lots only). */
  watching?: boolean;
  /** Show the heart on closed lots too (a watchlist needs to drop them). */
  alwaysShowWatch?: boolean;
  /** Toggles the watch heart. The heart is hidden without it. */
  onToggleWatch?: () => void;
  className?: string;
}

const PRICE_LABEL: Record<LotCardState, string> = {
  open: "Opening bid",
  "current-bid": "Current bid",
  sold: "Sold for",
  "not-sold": "Highest bid",
  "under-consideration": "Top bid",
};

/**
 * Groups thousands with a no-break space, as `formatRand` does.
 *
 * @param n - A whole number
 * @returns The grouped digits
 */
function groupDigits(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * One lot in a grid or list, for Home, the sale page and "More in this
 * sale": a 4:3 photo with the lot chip and (on open lots) the watch heart, the
 * title (Lora 16, two lines, 40px reserved so prices align across a row),
 * year and hours then town, the reserve or outcome pill, and the price block
 * (label, 18px price, "n watching" or "n bids"). On desktop the price block is
 * one row with a top border.
 *
 * Plain props only; the page supplies the data and the watch handler.
 *
 * @param props - Component props
 * @param props.lot - The lot facts
 * @param props.state - open, current-bid, sold, not-sold or under-consideration
 * @param props.price - The figure for the state; left out for a lot that closed with no bids
 * @param props.count - Watchers (open) or bids (other states)
 * @param props.reserve - Reserve state for open and current-bid lots
 * @param props.closesIn - Relative close text, e.g. "2d 3h"
 * @param props.watching - Whether the viewer watches the lot
 * @param props.alwaysShowWatch - Show the heart on closed lots too
 * @param props.onToggleWatch - Toggles the heart
 * @param props.className - Extra classes merged onto the root element
 * @returns The lot card
 */
export function LotCard({
  lot,
  state,
  price,
  count,
  reserve,
  closesIn,
  watching = false,
  alwaysShowWatch = false,
  onToggleWatch,
  className,
}: LotCardProps) {
  const isOpen = state === "open" || state === "current-bid";
  const specs = [
    lot.year ? String(lot.year) : null,
    lot.hours ? `${groupDigits(lot.hours)} hrs` : null,
  ].filter((part): part is string => part !== null);
  // "0 watching" is noise: show nothing until someone watches. Bid counts
  // (closed states) keep their zero.
  const countText =
    count === undefined || (state === "open" && count === 0)
      ? null
      : state === "open"
        ? `${String(count)} watching`
        : `${String(count)} ${count === 1 ? "bid" : "bids"}`;

  return (
    <article
      data-slot="lot-card"
      data-state={state}
      className={cn("relative flex flex-col", className)}
    >
      <div aria-hidden="true">
        <PhotoFrame src={lot.photoSrc} alt="" ratio="4:3" />
      </div>
      <LotChip
        number={lot.number}
        overPhoto
        className="lg:top-2.5 lg:left-2.5"
      />
      {(isOpen || alwaysShowWatch) && onToggleWatch ? (
        <WatchButton
          watching={watching}
          onToggle={onToggleWatch}
          subject={`lot ${String(lot.number)}, ${lot.title}`}
          className="absolute top-0 right-0 z-[3] lg:top-1.5 lg:right-1.5"
        />
      ) : null}
      <div className="flex flex-1 flex-col">
        <h3 className="mt-2.5 mb-[3px] line-clamp-2 min-h-10 font-display text-base leading-tight font-semibold lg:mt-3.5 lg:min-h-0 lg:line-clamp-1 lg:text-[19px]">
          <a href={lot.href} className="after:absolute after:inset-0">
            {lot.title}
          </a>
        </h3>
        <p className="mb-1.5 min-h-10 text-sm leading-[1.35] text-muted-foreground lg:text-[15px]">
          {specs.length > 0 ? (
            <span className="num">
              {specs.join(" · ")}
              <br />
            </span>
          ) : null}
          {lot.town ?? <>&nbsp;</>}
          {closesIn ? (
            <>
              <br />
              Closes in {closesIn}
            </>
          ) : null}
        </p>
        {state === "open" || state === "current-bid" ? (
          reserve ? (
            <ReservePill size="card" state={reserve} />
          ) : null
        ) : (
          <StatusPill size="card" outcome={state} />
        )}
        {price === undefined ? null : (
          <p className="mt-auto flex flex-col pt-2 leading-tight lg:mt-3 lg:flex-row lg:items-baseline lg:gap-3.5 lg:border-t lg:border-border lg:pt-3">
            <span className="text-sm text-muted-foreground">
              {PRICE_LABEL[state]}
            </span>
            <strong className="num text-lg font-bold lg:text-xl">
              {formatRand(price)}
            </strong>
            {countText ? (
              <span className="num mt-px flex items-center gap-[5px] text-sm text-muted-foreground lg:mt-0 lg:ml-auto">
                {state === "open" ? (
                  <Eye aria-hidden="true" className="size-[15px]" />
                ) : null}
                {countText}
              </span>
            ) : null}
          </p>
        )}
      </div>
    </article>
  );
}
