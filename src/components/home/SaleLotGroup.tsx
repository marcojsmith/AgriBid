import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { HomeLotGrid } from "@/components/home/HomeLotGrid";
import { formatClosesIn } from "@/lib/countdown";
import { formatLotCount } from "@/lib/homeSales";

/** Lots shown per sale: 3 on desktop, the first 2 on phones. */
const LOTS_PER_GROUP = 3;

/** A live sale as the group needs it. */
export interface SaleLotGroupSale {
  _id: string;
  title: string;
  effectiveEndTime: number;
  lotCount: number;
  lotCountCapped?: boolean;
}

interface SaleLotGroupProps {
  sale: SaleLotGroupSale;
  now: number;
  watchedIds: ReadonlySet<string>;
  onToggleWatch: (lotId: string) => void;
}

/**
 * One sale's block in the multi-sale Home grid (home-r8): the sale name, its
 * close time and lot count, a "View all" link, then its first lots (3 on
 * desktop, 2 on phones). Lot numbers are per sale, so grouping keeps equal
 * numbers unambiguous. It loads its own lots, so a bid in one sale does not
 * re-run the others.
 *
 * @param props - Component props
 * @param props.sale - The live sale
 * @param props.now - Current time (ms)
 * @param props.watchedIds - Ids of the lots the viewer watches
 * @param props.onToggleWatch - Toggles a lot's heart
 * @returns The group, or null when the sale has no open lots
 */
export function SaleLotGroup({
  sale,
  now,
  watchedIds,
  onToggleWatch,
}: SaleLotGroupProps) {
  const home = useQuery(api.auctions.getHomeLots, {
    auctionIds: [sale._id as Id<"auctions">],
    limit: LOTS_PER_GROUP,
  });
  const lots = (home?.lots ?? []).filter((lot) => lot.effectiveEndTime > now);
  if (lots.length === 0) return null;
  return (
    <section
      aria-labelledby={`sale-group-${sale._id}`}
      className="border-b border-border py-6 first:pt-0 last:border-b-0 md:py-8"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id={`sale-group-${sale._id}`}
            className="font-display text-[22px] leading-tight font-semibold md:text-2xl"
          >
            {sale.title}
          </h2>
          <p className="num mt-1 text-sm text-muted-foreground">
            {formatClosesIn(sale.effectiveEndTime - now)} ·{" "}
            {formatLotCount(sale.lotCount, sale.lotCountCapped)}
          </p>
        </div>
        <Link
          to={`/auctions/${sale._id}`}
          className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-sm font-medium text-primary"
        >
          View all
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <HomeLotGrid
        lots={lots}
        watchedIds={watchedIds}
        onToggleWatch={onToggleWatch}
        showCloses={false}
        now={now}
        className="max-md:[&>*:nth-child(n+3)]:hidden"
      />
    </section>
  );
}
