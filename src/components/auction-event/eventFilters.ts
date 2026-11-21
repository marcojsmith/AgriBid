import type { ActiveFilter } from "@/components/ds/FilterChips";
import { formatRand } from "@/lib/currency";
import type { LotSummary } from "@/types/auction";

/** The filters the auction event page reads from the URL. */
export interface EventFilters {
  make?: string;
  minYear?: number;
  maxYear?: number;
  minPrice?: number;
  maxPrice?: number;
  maxHours?: number;
}

/** One active filter plus the URL params that remove it. */
export interface EventFilterChip extends ActiveFilter {
  paramKeys: string[];
}

/** How the lots can be ordered. `lot` is the server order (lot number). */
export type EventSort = "lot" | "price-asc" | "price-desc" | "closing";

/** Sort options in display order. */
export const EVENT_SORT_OPTIONS: readonly {
  value: EventSort;
  label: string;
}[] = [
  { value: "lot", label: "Lot number" },
  { value: "closing", label: "Closing soonest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

const parseInteger = (params: URLSearchParams, key: string) => {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Reads the event filters from the URL. Empty or non-numeric values count as
 * unset, so a crafted URL can never create a filter nobody can see.
 *
 * @param params - The page's search params
 * @returns The filters that are set
 */
export function parseEventFilters(params: URLSearchParams): EventFilters {
  const make = params.get("make");
  return {
    make: make === null || make === "" ? undefined : make,
    minYear: parseInteger(params, "minYear"),
    maxYear: parseInteger(params, "maxYear"),
    minPrice: parseInteger(params, "minPrice"),
    maxPrice: parseInteger(params, "maxPrice"),
    maxHours: parseInteger(params, "maxHours"),
  };
}

/**
 * Reads the sort from the URL, falling back to lot number.
 *
 * @param params - The page's search params
 * @returns A valid sort
 */
export function parseEventSort(params: URLSearchParams): EventSort {
  const raw = params.get("sort");
  return EVENT_SORT_OPTIONS.find((o) => o.value === raw)?.value ?? "lot";
}

const rangeLabel = (
  label: string,
  format: (n: number) => string,
  min?: number,
  max?: number
): string => {
  if (min !== undefined && max !== undefined) {
    return `${label}: ${format(min)}–${format(max)}`;
  }
  if (min !== undefined) return `${label}: from ${format(min)}`;
  return `${label}: up to ${format(max ?? 0)}`;
};

/**
 * Builds the removable chips for the filters that are set, one per filter
 * group (a year or price range is one chip). The number of chips is the
 * number shown on the phone's "Filters (n)" button.
 *
 * @param filters - The active filters
 * @returns The chips, in a stable order
 */
export function buildFilterChips(filters: EventFilters): EventFilterChip[] {
  const chips: EventFilterChip[] = [];
  if (filters.make !== undefined) {
    chips.push({
      key: "make",
      label: `Make: ${filters.make}`,
      paramKeys: ["make"],
    });
  }
  if (filters.minYear !== undefined || filters.maxYear !== undefined) {
    chips.push({
      key: "year",
      label: rangeLabel("Year", String, filters.minYear, filters.maxYear),
      paramKeys: ["minYear", "maxYear"],
    });
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    chips.push({
      key: "price",
      label: rangeLabel(
        "Price",
        formatRand,
        filters.minPrice,
        filters.maxPrice
      ),
      paramKeys: ["minPrice", "maxPrice"],
    });
  }
  if (filters.maxHours !== undefined) {
    chips.push({
      key: "hours",
      label: `Hours: up to ${filters.maxHours.toLocaleString("en-ZA")}`,
      paramKeys: ["maxHours"],
    });
  }
  return chips;
}

const closingTime = (lot: LotSummary) =>
  lot.extendedEndTime ?? lot.auctionEndTime ?? Number.MAX_SAFE_INTEGER;

/**
 * Orders lots already loaded on the page. `lot` keeps the server order (lot
 * number). The sort is stable, so ties keep lot-number order.
 *
 * @param lots - The loaded lots
 * @param sort - The chosen sort
 * @returns A new array in the chosen order
 */
export function sortLots(
  lots: readonly LotSummary[],
  sort: EventSort
): LotSummary[] {
  const copy = [...lots];
  if (sort === "price-asc") {
    copy.sort((a, b) => a.currentPrice - b.currentPrice);
  } else if (sort === "price-desc") {
    copy.sort((a, b) => b.currentPrice - a.currentPrice);
  } else if (sort === "closing") {
    copy.sort((a, b) => closingTime(a) - closingTime(b));
  }
  return copy;
}
