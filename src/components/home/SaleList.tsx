import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { StatusBadge } from "@/components/ds/StatusBadge";
import { formatClosesIn } from "@/lib/countdown";
import { formatSastDate } from "@/lib/dates";
import { formatLotCount } from "@/lib/homeSales";
import { cn } from "@/lib/utils";

/** One live or upcoming sale in the list. */
export interface SaleListItem {
  _id: string;
  title: string;
  startTime: number;
  effectiveEndTime: number;
  lotCount: number;
  /** True when `lotCount` is a lower bound (the sale held more lots than were read). */
  lotCountCapped?: boolean;
  bucket: "live" | "upcoming";
}

interface SaleListProps {
  sales: readonly SaleListItem[];
  now: number;
  className?: string;
}

/**
 * The compact sale rows inside the multi-sale hero band (home-r8): status
 * pill, sale name, "Closes in 1d 3h · 5 lots" (upcoming: "Opens Wed 25 Nov,
 * 11:00 · 4 lots") and a chevron. Each row opens the sale. Meant for the dark
 * hero band; live sales come first, then upcoming ones.
 *
 * @param props - Component props
 * @param props.sales - The sales in display order
 * @param props.now - Current time (ms)
 * @param props.className - Extra classes merged onto the list
 * @returns The list
 */
export function SaleList({ sales, now, className }: SaleListProps) {
  return (
    <ul
      data-slot="sale-list"
      aria-label="Auctions"
      className={cn(
        "divide-y divide-hero-muted/30 border-y border-hero-muted/30",
        className
      )}
    >
      {sales.map((sale) => {
        const lots = formatLotCount(sale.lotCount, sale.lotCountCapped);
        return (
          <li key={sale._id}>
            <Link
              to={`/auctions/${sale._id}`}
              className="flex min-h-12 items-center gap-3 py-2.5"
            >
              {sale.bucket === "live" ? (
                <StatusBadge
                  variant="solid"
                  status={{ kind: "live" }}
                  className="w-20 shrink-0 justify-center"
                />
              ) : (
                <span
                  data-slot="status-badge"
                  data-tone="soon"
                  className="inline-flex w-20 shrink-0 items-center justify-center rounded-sm bg-soon-solid px-2 py-0.5 text-xs font-semibold text-white"
                >
                  Upcoming
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-hero-foreground">
                  {sale.title}
                </span>
                <span className="num block text-sm text-hero-muted">
                  {sale.bucket === "live"
                    ? `${formatClosesIn(sale.effectiveEndTime - now)} · ${lots}`
                    : `Opens ${formatSastDate(sale.startTime)} · ${lots}`}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-5 shrink-0 text-hero-muted"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
