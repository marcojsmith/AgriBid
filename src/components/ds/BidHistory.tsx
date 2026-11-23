import { formatRand } from "@/lib/currency";
import { formatBidTime } from "@/lib/lotPage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One bid as the lot page lists it. */
export interface BidHistoryRow {
  id: string;
  /** "Bidder 7••41", or "You" for the viewer's own bid. */
  label: string;
  amount: number;
  /** When the bid was placed (ms). */
  timestamp: number;
  isMine: boolean;
}

interface BidHistoryProps {
  rows: readonly BidHistoryRow[];
  /** Number of bids in all, which may be more than `rows`. */
  total: number;
  /** Current time (ms), for "2 min ago". */
  now: number;
  /** Rows shown before "Show all n bids". Default 3. */
  initialCount?: number;
  /** Whether every row is shown (controlled by the page). */
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * The bid history: the newest bids, masked bidder labels, amounts and times,
 * the viewer's own bids as "You" in bold, and "Show all n bids" when there
 * are more than `initialCount`. Empty: "No bids yet."
 *
 * @param props - Component props
 * @param props.rows - The newest bids first
 * @param props.total - Total number of bids
 * @param props.now - Current time (ms)
 * @param props.initialCount - Rows shown before expanding
 * @param props.expanded - Whether all rows are shown
 * @param props.onToggle - Expands or collapses
 * @param props.className - Extra classes merged onto the root element
 * @returns The list
 */
export function BidHistory({
  rows,
  total,
  now,
  initialCount = 3,
  expanded,
  onToggle,
  className,
}: BidHistoryProps) {
  if (rows.length === 0) {
    return (
      <p
        data-slot="bid-history"
        className={cn("text-muted-foreground", className)}
      >
        No bids yet.
      </p>
    );
  }
  const shown = expanded ? rows : rows.slice(0, initialCount);
  const canExpand = rows.length > initialCount;
  return (
    <div data-slot="bid-history" className={className}>
      <ul className="divide-y divide-border">
        {shown.map((row) => (
          <li
            key={row.id}
            className="flex items-baseline justify-between gap-3 py-2.5 text-[15px]"
          >
            <span className={cn(row.isMine && "font-bold")}>{row.label}</span>
            <span className="num font-bold">{formatRand(row.amount)}</span>
            <time
              dateTime={new Date(row.timestamp).toISOString()}
              className="w-28 text-right text-sm text-muted-foreground"
            >
              {formatBidTime(row.timestamp, now)}
            </time>
          </li>
        ))}
      </ul>
      {canExpand ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? "Show fewer bids" : `Show all ${String(total)} bids`}
        </Button>
      ) : null}
    </div>
  );
}
