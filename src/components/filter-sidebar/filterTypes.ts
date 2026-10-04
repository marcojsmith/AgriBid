/**
 * Local state for the sidebar filters. Values are kept as strings because they
 * mirror the URL query parameters.
 */
export interface LocalFilters {
  status: string;
  make: string;
  minYear: string;
  maxYear: string;
  minPrice: string;
  maxPrice: string;
  maxHours: string;
}

/**
 * The auction status values the sidebar accepts.
 */
export type StatusFilter = "active" | "closed" | "all";

/**
 * The saved filter defaults this sidebar reads and writes. Nullable because a
 * preference field can be absent, and the query may hand back null values.
 */
export interface SavedFilterPreferences {
  defaultStatusFilter?: string | null;
  defaultMake?: string | null;
  defaultMinYear?: number | null;
  defaultMaxYear?: number | null;
  defaultMinPrice?: number | null;
  defaultMaxPrice?: number | null;
  defaultMaxHours?: number | null;
}

/**
 * The subset of preference fields saved by the sidebar's defaults actions.
 */
export interface FilterPreferenceUpdate {
  defaultStatusFilter?: StatusFilter;
  defaultMake?: string;
  defaultMinYear?: number;
  defaultMaxYear?: number;
  defaultMinPrice?: number;
  defaultMaxPrice?: number;
  defaultMaxHours?: number;
}

/**
 * One option of a filter dropdown.
 */
export interface FilterOption {
  value: string;
  label: string;
}
