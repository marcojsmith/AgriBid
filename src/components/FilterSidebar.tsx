import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { X, Filter, RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";

import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

/**
 * Props for the FilterSidebar component.
 */
interface FilterSidebarProps {
  /**
   * Callback invoked when the sidebar should close (used in mobile overlay).
   */
  onClose?: () => void;
}

/**
 * Local state for sidebar filters.
 */
interface LocalFilters {
  status: string;
  make: string;
  minYear: string;
  maxYear: string;
  minPrice: string;
  maxPrice: string;
  maxHours: string;
}

/**
 * Get default filter values.
 *
 * @returns A LocalFilters object with all fields set to their default empty/active state.
 */
const getDefaultFilters = (): LocalFilters => ({
  status: "active",
  make: "",
  minYear: "",
  maxYear: "",
  minPrice: "",
  maxPrice: "",
  maxHours: "",
});

/**
 * Validates and normalizes filter values from URL parameters.
 * Enforces the same rules as Home.tsx:
 * - Only accepts allowed status values (active, closed, all)
 * - Parses numeric params with parseInt and treats non-finite/NaN as empty strings
 * - Trims and validates strings like make
 * - Falls back to empty/default values when a param is invalid
 *
 * @param params - The URLSearchParams to parse
 * @returns A normalized LocalFilters object
 */
const parseUrlFilters = (params: URLSearchParams): LocalFilters => {
  // Validate status - only allow known values
  const rawStatus = params.get("status");
  const status =
    rawStatus === "active" || rawStatus === "closed" || rawStatus === "all"
      ? rawStatus
      : "active";

  // Validate and trim make
  const make = (params.get("make") ?? "").trim();

  // Parse numeric fields - only accept finite integers
  const parseFiniteInt = (key: string): string => {
    const val = params.get(key);
    if (val === null) return "";
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) ? parsed.toString() : "";
  };

  return {
    status,
    make,
    minYear: parseFiniteInt("minYear"),
    maxYear: parseFiniteInt("maxYear"),
    minPrice: parseFiniteInt("minPrice"),
    maxPrice: parseFiniteInt("maxPrice"),
    maxHours: parseFiniteInt("maxHours"),
  };
};

/**
 * Sidebar component for filtering auctions.
 *
 * @param props - Component props.
 * @param props.onClose - Callback when the sidebar is closed.
 * @returns The rendered filter sidebar.
 */
