// app/src/pages/Home.tsx
import { useEffect, useMemo } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import { EventsSection } from "@/components/home/EventsSection";
import { HomeHero } from "@/components/home/HomeHero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { LotBrowser } from "@/components/LotBrowser";
import { useNow } from "@/hooks/useNow";
import { getEventBucket } from "@/lib/auction-utils";
import {
  parseHomeSort,
  parseHomeView,
  selectEvents,
  type HomeSort,
  type HomeView,
} from "@/lib/homeEvents";
import {
  buildTitle,
  buildCanonical,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
} from "@/lib/seo";
import {
  PAGINATION_INITIAL_ITEMS,
  PAGINATION_LOAD_MORE_ITEMS,
} from "@/lib/constants";

/**
 * Render the AgriBid home page: a hero with the value proposition, the list of
 * auction events (Live & upcoming, Closing soon or Results, with a sort) and a
 * short "How AgriBid works". When a search query (`?q=`) is present, the global
 * lot-results view is rendered instead.
 *
 * The open and upcoming sales are always loaded (the hero photo and the first
 * two views use them); ended sales load only on the Results view. The view and
 * sort live in the URL (`?view=`, `?sort=`).
 *
 * @returns The JSX element for the Home page
 */
export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useNow();

  const rawQuery = searchParams.get("q");
  // Empty strings are treated as no search at all
  const searchQuery =
    rawQuery === null || rawQuery === "" ? undefined : rawQuery;
  const searching = searchQuery !== undefined;

  const view = parseHomeView(
    searchParams.get("view"),
    searchParams.get("status")
  );
  const sort = parseHomeSort(searchParams.get("sort"));

  // Each side is capped by the backend and paged with a manual cursor; this
  // hook consumes it with the standard load-more pattern.
  const active = usePaginatedQuery(
    api.auctions.getPublishedAuctions,
    searching ? "skip" : { status: "active" },
    { initialNumItems: PAGINATION_INITIAL_ITEMS }
  );
  const closed = usePaginatedQuery(
    api.auctions.getPublishedAuctions,
    searching || view !== "results" ? "skip" : { status: "closed" },
    { initialNumItems: PAGINATION_INITIAL_ITEMS }
  );

  // Closing soon and "Closing soonest" need every open sale: the backend pages
  // by start time, so the sales ending first can sit on a later page. Load all
  // pages (at most a few, the backend caps the list) before showing them.
  const loadAllOpen = view !== "results";
  useEffect(() => {
    if (loadAllOpen && active.status === "CanLoadMore") {
      active.loadMore(PAGINATION_LOAD_MORE_ITEMS);
    }
  }, [loadAllOpen, active]);

  const current = view === "results" ? closed : active;
  // A sale can stay `published` after its window ends (until it settles), so
  // Results also takes ended sales from the open query.
  const source = useMemo(() => {
    if (view !== "results") return active.results;
    const seen = new Set(closed.results.map((event) => event._id));
    return [
      ...closed.results,
      ...active.results.filter((event) => !seen.has(event._id)),
    ];
  }, [view, active.results, closed.results]);
  const shown = useMemo(
    () => selectEvents(source, view, sort, now),
    [source, view, sort, now]
  );
  const listStatus =
    loadAllOpen && active.status !== "Exhausted"
      ? "LoadingFirstPage"
      : current.status;
  const heroImage = active.results.find(
    (event) => getEventBucket(event, now) === "live"
  )?.leadImageUrls[0];

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("status"); // retired param; the view replaces it
    if (value === null) next.delete(key);
    else next.set(key, value);
    // Replace, so Back leaves Home instead of stepping through every view.
    setSearchParams(next, { replace: true });
  };
  const setView = (next: HomeView) => {
    updateParam("view", next === "live" ? null : next);
  };
  const setSort = (next: HomeSort) => {
    updateParam("sort", next === "soonest" ? null : next);
  };

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
      {searching ? (
        <div className="container mx-auto px-4 py-4 md:px-8 md:py-8">
          <LotBrowser />
        </div>
      ) : (
        <>
          <HomeHero imageUrl={heroImage} />
          <EventsSection
            events={shown}
            view={view}
            sort={sort}
            status={listStatus}
            onViewChange={setView}
            onSortChange={setSort}
            onLoadMore={() => {
              current.loadMore(PAGINATION_LOAD_MORE_ITEMS);
            }}
          />
          <HowItWorks />
        </>
      )}
    </>
  );
}
