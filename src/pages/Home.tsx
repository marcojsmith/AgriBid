// app/src/pages/Home.tsx
import { useState, useRef, useLayoutEffect } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { Helmet } from "react-helmet-async";

import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { AuctionCard } from "@/components/auction/AuctionCard";
import {
  buildTitle,
  buildCanonical,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
} from "@/lib/seo";
import { AuctionCardSkeleton } from "@/components/AuctionCardSkeleton";
import { FilterSidebar } from "@/components/FilterSidebar";
import { cn } from "@/lib/utils";
import { LoadingPage, LoadingIndicator } from "@/components/LoadingIndicator";
import {
  PAGINATION_INITIAL_ITEMS,
  PAGINATION_LOAD_MORE_ITEMS,
} from "@/lib/constants";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * Render the AgriBid home page with auction listings, filter controls (desktop and mobile) and view-mode toggles.
 *
 * Reads URL query parameters to apply search and filter criteria, fetches matching auctions and watched IDs,
 * and displays loading, empty or results states while supporting desktop sidebar and mobile filter overlay interactions.
 *
 * @returns The JSX element for the Home page
 */
export default function Home() {
  const { data: session, isPending } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const preferences = useQuery(
    api.userPreferences.getMyPreferences,
    session ? {} : "skip"
  );
  const updateMyPreferences = useMutation(
    api.userPreferences.updateMyPreferences
  );

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false);

  // Track if user has manually toggled viewMode
  const [manualViewMode, setManualViewMode] = useState<
    "compact" | "detailed" | null
  >(null);
  const prefsAppliedRef = useRef<boolean | null>(null);

  // Apply saved preferences once when they arrive
  useLayoutEffect(() => {
    if (preferences && prefsAppliedRef.current == null) {
      prefsAppliedRef.current = true;
      if (preferences.viewMode != null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time initialization of view mode from saved user preferences
        setManualViewMode(preferences.viewMode);
      }
      if (preferences.sidebarOpen != null) {
        setIsDesktopSidebarOpen(preferences.sidebarOpen);
      }
    }
  }, [preferences]);

  // Derive viewMode from isMobile, but respect manual override and saved preferences
  const viewMode =
    manualViewMode ??
    (session
      ? (preferences?.viewMode ?? (isMobile ? "compact" : "detailed"))
      : isMobile
        ? "compact"
        : "detailed");

  // Extract filter params
  let searchQuery = searchParams.get("q") ?? undefined;
  let make = searchParams.get("make") ?? undefined;

  // Convert empty strings to undefined to avoid active filters
  searchQuery = searchQuery === "" ? undefined : searchQuery;
  make = make === "" ? undefined : make;

  const isValidStatus = (
    value: string | null
  ): value is "active" | "closed" | "all" => {
    return value === "active" || value === "closed" || value === "all";
  };

  const rawStatus = searchParams.get("status");
  // Apply saved status from preferences as default when no status in URL
  const statusFilter = isValidStatus(rawStatus)
    ? rawStatus
    : (preferences?.defaultStatusFilter ?? "active");

  const parseFiniteInt = (key: string) => {
    const val = searchParams.get(key);
    if (val === null) return undefined;
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const minYear = parseFiniteInt("minYear");
  const maxYear = parseFiniteInt("maxYear");
  const minPrice = parseFiniteInt("minPrice");
  const maxPrice = parseFiniteInt("maxPrice");
  const maxHours = parseFiniteInt("maxHours");

  const {
    results: auctions,
    status: auctionsStatus,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getActiveAuctions,
    {
      search: searchQuery,
      make,
      minYear,
      maxYear,
      minPrice,
      maxPrice,
      maxHours,
      statusFilter,
    },
    { initialNumItems: PAGINATION_INITIAL_ITEMS }
  );

  // Batch-fetch watched auction IDs to avoid per-card queries
  const watchedAuctionIds = useQuery(api.watchlist.getWatchedAuctionIds, {});

  if (isPending) {
    return <LoadingPage message="Loading..." />;
  }

  /**
   * A single removable filter chip shown below the page heading.
   */
  interface FilterChip {
    /** Stable identifier used for the chip's data-testid */
    key: string;
    /** Human-readable label, e.g. "Make: John Deere" */
    label: string;
    /** Search param keys deleted when the chip is dismissed */
    paramKeys: string[];
  }

  const formatRand = (value: number) => `R ${value.toLocaleString("en-ZA")}`;

  /**
   * Format a human-readable "X–Y" range label, falling back to
   * "from"/"up to" phrasing when only one bound is set.
   *
   * @param label - The chip category label, e.g. "Year" or "Price"
   * @param format - Formatter applied to each bound value
   * @param min - Optional lower bound of the range
   * @param max - Optional upper bound of the range
   * @returns The formatted range label
   */
  const formatRangeLabel = (
    label: string,
    format: (value: number) => string,
    min?: number,
    max?: number
  ): string => {
    if (min !== undefined && max !== undefined) {
      return `${label}: ${format(min)}\u2013${format(max)}`;
    }
    if (min !== undefined) {
      return `${label}: from ${format(min)}`;
    }
    if (max !== undefined) {
      return `${label}: up to ${format(max)}`;
    }
    return label;
  };

  const activeFilterChips: FilterChip[] = [];
  if (make !== undefined) {
    activeFilterChips.push({
      key: "make",
      label: `Make: ${make}`,
      paramKeys: ["make"],
    });
  }
  if (minYear !== undefined || maxYear !== undefined) {
    activeFilterChips.push({
      key: "year",
      label: formatRangeLabel(
        "Year",
        (value) => String(value),
        minYear,
        maxYear
      ),
      paramKeys: ["minYear", "maxYear"],
    });
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    activeFilterChips.push({
      key: "price",
      label: formatRangeLabel("Price", formatRand, minPrice, maxPrice),
      paramKeys: ["minPrice", "maxPrice"],
    });
  }
  if (maxHours !== undefined) {
    activeFilterChips.push({
      key: "hours",
      label: `Max Hours: ${maxHours.toLocaleString("en-ZA")}`,
      paramKeys: ["maxHours"],
    });
  }
  if (isValidStatus(rawStatus) && rawStatus !== "active") {
    activeFilterChips.push({
      key: "status",
      label: `Status: ${rawStatus === "closed" ? "Closed" : "All"}`,
      paramKeys: ["status"],
    });
  }

  const removeFilter = (paramKeys: string[]) => {
    const newParams = new URLSearchParams(searchParams.toString());
    paramKeys.forEach((key) => {
      newParams.delete(key);
    });
    setSearchParams(newParams);
  };

  const getGridClasses = (mode: "compact" | "detailed", sidebarOpen: boolean) =>
    cn(
      "grid",
      mode === "compact"
        ? cn(
            "grid-cols-1 gap-2 sm:gap-3",
            sidebarOpen ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"
          )
        : cn(
            "grid-cols-1 md:grid-cols-2",
            sidebarOpen ? "xl:grid-cols-3" : "xl:grid-cols-4",
            "gap-3 md:gap-8"
          )
    );

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
      <div className="flex flex-col lg:flex-row gap-8 pb-12">
        {/* Desktop Sidebar — animated slide in/out */}
        <aside
          data-testid="desktop-sidebar"
          className={cn(
            "hidden lg:block shrink-0 sticky top-24 h-[calc(100vh-8rem)] transition-[width,max-width,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden",
            isDesktopSidebarOpen ? "w-80 opacity-100" : "w-0 opacity-0"
          )}
        >
          <div className="h-full w-80">
            <FilterSidebar />
          </div>
        </aside>

        {/* Mobile Filter Overlay */}
        {isMobileFilterOpen && (
          <div
            data-testid="mobile-filter-overlay"
            className="fixed inset-0 z-[100] lg:hidden animate-in fade-in duration-300"
          >
            {/* Clickable Backdrop */}
            <button
              className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 w-full h-full cursor-default"
              onClick={() => {
                setIsMobileFilterOpen(false);
              }}
              aria-label="Close filters"
            />
            {/* Sidebar Container */}
            <div className="absolute inset-y-0 left-0 w-[280px] sm:w-80 z-20">
              <FilterSidebar
                onClose={() => {
                  setIsMobileFilterOpen(false);
                }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 space-y-6 md:space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-primary">
                {searchQuery
                  ? `Results for "${searchQuery}"`
                  : statusFilter === "active"
                    ? "Active Auctions"
                    : statusFilter === "closed"
                      ? "Closed Auctions"
                      : "All Auctions"}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2">
                {searchQuery && (
                  <Button
                    variant="link"
                    className="p-0 h-auto text-muted-foreground hover:text-primary font-medium text-xs"
                    asChild
                  >
                    <Link to="/">Clear search results</Link>
                  </Button>
                )}
                {activeFilterChips.length > 0 && (
                  <div
                    className="flex flex-wrap gap-2"
                    data-testid="active-filter-chips"
                  >
                    {activeFilterChips.map((chip) => (
                      <Button
                        key={chip.key}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          removeFilter(chip.paramKeys);
                        }}
                        className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground gap-1"
                        aria-label={`Remove filter: ${chip.label}`}
                        data-testid={`filter-chip-${chip.key}`}
                      >
                        {chip.label}
                        <X className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Sidebar Toggle (Desktop Only) */}
              <Button
                variant={isDesktopSidebarOpen ? "default" : "outline"}
                onClick={() => {
                  const next = !isDesktopSidebarOpen;
                  setIsDesktopSidebarOpen(next);
                  if (session) void updateMyPreferences({ sidebarOpen: next });
                }}
                className="hidden lg:flex h-10 px-4 rounded-md border gap-2 font-medium text-xs"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {isDesktopSidebarOpen ? "Hide Filters" : "Show Filters"}
              </Button>

              {/* View Toggle */}
              <div className="flex bg-muted p-1 rounded-md border shrink-0">
                <Button
                  variant={viewMode === "detailed" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setManualViewMode("detailed");
                    if (session)
                      void updateMyPreferences({ viewMode: "detailed" });
                  }}
                  className="h-8 px-3 rounded-md text-xs font-medium"
                >
                  Detailed
                </Button>
                <Button
                  variant={viewMode === "compact" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setManualViewMode("compact");
                    if (session)
                      void updateMyPreferences({ viewMode: "compact" });
                  }}
                  className="h-8 px-3 rounded-md text-xs font-medium"
                >
                  Compact
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setIsMobileFilterOpen(true);
                }}
                className="lg:hidden h-10 w-10 p-0 rounded-md border flex items-center justify-center font-medium"
                aria-label="Filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>

              <Button
                className="flex-1 md:flex-none font-semibold h-10 px-6 rounded-md shadow-lg shadow-primary/20"
                asChild
              >
                <Link to="/sell">Sell</Link>
              </Button>
            </div>
          </div>

          {auctionsStatus === "LoadingFirstPage" ? (
            <div
              className={cn(
                "transition-all duration-300",
                getGridClasses(viewMode, isDesktopSidebarOpen)
              )}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-full h-full transition-all duration-300",
                    viewMode === "compact" && "max-w-[500px]"
                  )}
                >
                  <AuctionCardSkeleton viewMode={viewMode} />
                </div>
              ))}
            </div>
          ) : auctions.length === 0 ? (
            <div className="text-center py-24 bg-card rounded-lg border border-dashed">
              <div className="text-5xl mb-4">🚜</div>
              <p className="text-muted-foreground font-medium mb-6 px-4">
                {searchQuery
                  ? `No auctions found matching "${searchQuery}".`
                  : "No auctions found matching your current filters."}
              </p>
              <Button
                asChild
                variant="outline"
                className="rounded-md font-medium px-8 border"
              >
                <Link to="/">Clear All Filters</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              <div
                className={cn(
                  "transition-all duration-300",
                  getGridClasses(viewMode, isDesktopSidebarOpen)
                )}
              >
                {auctions.map((auction) => (
                  <div
                    key={auction._id}
                    className={cn(
                      "w-full h-full transition-all duration-300",
                      viewMode === "compact" && "max-w-[500px]"
                    )}
                  >
                    <AuctionCard
                      auction={auction}
                      viewMode={viewMode}
                      isWatched={
                        watchedAuctionIds?.includes(auction._id) ?? false
                      }
                    />
                  </div>
                ))}
              </div>
              {auctionsStatus === "CanLoadMore" && (
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

              {auctionsStatus === "LoadingMore" && (
                <div className="flex justify-center py-8">
                  <LoadingIndicator />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