export const FilterSidebar = ({ onClose }: FilterSidebarProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeMakes = useQuery(api.auctions.getActiveMakes) ?? [];
  const { data: session } = useSession();
  const preferences = useQuery(
    api.userPreferences.getMyPreferences,
    session ? {} : "skip"
  );
  const updateMyPreferences = useMutation(
    api.userPreferences.updateMyPreferences
  );

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) =>
    (currentYear - i).toString()
  );

  const prefsAppliedRef = useRef<boolean>(false);
  // Tracks whether the next searchParams change was triggered locally (filter
  // change or reset) so the external-navigation sync effect can skip it.
  const isLocalUpdateRef = useRef<boolean>(true);
  // Track the current user ID to detect user switches
  const lastUserIdRef = useRef<string | undefined>(session?.user?.id);

  // Always-current reference to searchParams used inside the local→URL effect
  // to avoid adding searchParams to its dependency array (which would cause it
  // to fire on external navigations and overwrite the URL with stale filters).
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  // Stable string representation used as a dep for the preferences effect.
  const searchParamsString = searchParams.toString();

  // Initialize localFilters from search params only (preferences handled in effect)
  // Use the normalizer to ensure valid initial state
  const getInitialFilters = (): LocalFilters => parseUrlFilters(searchParams);

  // Local state for debounced inputs
  const [localFilters, setLocalFilters] =
    useState<LocalFilters>(getInitialFilters);

  // Sync localFilters → URL whenever filters change locally.
  // Uses searchParamsRef so it does not run on external URL changes.
  useEffect(() => {
    const currentParams = searchParamsRef.current;
    const newParams = new URLSearchParams(currentParams.toString());
    (Object.entries(localFilters) as [string, string][]).forEach(
      ([key, value]) => {
        if (value && !(key === "status" && value === "active")) {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      }
    );
    if (newParams.toString() !== currentParams.toString()) {
      isLocalUpdateRef.current = true;
      setSearchParams(newParams);
    }
  }, [localFilters, setSearchParams]);

  // Sync URL → localFilters when the URL changes due to external navigation
  // (e.g. browser back/forward). Skips updates caused by local filter changes.
  useEffect(() => {
    if (isLocalUpdateRef.current) {
      isLocalUpdateRef.current = false;
      return;
    }
    // Use the normalizer to ensure valid state from URL
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalFilters(parseUrlFilters(searchParams));
  }, [searchParams]);

  // Reset preferences state when user changes
  useEffect(() => {
    const currentUserId = session?.user?.id;
    if (currentUserId !== lastUserIdRef.current) {
      lastUserIdRef.current = currentUserId;
      // Reset the applied flag so preferences are re-applied for the new user
      prefsAppliedRef.current = false;
      isLocalUpdateRef.current = false;
    }
  }, [session?.user?.id]);

  // Apply saved preferences once when they arrive (only if not yet applied).
  // Uses searchParamsRef to avoid stale closures; searchParamsString ensures
  // the effect re-fires when the URL changes after preferences load.
  useLayoutEffect(() => {
    if (preferences && !prefsAppliedRef.current) {
      prefsAppliedRef.current = true;
      const params = searchParamsRef.current;

      // Parse and normalize URL filters first
      const urlFilters = parseUrlFilters(params);

      // Apply preferences as defaults only when URL params are not present
      // Validate preference values using the same rules
      const validateStatus = (val: string | undefined): string => {
        return val === "active" || val === "closed" || val === "all"
          ? val
          : "active";
      };

      const validateNumber = (val: number | undefined): string => {
        return val !== undefined && Number.isFinite(val) ? val.toString() : "";
      };

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalFilters({
        status: urlFilters.status !== "active"
          ? urlFilters.status
          : validateStatus(preferences.defaultStatusFilter),
        make: urlFilters.make || (preferences.defaultMake ?? "").trim(),
        minYear: urlFilters.minYear || validateNumber(preferences.defaultMinYear),
        maxYear: urlFilters.maxYear || validateNumber(preferences.defaultMaxYear),
        minPrice: urlFilters.minPrice || validateNumber(preferences.defaultMinPrice),
        maxPrice: urlFilters.maxPrice || validateNumber(preferences.defaultMaxPrice),
        maxHours: urlFilters.maxHours || validateNumber(preferences.defaultMaxHours),
      });
    }
  }, [preferences, searchParamsString]);

  const updateParam = (key: keyof LocalFilters, value: string) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    prefsAppliedRef.current = true;
    isLocalUpdateRef.current = true;
    const q = searchParams.get("q");
    const newParams = new URLSearchParams();
    if (q) newParams.set("q", q);
    setSearchParams(newParams);
    setLocalFilters(getDefaultFilters());
    if (onClose) onClose();
  };

  const saveDefaults = async () => {
    if (!session) return;
    try {
      // Use the same validation logic when saving
      const validateAndParseInt = (val: string): number | undefined => {
        if (!val) return undefined;
        const parsed = parseInt(val, 10);
        return Number.isFinite(parsed) ? parsed : undefined;
      };

      await updateMyPreferences({
        defaultStatusFilter:
          localFilters.status === "active" ||
          localFilters.status === "closed" ||
          localFilters.status === "all"
            ? (localFilters.status as "active" | "closed" | "all")
            : undefined,
        defaultMake: localFilters.make.trim() || undefined,
        defaultMinYear: validateAndParseInt(localFilters.minYear),
        defaultMaxYear: validateAndParseInt(localFilters.maxYear),
        defaultMinPrice: validateAndParseInt(localFilters.minPrice),
        defaultMaxPrice: validateAndParseInt(localFilters.maxPrice),
        defaultMaxHours: validateAndParseInt(localFilters.maxHours),
      });
      toast.success("Default filters saved");
    } catch {
      toast.error("Failed to save default filters");
    }
  };

  const clearDefaults = async () => {
    if (!session) return;
    try {
      await updateMyPreferences({
        defaultStatusFilter: undefined,
        defaultMake: undefined,
        defaultMinYear: undefined,
        defaultMaxYear: undefined,
        defaultMinPrice: undefined,
        defaultMaxPrice: undefined,
        defaultMaxHours: undefined,
      });
      prefsAppliedRef.current = true;
      isLocalUpdateRef.current = true;
      const defaultFilters = getDefaultFilters();
      setLocalFilters(defaultFilters);
      const newParams = new URLSearchParams();
      const q = searchParams.get("q");
      if (q) newParams.set("q", q);
      setSearchParams(newParams);
      toast.success("Default filters cleared");
    } catch {
      toast.error("Failed to clear default filters");
    }
  };

  const { status, ...otherFilters } = localFilters;
  const hasFilters =
    status !== "active" || Object.values(otherFilters).some((v) => v !== "");

  return (
    <div className="flex flex-col h-full bg-card border-2 rounded-lg overflow-hidden shadow-xl shadow-primary/5 animate-in slide-in-from-left-4 duration-300">
      <div className="p-4 border-b flex justify-between items-center bg-muted/30">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="font-black uppercase tracking-tight text-sm">
            Filter Equipment
          </h2>
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
        {/* Manufacturer Filter */}
        <div className="space-y-2">
          <label
            htmlFor="filter-make"
            className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1"
          >
            Manufacturer
          </label>
          <select
            id="filter-make"
            value={localFilters.make}
            onChange={(e) => updateParam("make", e.target.value)}
            className="w-full h-10 rounded-md border-2 bg-background px-3 font-bold text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
          >
            <option value="">All Manufacturers</option>
            {activeMakes.map((make) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </select>
        </div>

        {/* Year Range */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
            Year Model
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={localFilters.minYear || "any"}
              onValueChange={(value: string) => {
                updateParam("minYear", value === "any" ? "" : value);
              }}
            >
              <SelectTrigger
                aria-label="Minimum year"
                className="h-10 rounded-md border-2 font-bold"
              >
                <SelectValue placeholder="From" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">From</SelectItem>
                {years.map((year) => (
                  <SelectItem key={`min-${year}`} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={localFilters.maxYear || "any"}
              onValueChange={(value: string) => {
                updateParam("maxYear", value === "any" ? "" : value);
              }}
            >
              <SelectTrigger
                aria-label="Maximum year"
                className="h-10 rounded-md border-2 font-bold"
              >
                <SelectValue placeholder="To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">To</SelectItem>
                {years.map((year) => (
                  <SelectItem key={`max-${year}`} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Price Range */}
        <div className="space-y-2">
          <label
            id="price-range-label"
            className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1"
          >
            Price Range (ZAR)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={localFilters.minPrice || "any"}
              onValueChange={(value: string) => {
                updateParam("minPrice", value === "any" ? "" : value);
              }}
            >
              <SelectTrigger
                aria-labelledby="price-range-label"
                aria-label="Minimum price"
                className="h-10 rounded-md border-2 font-bold"
              >
                <SelectValue placeholder="Min" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Min</SelectItem>
                <SelectItem value="100000">R100K</SelectItem>
                <SelectItem value="250000">R250K</SelectItem>
                <SelectItem value="500000">R500K</SelectItem>
                <SelectItem value="1000000">R1M</SelectItem>
                <SelectItem value="2000000">R2M</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={localFilters.maxPrice || "any"}
              onValueChange={(value: string) => {
                updateParam("maxPrice", value === "any" ? "" : value);
              }}
            >
              <SelectTrigger
                aria-labelledby="price-range-label"
                aria-label="Maximum price"
                className="h-10 rounded-md border-2 font-bold"
              >
                <SelectValue placeholder="Max" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Max</SelectItem>
                <SelectItem value="250000">R250K</SelectItem>
                <SelectItem value="500000">R500K</SelectItem>
                <SelectItem value="1000000">R1M</SelectItem>
                <SelectItem value="2000000">R2M</SelectItem>
                <SelectItem value="5000000">R5M</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="space-y-2">
          <label
            id="hours-label"
            className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1"
          >
            Max Operating Hours
          </label>
          <Select
            value={localFilters.maxHours || "any"}
            onValueChange={(value: string) => {
              updateParam("maxHours", value === "any" ? "" : value);
            }}
          >
            <SelectTrigger
              aria-labelledby="hours-label"
              className="h-10 rounded-md border-2 font-bold"
            >
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="100">100 hrs</SelectItem>
              <SelectItem value="500">500 hrs</SelectItem>
              <SelectItem value="1000">1,000 hrs</SelectItem>
              <SelectItem value="2500">2,500 hrs</SelectItem>
              <SelectItem value="5000">5,000 hrs</SelectItem>
              <SelectItem value="10000">10,000 hrs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auction Status Filter */}
        <div className="space-y-2">
          <label
            htmlFor="filter-status"
            className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1"
          >
            Auction Status
          </label>
          <select
            id="filter-status"
            value={localFilters.status}
            onChange={(e) => updateParam("status", e.target.value)}
            className="w-full h-10 rounded-md border-2 bg-background px-3 font-bold text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
          >
            <option value="active">Active Auctions</option>
            <option value="closed">Closed Auctions</option>
            <option value="all">All Auctions</option>
          </select>
        </div>
      </div>

      <div className="p-4 border-t bg-muted/10">
        {session && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={saveDefaults}
              className="h-9 rounded-md font-black uppercase tracking-tight border-2 text-xs"
            >
              Save Defaults
            </Button>
            <Button
              variant="outline"
              onClick={clearDefaults}
              className="h-9 rounded-md font-black uppercase tracking-tight border-2 text-xs"
            >
              Clear Defaults
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};