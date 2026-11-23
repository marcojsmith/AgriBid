import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { PhotoFrame } from "@/components/ds/PhotoFrame";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { formatClosesIn } from "@/lib/countdown";
import { cn } from "@/lib/utils";

/** One live or upcoming sale in the list. */
export interface SaleListItem {
  _id: string;
  title: string;
  startTime: number;
  effectiveEndTime: number;
  lotCount: number;
  bucket: "live" | "upcoming";
  /** First lead photo of the sale, if any. */
  imageUrl?: string;
}

interface SaleListProps {
  sales: readonly SaleListItem[];
  now: number;
  className?: string;
}

/**
 * The multi-sale state of Home (two or more live or upcoming sales): one row
 * per sale with a photo, its status, title and "Closes in … · n lots". Each row
 * opens the sale. Live sales come first, then upcoming ones.
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
        "container mx-auto max-w-[1200px] divide-y divide-border px-4",
        className
      )}
    >
      {sales.map((sale) => {
        const lots = `${String(sale.lotCount)} ${sale.lotCount === 1 ? "lot" : "lots"}`;
        return (
          <li key={sale._id}>
            <Link
              to={`/auctions/${sale._id}`}
              className="flex items-center gap-3.5 py-3"
            >
              <div className="w-[88px] shrink-0 md:w-[120px]">
                <PhotoFrame src={sale.imageUrl} alt="" className="rounded-md" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <StatusBadge
                  variant="soft"
                  status={
                    sale.bucket === "live"
                      ? { kind: "live" }
                      : { kind: "opens", startTime: sale.startTime }
                  }
                />
                <p className="font-display text-lg leading-tight font-semibold">
                  {sale.title}
                </p>
                <p className="num text-sm text-muted-foreground">
                  {sale.bucket === "live"
                    ? `${formatClosesIn(sale.effectiveEndTime - now)} · ${lots}`
                    : lots}
                </p>
              </div>
              <ChevronRight
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
