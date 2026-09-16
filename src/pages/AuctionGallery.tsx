// app/src/pages/AuctionGallery.tsx
import { useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "convex/_generated/api";
import { Helmet } from "react-helmet-async";
import { Calendar, Image as ImageIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingPage } from "@/components/LoadingIndicator";
import { buildTitle, buildCanonical, DEFAULT_DESCRIPTION } from "@/lib/seo";

/**
 * Public gallery of past and present auction events (scheduled sale
 * containers), each shown as a banner-image card with its title and window.
 *
 * @returns The AuctionGallery page component.
 */
export default function AuctionGallery() {
  const events = useQuery(api.auctions.getPublishedAuctions);
  // Lazy initializer keeps this a pure read during render (the "Live Now"
  // badge doesn't need to tick live here; a page refresh is enough).
  const [now] = useState(() => Date.now());

  if (events === undefined) {
    return <LoadingPage message="Loading auctions..." />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <Helmet>
        <title>{buildTitle("Auctions")}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <link rel="canonical" href={buildCanonical("/auctions")} />
      </Helmet>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          Auctions
        </h1>
        <p className="text-muted-foreground mt-1">
          Browse our scheduled and past equipment sales.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="border border-dashed">
          <div className="text-center py-20 space-y-4">
            <Calendar className="h-10 w-10 text-muted-foreground/20 mx-auto" />
            <p className="text-muted-foreground font-bold">
              No auction events have been published yet.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const isLive =
              event.status === "published" &&
              event.startTime <= now &&
              now < event.endTime;
            return (
              <Link
                key={event._id}
                to={`/auctions/${event._id}`}
                className="block group"
              >
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
          })}
        </div>
      )}
    </div>
  );
}
