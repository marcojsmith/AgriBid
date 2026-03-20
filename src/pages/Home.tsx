// app/src/pages/Home.tsx
import { useState } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, ChevronDown } from "lucide-react";

import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { AuctionCard } from "@/components/auction";
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
  const { isPending } = useSession();
  const [searchParams] = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false);

  // Track if user has manually toggled viewMode
  const [manualViewMode, setManualViewMode] = useState<
    "compact" | "detailed" | null
  >(null);

  // Derive viewMode from isMobile, but respect manual override
  const viewMode = manualViewMode ?? (isMobile ? "compact" : "detailed");

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
  const statusFilter = isValidStatus(rawStatus) ? rawStatus : "active";

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

  const hasActiveFilters =
    statusFilter !== "active" ||
    make !== undefined ||
    minYear !== undefined ||
    maxYear !== undefined ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    maxHours !== undefined;

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

  return (
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
          <FilterSidebar key={searchParams.toString()} />
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
              key={searchParams.toString()}
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
            <h2 className="text-3xl font-black tracking-tight text-primary uppercase">
              {searchQuery
                ? `Results for "${searchQuery}"`
                : statusFilter === "active"
                  ? "Active Auctions"
                  : statusFilter === "closed"
                    ? "Closed Auctions"
                    : "All Auctions"}
            </h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {searchQuery && (
                <Button
                  variant="link"
                  className="p-0 h-auto text-muted-foreground hover:text-primary font-bold uppercase text-[10px] tracking-widest"
                  asChild
                >
                  <Link to="/">Clear search results</Link>
                </Button>
              )}
              {hasActiveFilters && !searchQuery && (
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">
                  Filters Applied
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Sidebar Toggle (Desktop Only) */}
            <Button
              variant={isDesktopSidebarOpen ? "default" : "outline"}
              onClick={() => {
                setIsDesktopSidebarOpen(!isDesktopSidebarOpen);
              }}
              className="hidden lg:flex h-10 px-4 rounded-xl border-2 gap-2 font-bold uppercase text-xs"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {isDesktopSidebarOpen ? "Hide Filters" : "Show Filters"}
            </Button>

            {/* View Toggle */}
            <div className="flex bg-muted p-1 rounded-xl border shrink-0">
              <Button
                variant={viewMode === "detailed" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setManualViewMode("detailed");
                }}
                className="h-8 px-3 rounded-lg text-[10px] font-black uppercase"
              >
                Detailed
              </Button>
              <Button
                variant={viewMode === "compact" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setManualViewMode("compact");
                }}
                className="h-8 px-3 rounded-lg text-[10px] font-black uppercase"
              >
                Compact
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setIsMobileFilterOpen(true);
              }}
              className="lg:hidden h-10 w-10 p-0 rounded-xl border-2 flex items-center justify-center font-bold uppercase"
              aria-label="Filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>

            <Button
              className="flex-1 md:flex-none font-bold uppercase tracking-wider h-10 px-6 rounded-xl shadow-lg shadow-primary/20"
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
          <div className="text-center py-24 bg-card rounded-3xl border-2 border-dashed border-primary/10">
            <div className="text-5xl mb-4">🚜</div>
            <p className="text-muted-foreground font-bold uppercase tracking-widest mb-6 px-4">
              {searchQuery
                ? `No auctions found matching "${searchQuery}".`
                : "No auctions found matching your current filters."}
            </p>
            <Button
              asChild
              variant="outline"
              className="rounded-xl font-black px-8 border-2"
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
                  className="rounded-xl font-black px-12 border-2 gap-2 h-12 uppercase tracking-widest text-xs"
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
  );
}
