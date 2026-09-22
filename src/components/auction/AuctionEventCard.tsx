// app/src/components/auction/AuctionEventCard.tsx
import { Link } from "react-router-dom";
import { Image as ImageIcon } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "convex/_generated/api";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * A published auction event as returned by `api.auctions.getPublishedAuctions`.
 */
export type AuctionEvent = FunctionReturnType<
  typeof api.auctions.getPublishedAuctions
>[number];

interface AuctionEventCardProps {
  /** The auction event document to render. */
  event: AuctionEvent;
  /** Current time (ms since epoch) used to decide whether the event is live. */
  now: number;
}

/**
 * Card for a published auction event (scheduled sale container) in a gallery
 * grid. Shows the banner image, title, description, date window, lot count and
 * a "Live Now" badge while the event's window is open, and links to the
 * container detail page.
 *
 * @param props - Component props.
 * @param props.event - The auction event document to render.
 * @param props.now - Current time (ms since epoch) used for the live badge.
 * @returns The rendered auction event card.
 */
export const AuctionEventCard = ({ event, now }: AuctionEventCardProps) => {
  const isLive =
    event.status === "published" &&
    event.startTime <= now &&
    now < event.endTime;

  return (
    <Link to={`/auctions/${event._id}`} className="block group">
      <Card className="overflow-hidden border hover:shadow-lg transition-shadow h-full">
        <div className="h-40 bg-muted relative">
          {event.bannerImageUrl ? (
            <img
              src={event.bannerImageUrl}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          {isLive && (
            <Badge className="absolute top-3 right-3 bg-success/90 text-success-foreground font-semibold animate-pulse">
              Live Now
            </Badge>
          )}
        </div>
        <div className="p-4 space-y-2">
          <h2 className="font-bold text-base leading-tight group-hover:text-primary transition-colors">
            {event.title}
          </h2>
          {event.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {event.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground font-medium pt-1">
            {new Date(event.startTime).toLocaleDateString()} –{" "}
            {new Date(event.endTime).toLocaleDateString()}
          </p>
          <p className="text-xs text-muted-foreground">
            {event.lotCount} lot{event.lotCount === 1 ? "" : "s"}
          </p>
        </div>
      </Card>
    </Link>
  );
};
