import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";

import { Countdown } from "@/components/ds/Countdown";
import { Money } from "@/components/ds/Money";
import { PhotoFrame } from "@/components/ds/PhotoFrame";
import { SectionHeader } from "@/components/ds/SectionHeader";
import { selectOpenLots, type ClosingSoonLot } from "@/lib/closingSoon";
import { PROVINCE_LABELS } from "@/lib/provinces";
import { cn } from "@/lib/utils";

/**
 * Card width: 260px on phones, a third of the row at md and a quarter from lg
 * (the gap is 1rem from md). Cards never shrink, so more than fit simply scroll.
 */
const CARD_WIDTH =
  "w-[260px] shrink-0 md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]";

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
      className="flex gap-3 overflow-hidden md:gap-4"
    >
      {[0, 1, 2, 3].map((key) => (
        <div
          key={key}
          data-testid="closing-soon-skeleton"
          className={cn(CARD_WIDTH, "animate-pulse space-y-3")}
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
 * The title is the link; its `::after` stretches over the whole card, so the
 * tap target is the full card (far above 44px) and any tap opens the lot.
 *
 * @param props - Component props
 * @param props.lot - The lot to show
 * @returns The list item
 */
function ClosingSoonCard({ lot }: { lot: ClosingSoonLot }) {
  const name = `${String(lot.year)} ${lot.make} ${lot.model}`;
  const place = lot.province ? PROVINCE_LABELS[lot.province] : lot.location;
  const sale =
    lot.lotNumber === undefined
      ? lot.auctionTitle
      : `Lot ${String(lot.lotNumber)} · ${lot.auctionTitle}`;

  return (
    <li className={cn("relative snap-start space-y-2", CARD_WIDTH)}>
      {/* With a photo the image is decorative (the link names the lot); the
          empty state is announced, so it needs a name. */}
      <PhotoFrame
        src={lot.leadImageUrl}
        alt={lot.leadImageUrl ? "" : `${name}, no photo yet`}
      />
      <p className="truncate text-[13px] text-muted-foreground">{sale}</p>
      <h3 className="text-base leading-snug">
        <Link
          to={`/auction/${lot._id}`}
          className="block rounded-sm py-1.5 font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
 * phones, three cards in view at md and four from lg; more cards than fit
 * scroll sideways at every size. Shows a skeleton while loading and renders nothing when no lot
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
        // role="list" keeps list semantics in Safari, which drops them when
        // list-style is none.
        <ul
          role="list"
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 md:-mx-1 md:scroll-px-1 md:gap-4 md:px-1"
        >
          {open.map((lot) => (
            <ClosingSoonCard key={lot._id} lot={lot} />
          ))}
        </ul>
      )}
    </section>
  );
}
