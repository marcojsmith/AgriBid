// app/src/pages/Home.tsx
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { useSession } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { api } from "convex/_generated/api";
import { AuctionCard } from "../components/AuctionCard";
import { AuctionCardSkeleton } from "../components/AuctionCardSkeleton";
import { FilterSidebar } from "../components/FilterSidebar";
import { Link, useSearchParams } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingPage } from "../components/ui/LoadingIndicator";

/**
 * Custom hook to detect media query matches.
 * Initialises synchronously to avoid layout jumps.
 */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

/**
 * Render the AgriBid home page showing active auctions with a filter sidebar, mobile filter overlay, and view-mode controls.
 *
 * Reads URL query parameters to apply search and filter criteria, fetches matching active auctions, and displays loading,
 * empty, or results states. Supports toggling a persistent desktop sidebar, a mobile filter overlay, and compact/detailed
 * auction list layouts.
 *
 * @returns The Home page JSX element
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
  const searchQuery = searchParams.get("q") || undefined;
  const make = searchParams.get("make") || undefined;

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

  const auctions = useQuery(api.auctions.getActiveAuctions, {
    search: searchQuery,
    make,
    minYear,
    maxYear,
    minPrice,
    maxPrice,
    maxHours,
  });

  if (isPending) {
    return <LoadingPage message="Loading..." />;
  }

  const hasActiveFilters =
    make !== undefined ||
    minYear !== undefined ||
    maxYear !== undefined ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    maxHours !== undefined;

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Desktop Sidebar */}
      {isDesktopSidebarOpen && (
        <aside className="hidden lg:block w-80 shrink-0 sticky top-24 h-[calc(100vh-8rem)]">
          <FilterSidebar key={searchParams.toString()} />
        </aside>
      )}

      {/* Mobile Filter Overlay */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden animate-in fade-in duration-300">
          {/* Clickable Backdrop */}
          <button
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 w-full h-full cursor-default"
            onClick={() => setIsMobileFilterOpen(false)}
            aria-label="Close filters"
          />
          {/* Sidebar Container */}
          <div className="absolute inset-y-0 left-0 w-[280px] sm:w-80 z-20">
            <FilterSidebar
              key={searchParams.toString()}
              onClose={() => setIsMobileFilterOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-primary uppercase">
              {searchQuery ? `Results for "${searchQuery}"` : "Active Auctions"}
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
              onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
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
                onClick={() => setManualViewMode("detailed")}
                className="h-8 px-3 rounded-lg text-[10px] font-black uppercase"
              >
                Detailed
              </Button>
              <Button
                variant={viewMode === "compact" ? "default" : "ghost"}
                size="sm"
                onClick={() => setManualViewMode("compact")}
                className="h-8 px-3 rounded-lg text-[10px] font-black uppercase"
              >
                Compact
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => setIsMobileFilterOpen(true)}
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

        {!auctions ? (
          <div
            className={cn(
              "grid",
              viewMode === "compact"
                ? cn(
                    "grid-cols-1 gap-2 sm:gap-3",
                    isDesktopSidebarOpen
                      ? "md:grid-cols-2"
                      : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3",
                  )
                : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-8",
            )}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-full h-full",
                  viewMode === "compact" && "max-w-[500px]",
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
          <div
            className={cn(
              "grid",
              viewMode === "compact"
                ? cn(
                    "grid-cols-1 gap-2 sm:gap-3",
                    isDesktopSidebarOpen
                      ? "md:grid-cols-2"
                      : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3",
                  )
                : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-8",
            )}
          >
            {auctions.map((auction) => (
              <div
                key={auction._id}
                className={cn(
                  "w-full h-full",
                  viewMode === "compact" && "max-w-[500px]",
                )}
              >
                <AuctionCard auction={auction} viewMode={viewMode} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
