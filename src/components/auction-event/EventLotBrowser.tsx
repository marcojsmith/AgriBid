import { useEffect, useMemo, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { AuctionCard } from "@/components/auction/AuctionCard";
import { AuctionCardSkeleton } from "@/components/AuctionCardSkeleton";
import { FilterSidebar } from "@/components/FilterSidebar";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterChips } from "@/components/ds/FilterChips";
import { SegmentedControl } from "@/components/ds/SegmentedControl";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSession } from "@/lib/auth-client";
import {
  PAGINATION_INITIAL_ITEMS,
  PAGINATION_LOAD_MORE_ITEMS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

import {
  buildFilterChips,
  EVENT_SORT_OPTIONS,
  parseEventFilters,
  parseEventSort,
  sortLots,
  type EventSort,
} from "./eventFilters";

/** Props for {@link EventLotBrowser}. */
export interface EventLotBrowserProps {
  /** The sale whose lots are listed. */
  auctionId: Id<"auctions">;
}

type ViewMode = "compact" | "detailed";

/** Lots requested per extra page while a non-lot-number sort loads the rest. */
const EVENT_SORT_LOAD_SIZE = 50;

const VIEW_OPTIONS = [
  { value: "detailed", label: "Detailed" },
  { value: "compact", label: "Compact" },
] as const;

interface SortSelectProps {
  value: EventSort;
  onChange: (value: EventSort) => void;
  className?: string;
}

/**
 * Native sort control: the picker is the platform's own, so it is accessible
 * and 44px tall on phones.
 *
 * @param props - Component props
 * @param props.value - The current sort
 * @param props.onChange - Called with the chosen sort
 * @param props.className - Extra classes merged onto the select
 * @returns The select
 */
function SortSelect({ value, onChange, className }: SortSelectProps) {
  return (
    <select
      aria-label="Sort lots"
      value={value}
      onChange={(e) => {
        const next = EVENT_SORT_OPTIONS.find((o) => o.value === e.target.value);
        if (next) onChange(next.value);
      }}
      className={cn(
        "min-h-11 rounded-md border border-border bg-card px-3 text-sm font-medium lg:min-h-9",
        className
      )}
    >
      {EVENT_SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * The lots of one auction event: a 260px filter sidebar and a lot grid on
 * desktop, a sticky "Filters (n)" / "Sort" bar with a filter sheet on phones.
 *
 * Filters and sort live in the URL. Lots arrive in lot-number order; the sort
 * control reorders the lots (loading the rest of the sale first for price and
 * closing-time sorts). "N lots" is the number of lots
 * listed (with a "+" while more can be loaded), so it always matches the grid.
 * Phones and tablets always use compact rows; the Detailed/Compact toggle is
 * desktop only.
 *
 * @param props - Component props
 * @param props.auctionId - The sale whose lots are listed
 * @returns The lot browser
 */
export function EventLotBrowser({ auctionId }: EventLotBrowserProps) {
  const { data: session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [manualViewMode, setManualViewMode] = useState<ViewMode | null>(null);

  const preferences = useQuery(
    api.userPreferences.getMyPreferences,
    session ? {} : "skip"
  );
  const updateMyPreferences = useMutation(
    api.userPreferences.updateMyPreferences
  );
  const watchedLotIds = useQuery(api.watchlist.getWatchedLotIds, {});
  const watchedIdSet = useMemo(
    () => new Set(watchedLotIds ?? []),
    [watchedLotIds]
  );

  const filters = parseEventFilters(searchParams);
  const sort = parseEventSort(searchParams);
  const chips = buildFilterChips(filters);

  const {
    results,
    status: queryStatus,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getActiveLots,
    { ...filters, statusFilter: "all", auctionId },
    { initialNumItems: PAGINATION_INITIAL_ITEMS }
  );

  const canLoadMore = queryStatus === "CanLoadMore";

  // A price or closing-time sort is only right across every lot, so load the
  // rest of the sale (the query caps it) before ordering; lot order streams.
  useEffect(() => {
    if (sort !== "lot" && canLoadMore) loadMore(EVENT_SORT_LOAD_SIZE);
  }, [sort, canLoadMore, loadMore]);

  const lots = useMemo(() => sortLots(results, sort), [results, sort]);
  const countLabel = `${String(lots.length)}${canLoadMore ? "+" : ""} ${
    lots.length === 1 && !canLoadMore ? "lot" : "lots"
  }`;

  const viewMode: ViewMode = isDesktop
    ? (manualViewMode ?? preferences?.viewMode ?? "detailed")
    : "compact";

  const updateParams = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    change(next);
    setSearchParams(next);
  };

  const setSort = (value: EventSort) => {
    updateParams((next) => {
      if (value === "lot") next.delete("sort");
      else next.set("sort", value);
    });
  };

  const removeChip = (key: string) => {
    const chip = chips.find((c) => c.key === key);
    if (!chip) return;
    updateParams((next) => {
      chip.paramKeys.forEach((param) => {
        next.delete(param);
      });
    });
  };

  const clearFilters = () => {
    updateParams((next) => {
      chips.forEach((chip) => {
        chip.paramKeys.forEach((param) => {
          next.delete(param);
        });
      });
    });
  };

  const chooseView = (mode: ViewMode) => {
    setManualViewMode(mode);
    if (session) void updateMyPreferences({ viewMode: mode });
  };

  const gridClasses =
    viewMode === "compact"
      ? "grid grid-cols-1 gap-3 lg:grid-cols-2"
      : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:grid-cols-2";

  return (
    <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* Only one FilterSidebar is ever mounted: each keeps its own draft and
          syncs the URL, so a hidden second copy would fight the visible one. */}
      {isDesktop ? (
        <aside
          data-testid="desktop-sidebar"
          aria-label="Filter lots"
          className="sticky top-20 max-h-[calc(100vh-6rem)]"
        >
          <FilterSidebar hideStatus applySavedDefaults={false} />
        </aside>
      ) : null}

      <section aria-labelledby="event-lots-heading" className="min-w-0">
        <h2 id="event-lots-heading" className="sr-only">
          Lots in this sale
        </h2>

        {/* Phone and tablet: sticky filter and sort bar. */}
        <div
          data-testid="mobile-filter-bar"
          className="sticky top-0 z-30 -mx-4 mb-3 flex gap-2 border-b border-border bg-background px-4 py-2 md:-mx-8 md:px-8 lg:hidden"
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 gap-2"
            onClick={() => {
              setIsSheetOpen(true);
            }}
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            Filters ({chips.length})
          </Button>
          <SortSelect value={sort} onChange={setSort} className="flex-1" />
        </div>

        {/* Desktop toolbar: count on the left, sort and view on the right. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="num text-[15px] font-semibold" data-testid="lot-count">
            {countLabel}
          </p>
          <div className="hidden items-center gap-3 lg:flex">
            <SortSelect value={sort} onChange={setSort} />
            <SegmentedControl
              ariaLabel="Lot layout"
              options={VIEW_OPTIONS}
              value={viewMode}
              onChange={chooseView}
            />
          </div>
        </div>

        <FilterChips
          filters={chips}
          onRemove={removeChip}
          onClear={clearFilters}
          className="mb-4"
        />

        {queryStatus === "LoadingFirstPage" ? (
          <div className={gridClasses} role="status" aria-label="Loading lots">
            {[0, 1, 2].map((key) => (
              <AuctionCardSkeleton key={key} viewMode={viewMode} />
            ))}
          </div>
        ) : lots.length === 0 ? (
          <div className="border-y border-border py-16 text-center">
            <p className="mb-4 font-medium text-muted-foreground">
              {chips.length > 0
                ? "No lots match these filters."
                : "There are no lots in this sale yet."}
            </p>
            {chips.length > 0 ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <ul role="list" className={gridClasses}>
              {lots.map((lot) => (
                <li key={lot._id} className="min-w-0">
                  <AuctionCard
                    auction={lot}
                    viewMode={viewMode}
                    isWatched={watchedIdSet.has(lot._id)}
                  />
                </li>
              ))}
            </ul>
            {canLoadMore ? (
              <div className="flex justify-center pt-6">
                <Button
                  variant="outline"
                  className="min-h-11 gap-2 px-10"
                  onClick={() => {
                    loadMore(PAGINATION_LOAD_MORE_ITEMS);
                  }}
                >
                  Load more lots
                  <ChevronDown aria-hidden="true" className="size-4" />
                </Button>
              </div>
            ) : null}
            {queryStatus === "LoadingMore" ? (
              <div className="flex justify-center py-6">
                <LoadingIndicator />
              </div>
            ) : null}
          </>
        )}
      </section>

      <Dialog open={isSheetOpen && !isDesktop} onOpenChange={setIsSheetOpen}>
        <DialogContent
          showCloseIcon={false}
          className="top-auto bottom-0 left-0 flex h-[85vh] max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-b-none rounded-t-md p-3 sm:max-w-none lg:hidden"
        >
          <DialogTitle className="sr-only">Filter lots</DialogTitle>
          <DialogDescription className="sr-only">
            Narrow the lots in this sale by make, year, price and hours.
          </DialogDescription>
          <div className="min-h-0 flex-1">
            {/* The sheet remounts on every open: merging saved defaults here
                would bring back filters the user already removed. */}
            <FilterSidebar
              hideStatus
              applySavedDefaults={false}
              onClose={() => {
                setIsSheetOpen(false);
              }}
            />
          </div>
          <Button
            className="min-h-11 w-full"
            onClick={() => {
              setIsSheetOpen(false);
            }}
          >
            Show {countLabel}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
