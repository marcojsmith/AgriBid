import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/ds/Countdown";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { useNow } from "@/hooks/useNow";
import { deriveDisplayStatus } from "@/lib/auction-badges";
import { getEventBucket } from "@/lib/auction-utils";
import { formatSastDate } from "@/lib/dates";

/** The part of a sale the header needs. */
export interface SaleHeaderAuction {
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  status: "draft" | "published" | "closed";
}

/**
 * Header of the auction event page: the status, the sale title, a one-line
 * summary of when bidding opens and the lots close (in SAST) and, while the
 * sale is upcoming or live, a countdown card. Internal states such as
 * "Published" are never shown.
 *
 * There is no "Remind me" action yet: nothing in the app can send a reminder
 * for an auction (see the WP5 follow-ups).
 *
 * @param props - Component props
 * @param props.auction - The sale to describe
 * @returns The header
 */
export function SaleHeader({ auction }: { auction: SaleHeaderAuction }) {
  const now = useNow();
  const bucket = getEventBucket(auction, now);
  const status =
    bucket === "closed"
      ? null
      : deriveDisplayStatus({
          startTime: auction.startTime,
          endTime: auction.endTime,
          now,
        });

  return (
    <header
      data-testid="auction-header"
      className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8"
    >
      <div className="min-w-0 space-y-2">
        {status ? (
          <StatusBadge status={status} variant="soft" />
        ) : (
          <Badge variant="passed">Closed</Badge>
        )}
        <h1 className="text-[28px] leading-tight lg:text-4xl">
          {auction.title}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {bucket === "closed"
            ? `Online auction · Sale closed ${formatSastDate(auction.endTime)}`
            : `Online auction · Opens ${formatSastDate(auction.startTime)} · Lots close from ${formatSastDate(auction.endTime)}`}
        </p>
        {auction.description ? (
          <p className="max-w-3xl text-[15px]">{auction.description}</p>
        ) : null}
      </div>

      {bucket === "closed" ? null : (
        <div
          data-testid="sale-countdown"
          className="shrink-0 rounded-md border border-border bg-card px-4 py-3 lg:min-w-60"
        >
          <p className="text-[13px] text-muted-foreground">
            {bucket === "upcoming" ? "Bidding opens in" : "First lot closes in"}
          </p>
          <Countdown
            endTime={
              bucket === "upcoming" ? auction.startTime : auction.endTime
            }
            className="text-2xl"
          />
        </div>
      )}
    </header>
  );
}
