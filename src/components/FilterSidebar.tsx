import { Filter, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { FilterDefaultsActions } from "./filter-sidebar/FilterDefaultsActions";
import { HoursFilter } from "./filter-sidebar/HoursFilter";
import { MakeFilter } from "./filter-sidebar/MakeFilter";
import { PriceRangeFilter } from "./filter-sidebar/PriceRangeFilter";
import { StatusFilter } from "./filter-sidebar/StatusFilter";
import { YearRangeFilter } from "./filter-sidebar/YearRangeFilter";
import { useFilterSidebar } from "./filter-sidebar/useFilterSidebar";

/**
 * Props for the FilterSidebar component.
 */
interface FilterSidebarProps {
  /**
   * Callback invoked when the sidebar should close (used in mobile overlay).
   */
  onClose?: () => void;
  /**
   * Hides the auction status select and skips `status` in URL/preference
   * sync. Used on auction container pages where status is fixed.
   */
  hideStatus?: boolean;
}

/**
 * Sidebar component for filtering auctions.
 *
 * @param props - Component props.
 * @param props.onClose - Callback when the sidebar is closed.
 * @param props.hideStatus - When true, hides the status select and excludes
 *   status from URL and preference syncing.
 * @returns The rendered filter sidebar.
 */
export const FilterSidebar = ({
  onClose,
  hideStatus = false,
}: FilterSidebarProps) => {
  const {
    filters,
    activeMakes,
    hasFilters,
    isSignedIn,
    pendingDefaultsAction,
    updateParam,
    resetFilters,
    saveDefaults,
    clearDefaults,
  } = useFilterSidebar({ hideStatus, onClose });

  return (
    <div className="flex flex-col h-full bg-card border rounded-lg overflow-hidden shadow-sm animate-in slide-in-from-left-4 duration-300">
      <div className="p-4 border-b flex justify-between items-center bg-muted/30">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Filter Equipment</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={resetFilters}
            className="h-8 w-8 rounded-full"
            aria-label="Reset filters"
            disabled={!hasFilters}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
              aria-label="Close filters"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <MakeFilter
          makes={activeMakes}
          value={filters.make}
          onChange={(value) => {
            updateParam("make", value);
          }}
        />
        <YearRangeFilter
          minYear={filters.minYear}
          maxYear={filters.maxYear}
          onMinYearChange={(value) => {
            updateParam("minYear", value);
          }}
          onMaxYearChange={(value) => {
            updateParam("maxYear", value);
          }}
        />
        <PriceRangeFilter
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onMinPriceChange={(value) => {
            updateParam("minPrice", value);
          }}
          onMaxPriceChange={(value) => {
            updateParam("maxPrice", value);
          }}
        />
        <HoursFilter
          maxHours={filters.maxHours}
          onMaxHoursChange={(value) => {
            updateParam("maxHours", value);
          }}
        />
        {!hideStatus && (
          <StatusFilter
            status={filters.status}
            onStatusChange={(value) => {
              updateParam("status", value);
            }}
          />
        )}
      </div>

      <div className="p-4 border-t bg-muted/10">
        {isSignedIn && (
          <FilterDefaultsActions
            pendingAction={pendingDefaultsAction}
            onSaveDefaults={saveDefaults}
            onClearDefaults={clearDefaults}
          />
        )}
      </div>
    </div>
  );
};
