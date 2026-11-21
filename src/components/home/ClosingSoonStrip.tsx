import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";

import { Countdown } from "@/components/ds/Countdown";
import { Money } from "@/components/ds/Money";
import { PhotoFrame } from "@/components/ds/PhotoFrame";
import { SectionHeader } from "@/components/ds/SectionHeader";
import { selectOpenLots, type ClosingSoonLot } from "@/lib/closingSoon";
import { PROVINCE_LABELS } from "@/lib/provinces";
import { cn } from "@/lib/utils";

/** Lots shown four-up on desktop; more than this scroll sideways instead. */
const DESKTOP_COLUMNS = 4;

/**
 * Placeholder cards shown while the lots load.
 *
 * @returns Pulsing card outlines in the strip's layout
 */
function StripSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading closing soon lots"
      className="flex gap-3 overflow-hidden md:grid md:grid-cols-4"
    >
      {[0, 1, 2, 3].map((key) => (
        <div
          key={key}
          data-testid="closing-soon-skeleton"
          className="w-[260px] shrink-0 animate-pulse space-y-3 md:w-auto"
        >
          <div className="aspect-[4/3] rounded-lg bg-muted" />
          <div className="h-4 w-1/2 rounded-sm bg-muted" />
          <div className="h-5 w-3/4 rounded-sm bg-muted" />
          <div className="h-5 w-1/3 rounded-sm bg-muted" />
        </div>
      ))}
    </div>
  );
}

/**
 * One lot card: photo, lot and sale, title, location, price and countdown.
 * The title is the link; it stretches over the whole card so any tap opens
 * the lot.
 *
 * @param props - Component props
 * @param props.lot - The lot to show
 * @param props.scrolls - Keep the fixed phone width on desktop too
 * @returns The list item
 */
function ClosingSoonCard({
  lot,
  scrolls,
}: {
  lot: ClosingSoonLot;
  scrolls: boolean;
}) {
  const name = `${String(lot.year)} ${lot.make} ${lot.model}`;
  const place = lot.province ? PROVINCE_LABELS[lot.province] : lot.location;
  const sale =
    lot.lotNumber === undefined
      ? lot.auctionTitle
      : `Lot ${String(lot.lotNumber)} · ${lot.auctionTitle}`;

  return (
    <li
      className={cn(
        "relative w-[260px] shrink-0 snap-start space-y-2",
        !scrolls && "md:w-auto"
      )}
    >
      <PhotoFrame src={lot.leadImageUrl} alt="" />
      <p className="truncate text-[13px] text-muted-foreground">{sale}</p>
      <h3 className="text-base leading-snug">
        <Link
          to={`/auction/${lot._id}`}
          className="flex min-h-11 items-center rounded-sm font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {name}
        </Link>
      </h3>
      <p className="flex items-center gap-1 text-[13px] text-muted-foreground">
        <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{place}</span>
      </p>
      <div className="flex items-end justify-between gap-2">
        <Money
          label={lot.hasBids ? "Current bid" : "Opening bid"}
          // First bid may equal the opening price, so `hasBids` (not a price
          // comparison) decides the label.
          amount={lot.hasBids ? lot.currentPrice : lot.startingPrice}
        />
        <span className="flex flex-col items-end">
          <span className="text-[13px] text-muted-foreground">Closes in</span>
          <Countdown endTime={lot.effectiveEndTime} />
        </span>
      </div>
    </li>
  );
}

interface ClosingSoonStripProps {
  /** Lots from the query; undefined while loading. */
  lots: readonly ClosingSoonLot[] | undefined;
  /** Current time in ms, used to drop lots that have ended. */
  now: number;
}

/**
 * Home "Closing in the next 24 hours" lot strip: a horizontal snap scroll on
 * phones and a four-up row on desktop (a sideways scroll when there are more
 * than four). Shows a skeleton while loading and renders nothing when no lot
 * is left to show.
 *
 * @param props - Component props
 * @param props.lots - Lots from `getClosingSoonLots`; undefined while loading
 * @param props.now - Current time in ms; lots ended before it are dropped
 * @returns The strip, or null when there is nothing to show
 */
export function ClosingSoonStrip({ lots, now }: ClosingSoonStripProps) {
  const open = lots === undefined ? undefined : selectOpenLots(lots, now);
  if (open?.length === 0) return null;
  const scrolls = (open?.length ?? 0) > DESKTOP_COLUMNS;

  return (
    <section
      aria-labelledby="closing-soon-title"
      aria-busy={open === undefined}
      data-slot="closing-soon"
      className="container mx-auto space-y-4 px-4 py-6 md:space-y-5 md:py-9"
    >
      <SectionHeader
        id="closing-soon-title"
        title="Closing in the next 24 hours"
      />
      {open === undefined ? (
        <StripSkeleton />
      ) : (
        <ul
          className={cn(
            "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2",
            scrolls
              ? "md:mx-0 md:px-0"
              : "md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0"
          )}
        >
          {open.map((lot) => (
            <ClosingSoonCard key={lot._id} lot={lot} scrolls={scrolls} />
          ))}
        </ul>
      )}
    </section>
  );
}
