// app/src/pages/AuctionGallery.tsx
import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Helmet } from "react-helmet-async";
import { Calendar, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingPage, LoadingIndicator } from "@/components/LoadingIndicator";
import { AuctionEventCard } from "@/components/auction/AuctionEventCard";
import { buildTitle, buildCanonical, DEFAULT_DESCRIPTION } from "@/lib/seo";
import {
  PAGINATION_INITIAL_ITEMS,
  PAGINATION_LOAD_MORE_ITEMS,
} from "@/lib/constants";

/**
 * Public gallery of past and present auction events (scheduled sale
 * containers), each shown as a banner-image card with its title and window.
 *
 * @returns The AuctionGallery page component.
 */
export default function AuctionGallery() {
  const {
    results: events,
    status: eventsStatus,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getPublishedAuctions,
    {},
    { initialNumItems: PAGINATION_INITIAL_ITEMS }
  );
  // Lazy initializer keeps this a pure read during render (the "Live Now"
  // badge doesn't need to tick live here; a page refresh is enough).
  const [now] = useState(() => Date.now());

  if (eventsStatus === "LoadingFirstPage") {
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
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <AuctionEventCard key={event._id} event={event} now={now} />
            ))}
          </div>
          {eventsStatus === "CanLoadMore" && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => {
                  loadMore(PAGINATION_LOAD_MORE_ITEMS);
                }}
                variant="outline"
                className="rounded-md font-medium px-12 border gap-2 h-12 text-xs"
              >
                Load More Auctions
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          )}
          {eventsStatus === "LoadingMore" && (
            <div className="flex justify-center py-8">
              <LoadingIndicator />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
