import { LotCard } from "@/components/ds/LotCard";
import type { ReserveState } from "@/components/ds/ReservePill";
import { formatRemaining } from "@/lib/countdown";
import { cn } from "@/lib/utils";

/** One lot of the grid, as `getHomeLots` returns it. */
export interface HomeGridLot {
  _id: string;
  make: string;
  model: string;
  year: number;
  operatingHours: number;
  location: string;
  lotNumber?: number;
  startingPrice: number;
  currentPrice: number;
  hasReserve: boolean;
  reserveMet: boolean;
  watchers: number;
  bids: number;
  effectiveEndTime: number;
  leadImageUrl?: string;
}

interface HomeLotGridProps {
  lots: readonly HomeGridLot[];
  watchedIds: ReadonlySet<string>;
  onToggleWatch: (lotId: string) => void;
  /** Show "Closes in …" on each card (the multi-sale state). */
  showCloses: boolean;
  now: number;
  className?: string;
}

/**
 * Reserve state of a lot: none, or applies before any bid, then met or not met.
 *
 * @param lot - The grid lot
 * @returns The pill state
 */
function reserveOf(lot: HomeGridLot): ReserveState {
  if (!lot.hasReserve) return "none";
  if (lot.bids === 0) return "applies";
  return lot.reserveMet ? "met" : "not-met";
}

/**
 * The Home lot grid: two columns on phones, three from md, built from the
 * shared `LotCard` (lot chip, reserve pill, watching heart). A lot with bids
 * shows "Current bid" and its bid count, otherwise "Opening bid" and its
 * watchers. Prices align across a row.
 *
 * @param props - Component props
 * @param props.lots - The lots to show
 * @param props.watchedIds - Ids of the lots the viewer watches
 * @param props.onToggleWatch - Toggles a lot's heart
 * @param props.showCloses - Show "Closes in …" on each card
 * @param props.now - Current time (ms)
 * @param props.className - Extra classes merged onto the list
 * @returns The grid
 */
export function HomeLotGrid({
  lots,
  watchedIds,
  onToggleWatch,
  showCloses,
  now,
  className,
}: HomeLotGridProps) {
  return (
    <ul
      data-slot="home-lot-grid"
      className={cn(
        "grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-5 md:gap-y-8",
        className
      )}
    >
      {lots.map((lot) => {
        const hasBids = lot.bids > 0;
        const remaining = lot.effectiveEndTime - now;
        return (
          <li key={lot._id} className="flex">
            <LotCard
              className="w-full"
              lot={{
                number: lot.lotNumber ?? "–",
                title: `${lot.make} ${lot.model}`,
                href: `/auction/${lot._id}`,
                photoSrc: lot.leadImageUrl,
                year: lot.year,
                hours: lot.operatingHours,
                town: lot.location,
              }}
              state={hasBids ? "current-bid" : "open"}
              price={hasBids ? lot.currentPrice : lot.startingPrice}
              count={hasBids ? lot.bids : lot.watchers}
              reserve={reserveOf(lot)}
              closesIn={
                showCloses && remaining > 0
                  ? formatRemaining(remaining)
                  : undefined
              }
              watching={watchedIds.has(lot._id)}
              onToggleWatch={() => {
                onToggleWatch(lot._id);
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
