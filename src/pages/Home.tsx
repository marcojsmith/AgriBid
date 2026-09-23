// app/src/pages/Home.tsx
import { useState, useEffect } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link, useSearchParams } from "react-router-dom";
import { Calendar, ChevronDown } from "lucide-react";
import { Helmet } from "react-helmet-async";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuctionEventCard } from "@/components/auction/AuctionEventCard";
import { LotBrowser } from "@/components/LotBrowser";
import {
  buildTitle,
  buildCanonical,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
} from "@/lib/seo";
import { LoadingPage, LoadingIndicator } from "@/components/LoadingIndicator";
import {
  PAGINATION_INITIAL_ITEMS,
  PAGINATION_LOAD_MORE_ITEMS,
} from "@/lib/constants";

/** Status tabs available for the auction-event listing. */
type StatusTab = "active" | "closed" | "all";

const isValidTab = (value: string | null): value is StatusTab => {
  return value === "active" || value === "closed" || value === "all";
};

/** Tab definitions rendered on the event-card view, in display order. */
const STATUS_TABS: readonly { value: StatusTab; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

/**
 * Render the AgriBid home page: a gallery of auction-event cards with
 * Active / Closed / All status tabs. When a search query (`?q=`) is present,
 * the global lot-results view is rendered instead.
 *
 * @returns The JSX element for the Home page
 */
export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawQuery = searchParams.get("q");
  // Empty strings are treated as no search at all
  const searchQuery =
    rawQuery === null || rawQuery === "" ? undefined : rawQuery;

  // The feed is a union of published + closed auction containers sorted by
  // startTime; the backend caps each side and pages with a manual cursor, and
  // this hook consumes it with the standard load-more pattern.
  const {
    results: events,
    status: eventsStatus,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getPublishedAuctions,
    searchQuery !== undefined ? "skip" : {},
    { initialNumItems: PAGINATION_INITIAL_ITEMS }
  );
  // Lazy initializer keeps this a pure read during render; refreshed on an
  // interval so events crossing startTime/endTime while the page stays
  // mounted still move between the Live Now badge and status tabs.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 30_000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const rawStatus = searchParams.get("status");
  const statusTab: StatusTab = isValidTab(rawStatus) ? rawStatus : "active";

  /**
   * Switch the status tab by writing the URL `status` param. The default
   * tab ("active") is stored as the absence of the param.
   *
   * @param tab - The tab to activate.
   */
  const setTab = (tab: StatusTab) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (tab === "active") {
      newParams.delete("status");
    } else {
      newParams.set("status", tab);
    }
    setSearchParams(newParams);
  };

  const visibleEvents = events.filter((event) => {
    const isActive = event.status === "published" && event.endTime > now;
    const isClosed = event.status === "closed" || event.endTime <= now;
    if (statusTab === "active") return isActive;
    if (statusTab === "closed") return isClosed;
    return true;
  });

  const emptyStateMessage =
    statusTab === "active"
      ? "No active auctions right now."
      : statusTab === "closed"
        ? "No closed auctions yet."
        : "No auction events have been published yet.";

  const pageTitle = buildTitle("Agricultural Equipment Auctions");
  const canonical = buildCanonical("/");

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={DEFAULT_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="robots" content="index, follow" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={DEFAULT_DESCRIPTION} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:url" content={canonical} />
      </Helmet>
      {searchQuery !== undefined ? (
        <LotBrowser />
      ) : (
        <div className="pb-12 space-y-6 md:space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-primary">
                Auctions
              </h1>
              <div
                className="flex gap-2 mt-3"
                role="group"
                aria-label="Auction status"
              >
                {STATUS_TABS.map((tab) => (
                  <Button
                    key={tab.value}
                    variant={statusTab === tab.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setTab(tab.value);
                    }}
                    aria-pressed={statusTab === tab.value}
                    data-testid={`status-tab-${tab.value}`}
                    className="rounded-md text-xs font-medium"
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                className="flex-1 md:flex-none font-medium h-10 px-6 rounded-md"
                asChild
              >
                <Link to="/auctions">All Auctions</Link>
              </Button>
              <Button
                className="flex-1 md:flex-none font-semibold h-10 px-6 rounded-md shadow-lg shadow-primary/20"
                asChild
              >
                <Link to="/sell">Sell</Link>
              </Button>
            </div>
          </div>

          {eventsStatus === "LoadingFirstPage" ? (
            <LoadingPage message="Loading auctions..." />
          ) : visibleEvents.length === 0 &&
            eventsStatus !== "CanLoadMore" &&
            eventsStatus !== "LoadingMore" ? (
            <Card className="border border-dashed">
              <div className="text-center py-20 space-y-4">
                <Calendar className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                <p className="text-muted-foreground font-bold">
                  {emptyStateMessage}
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-8">
              {visibleEvents.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleEvents.map((event) => (
                    <AuctionEventCard key={event._id} event={event} now={now} />
                  ))}
                </div>
              )}
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
      )}
    </>
  );
}
