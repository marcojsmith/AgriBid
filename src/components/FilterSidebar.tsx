import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { X, Filter, RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useState, useRef } from "react";

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

  const prefsAppliedRef = useRef<boolean | null>(null);

  // Local state for debounced inputs
  const [localFilters, setLocalFilters] = useState<LocalFilters>(() => ({
    status: searchParams.get("status") ?? "active",
    make: searchParams.get("make") ?? "",
    minYear: searchParams.get("minYear") ?? "",
    maxYear: searchParams.get("maxYear") ?? "",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    maxHours: searchParams.get("maxHours") ?? "",
  }));

  // Apply saved preferences once when they arrive
  if (preferences && prefsAppliedRef.current == null) {
    prefsAppliedRef.current = true;
    setLocalFilters((prev) => ({
      status:
        searchParams.get("status") !== null
          ? prev.status
          : (preferences.defaultStatusFilter ?? prev.status),
      make:
        searchParams.get("make") !== null
          ? prev.make
          : (preferences.defaultMake ?? prev.make),
      minYear:
        searchParams.get("minYear") !== null
          ? prev.minYear
          : (preferences.defaultMinYear?.toString() ?? prev.minYear),
      maxYear:
        searchParams.get("maxYear") !== null
          ? prev.maxYear
          : (preferences.defaultMaxYear?.toString() ?? prev.maxYear),
      minPrice:
        searchParams.get("minPrice") !== null
          ? prev.minPrice
          : (preferences.defaultMinPrice?.toString() ?? prev.minPrice),
      maxPrice:
        searchParams.get("maxPrice") !== null
          ? prev.maxPrice
          : (preferences.defaultMaxPrice?.toString() ?? prev.maxPrice),
      maxHours:
        searchParams.get("maxHours") !== null
          ? prev.maxHours
          : (preferences.defaultMaxHours?.toString() ?? prev.maxHours),
    }));
  }

  const updateParam = (key: keyof LocalFilters, value: string) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(localFilters).forEach(([key, value]) => {
      if (value && !(key === "status" && value === "active")) {
        newParams.set(key, value as string);
      } else {
        newParams.delete(key);
      }
    });
    setSearchParams(newParams);
    if (onClose) onClose();
  };

  const clearFilters = () => {
    const q = searchParams.get("q");
    const newParams = new URLSearchParams();
    if (q) newParams.set("q", q);
    setSearchParams(newParams);
    if (onClose) onClose();
  };

  const saveDefaults = () => {
    if (!session) return;
    void updateMyPreferences({
      defaultStatusFilter:
        localFilters.status === "active" ||
        localFilters.status === "closed" ||
        localFilters.status === "all"
          ? (localFilters.status as "active" | "closed" | "all")
          : undefined,
      defaultMake: localFilters.make || undefined,
      defaultMinYear: localFilters.minYear
        ? parseInt(localFilters.minYear, 10)
        : undefined,
      defaultMaxYear: localFilters.maxYear
        ? parseInt(localFilters.maxYear, 10)
        : undefined,
      defaultMinPrice: localFilters.minPrice
        ? parseInt(localFilters.minPrice, 10)
        : undefined,
      defaultMaxPrice: localFilters.maxPrice
        ? parseInt(localFilters.maxPrice, 10)
        : undefined,
      defaultMaxHours: localFilters.maxHours
        ? parseInt(localFilters.maxHours, 10)
        : undefined,
    });
  };

  const clearDefaults = () => {
    if (!session) return;
    void updateMyPreferences({
      defaultStatusFilter: undefined,
      defaultMake: undefined,
      defaultMinYear: undefined,
      defaultMaxYear: undefined,
      defaultMinPrice: undefined,
      defaultMaxPrice: undefined,
      defaultMaxHours: undefined,
    });
  };

  const { status, ...otherFilters } = localFilters;
  const hasFilters =
    status !== "active" || Object.values(otherFilters).some((v) => v !== "");

  return (
    <div className="flex flex-col h-full bg-card border-2 rounded-3xl overflow-hidden shadow-xl shadow-primary/5 animate-in slide-in-from-left-4 duration-300">
      <div className="p-6 border-b flex justify-between items-center bg-muted/30">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="font-black uppercase tracking-tight text-sm">
            Filter Equipment
          </h2>
        </div>
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

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Manufacturer Filter */}
        <div className="space-y-3">
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
            className="w-full h-12 rounded-xl border-2 bg-background px-3 font-bold text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
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
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
            Year Model
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={localFilters.minYear || "any"}
              onValueChange={(value: string) => {
                updateParam("minYear", value === "any" ? "" : value);
              }}
            >
              <SelectTrigger
                aria-label="Minimum year"
                className="h-12 rounded-xl border-2 font-bold"
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
                className="h-12 rounded-xl border-2 font-bold"
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
        <div className="space-y-3">
          <label
            id="price-range-label"
            className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1"
          >
            Price Range (ZAR)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={localFilters.minPrice || "any"}
              onValueChange={(value: string) => {
                updateParam("minPrice", value === "any" ? "" : value);
              }}
            >
              <SelectTrigger
                aria-labelledby="price-range-label"
                aria-label="Minimum price"
                className="h-12 rounded-xl border-2 font-bold"
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
                className="h-12 rounded-xl border-2 font-bold"
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
        <div className="space-y-3">
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
              className="h-12 rounded-xl border-2 font-bold"
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
        <div className="space-y-3">
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
            className="w-full h-12 rounded-xl border-2 bg-background px-3 font-bold text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
          >
            <option value="active">Active Auctions</option>
            <option value="closed">Closed Auctions</option>
            <option value="all">All Auctions</option>
          </select>
        </div>
      </div>

      <div className="p-6 border-t bg-muted/10 space-y-3">
        {session && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={saveDefaults}
              className="h-10 rounded-xl font-black uppercase tracking-tight border-2 text-xs"
            >
              Save Defaults
            </Button>
            <Button
              variant="outline"
              onClick={clearDefaults}
              className="h-10 rounded-xl font-black uppercase tracking-tight border-2 text-xs"
            >
              Clear Defaults
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={clearFilters}
            className="h-12 rounded-xl font-black uppercase tracking-tight border-2 gap-2"
            disabled={!hasFilters}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            onClick={applyFilters}
            className="h-12 rounded-xl font-black uppercase tracking-tight shadow-lg shadow-primary/20"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
};
