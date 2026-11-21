// app/src/components/auction/AuctionEventCard.tsx
import { Link } from "react-router-dom";
import { Clock, MapPin } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "convex/_generated/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ds/Countdown";
import { EventMosaic, type MosaicPhoto } from "@/components/ds/EventMosaic";
import { Money } from "@/components/ds/Money";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { useNow } from "@/hooks/useNow";
import { deriveDisplayStatus } from "@/lib/auction-badges";
import { getEventBucket } from "@/lib/auction-utils";
import { formatSastDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * A published auction event as returned by `api.auctions.getPublishedAuctions`
 * (one entry of the paginated result's `page`).
 */
export type AuctionEvent = FunctionReturnType<
  typeof api.auctions.getPublishedAuctions
>["page"][number];

interface AuctionEventCardProps {
  /** The auction event document to render. */
  event: AuctionEvent;
  /** The single featured card on desktop: photos about 2/3 wide, text centred beside them. */
  featured?: boolean;
  /** Heading element for the title; use `h2` when no section heading sits above. */
  headingLevel?: "h2" | "h3";
  className?: string;
}

/**
 * Card for an auction event (scheduled sale) on Home and the auction gallery.
 * Shows a 16:9 photo mosaic of the lead lots with the sale's status and a
 * countdown chip, then the title, a one-line summary, where the lots are, the
 * lot count and starting price, when the lots close and a "View lots" link.
 *
 * Uses `useNow` for status and countdown timing, so the parent does not need
 * to pass a timestamp or re-render on every tick.
 *
 * @param props - Component props.
 * @param props.event - The auction event document to render.
 * @param props.featured - Use the featured layout from `lg`.
 * @param props.headingLevel - Heading element for the title (default `h3`).
 * @param props.className - Extra classes merged onto the card (e.g. a side-by-side layout from `lg`).
 * @returns The rendered auction event card.
 */
export const AuctionEventCard = ({
  event,
  featured = false,
  headingLevel = "h3",
  className,
}: AuctionEventCardProps) => {
  const now = useNow();
  const bucket = getEventBucket(event, now);
  const Heading = headingLevel;

  const status =
    bucket === "closed"
      ? null
      : deriveDisplayStatus({
          startTime: event.startTime,
          endTime: event.effectiveEndTime,
          now,
        });
  const urgent = status?.kind === "closing-soon" && status.urgent;

  const photoUrls =
    event.leadImageUrls.length > 0
      ? event.leadImageUrls
      : event.bannerImageUrl
        ? [event.bannerImageUrl]
        : [];
  const photos: MosaicPhoto[] = photoUrls.map((src, index) => ({
    src,
    alt: `${event.title}, photo ${String(index + 1)}`,
  }));

  const lotLabel = `${String(event.lotCount)}${event.lotCountCapped ? "+" : ""} ${
    event.lotCount === 1 && !event.lotCountCapped ? "lot" : "lots"
  }`;
  const href = `/auctions/${event._id}`;

  return (
    <article
      data-slot="auction-event-card"
      className={cn(
        "flex flex-col overflow-hidden rounded-md border border-border bg-card",
        featured && "lg:grid lg:grid-cols-[2fr_1fr]",
        className
      )}
    >
      <div className="relative">
        <EventMosaic
          photos={photos}
          emptyAlt={`${event.title}: no photos yet`}
          className="rounded-none"
        />
        <div className="absolute left-2.5 top-2.5">
          {status ? (
            <StatusBadge status={status} />
          ) : (
            <Badge variant="passed">Closed</Badge>
          )}
        </div>
        {bucket !== "closed" && (
          <span
            className={cn(
              "absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-semibold",
              urgent
                ? "bg-urgent-solid text-white"
                : "bg-hero/85 text-hero-foreground"
            )}
          >
            <Clock aria-hidden="true" className="size-3.5" />
            {bucket === "live" ? (
              <>
                Closes in{" "}
                <Countdown
                  endTime={event.effectiveEndTime}
                  className="text-inherit"
                />
              </>
            ) : (
              <>
                Opens in{" "}
                <Countdown endTime={event.startTime} className="text-inherit" />
              </>
            )}
          </span>
        )}
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col gap-2 p-4",
          featured && "lg:justify-center lg:gap-3 lg:p-6"
        )}
      >
        <Heading className="text-[19px] leading-tight">
          <Link
            to={href}
            className="inline-block rounded-sm hover:text-primary max-md:-my-2.5 max-md:py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {event.title}
          </Link>
        </Heading>
        {event.description ? (
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {event.description}
          </p>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
          {event.location ? (
            <>
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span>{event.location}</span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span className="num">{lotLabel}</span>
          {bucket !== "closed" && typeof event.fromPrice === "number" ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                From{" "}
                <Money amount={event.fromPrice} className="text-foreground" />
              </span>
            </>
          ) : null}
        </p>
        <div
          className={cn(
            "mt-auto flex flex-col gap-2.5 border-t border-border pt-3 text-[13px] text-muted-foreground",
            featured && "lg:mt-2"
          )}
        >
          <span>
            {bucket === "closed"
              ? `Sale closed ${formatSastDate(event.effectiveEndTime)}`
              : `Lots close from ${formatSastDate(event.endTime)}`}
          </span>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link to={href} aria-label={`View lots: ${event.title}`}>
              View lots
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
};
