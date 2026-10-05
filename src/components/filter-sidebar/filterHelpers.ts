import type {
  FilterOption,
  FilterPreferenceUpdate,
  LocalFilters,
  SavedFilterPreferences,
  StatusFilter,
} from "./filterTypes";

/**
 * The status filter used when nothing else applies.
 */
export const DEFAULT_STATUS_FILTER: StatusFilter = "active";

/**
 * The sentinel value the filter dropdowns use for "no filter chosen". It is
 * translated to an empty string before it reaches the URL or local state.
 */
export const ANY_FILTER_VALUE = "any";

/**
 * Price bounds offered by the sidebar, in rand.
 */
export const MIN_PRICE_OPTIONS: FilterOption[] = [
  { value: "100000", label: "R100K" },
  { value: "250000", label: "R250K" },
  { value: "500000", label: "R500K" },
  { value: "1000000", label: "R1M" },
  { value: "2000000", label: "R2M" },
];

/**
 * Price ceilings offered by the sidebar, in rand.
 */
export const MAX_PRICE_OPTIONS: FilterOption[] = [
  { value: "250000", label: "R250K" },
  { value: "500000", label: "R500K" },
  { value: "1000000", label: "R1M" },
  { value: "2000000", label: "R2M" },
  { value: "5000000", label: "R5M" },
];

/**
 * Operating hour ceilings offered by the sidebar.
 */
export const MAX_HOURS_OPTIONS: FilterOption[] = [
  { value: "100", label: "100 hrs" },
  { value: "500", label: "500 hrs" },
  { value: "1000", label: "1,000 hrs" },
  { value: "2500", label: "2,500 hrs" },
  { value: "5000", label: "5,000 hrs" },
  { value: "10000", label: "10,000 hrs" },
];

/**
 * Builds the "no filter" filter set: active status with every other filter
 * cleared.
 *
 * @returns The default filter values.
 */
export function getDefaultFilters(): LocalFilters {
  return {
    status: DEFAULT_STATUS_FILTER,
    make: "",
    minYear: "",
    maxYear: "",
    minPrice: "",
    maxPrice: "",
    maxHours: "",
  };
}

/**
 * Type guard for the auction status values the sidebar accepts.
 *
 * @param value - Candidate status value.
 * @returns True when the value is a supported status filter.
 */
export function isStatusFilterValue(value: string): value is StatusFilter {
  return value === "active" || value === "closed" || value === "all";
}

/**
 * Coerces any value into a supported status filter.
 *
 * @param value - Candidate status value.
 * @returns The value when supported, otherwise "active".
 */
export function normalizeStatusFilter(
  value: string | null | undefined
): StatusFilter {
  return value !== null && value !== undefined && isStatusFilterValue(value)
    ? value
    : DEFAULT_STATUS_FILTER;
}

/**
 * Parses a URL query parameter into a whole-number string, treating anything
 * unparseable as "no filter".
 *
 * @param params - The URL parameters to read from.
 * @param key - The parameter name.
 * @returns The parsed integer as a string, or an empty string.
 */
function parseFiniteIntParam(params: URLSearchParams, key: string): string {
  const value = params.get(key);
  if (value === null) return "";
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed.toString() : "";
}

/**
 * Validates and normalizes filter values from URL parameters.
 *
 * Enforces the same rules as the browse page:
 * - Only accepts allowed status values (active, closed, all)
 * - Parses numeric params with parseInt and treats non-finite/NaN as empty strings
 * - Trims and validates strings like make
 * - Falls back to empty/default values when a param is invalid
 *
 * @param params - The URLSearchParams to parse.
 * @returns A normalized LocalFilters object.
 */
export function parseUrlFilters(params: URLSearchParams): LocalFilters {
  return {
    status: normalizeStatusFilter(params.get("status")),
    make: (params.get("make") ?? "").trim(),
    minYear: parseFiniteIntParam(params, "minYear"),
    maxYear: parseFiniteIntParam(params, "maxYear"),
    minPrice: parseFiniteIntParam(params, "minPrice"),
    maxPrice: parseFiniteIntParam(params, "maxPrice"),
    maxHours: parseFiniteIntParam(params, "maxHours"),
  };
}

/**
 * Formats a saved numeric preference for the URL-oriented filter state.
 *
 * @param value - Saved preference value.
 * @returns The value as a string, or an empty string when unset.
 */
export function toFilterNumberString(value: number | null | undefined): string {
  return value !== null && value !== undefined && Number.isFinite(value)
    ? value.toString()
    : "";
}

/**
 * Overlays the caller's saved preferences onto filters parsed from the URL.
 * URL params always win, because an explicit filter beats a saved default.
 *
 * @param urlFilters - Filters parsed from the current URL.
 * @param preferences - The user's saved filter defaults.
 * @param hideStatus - True when the status control is hidden, in which case the
 *   URL value is used as-is and no saved status is applied.
 * @returns The filters to seed local state with.
 */
export function mergePreferencesWithUrlFilters(
  urlFilters: LocalFilters,
  preferences: SavedFilterPreferences,
  hideStatus: boolean
): LocalFilters {
  return {
    status:
      hideStatus || urlFilters.status !== DEFAULT_STATUS_FILTER
        ? urlFilters.status
        : normalizeStatusFilter(preferences.defaultStatusFilter),
    make: urlFilters.make || (preferences.defaultMake ?? "").trim(),
    minYear:
      urlFilters.minYear || toFilterNumberString(preferences.defaultMinYear),
    maxYear:
      urlFilters.maxYear || toFilterNumberString(preferences.defaultMaxYear),
    minPrice:
      urlFilters.minPrice || toFilterNumberString(preferences.defaultMinPrice),
    maxPrice:
      urlFilters.maxPrice || toFilterNumberString(preferences.defaultMaxPrice),
    maxHours:
      urlFilters.maxHours || toFilterNumberString(preferences.defaultMaxHours),
  };
}

/**
 * Converts a filter state into the payload for saving it as the user's
 * defaults. Blank filters are saved as `undefined` so they are cleared.
 *
 * @param filters - The current filter state.
 * @param hideStatus - True when no status control is shown, in which case the
 *   status is never persisted (there is nothing for the user to have chosen).
 * @returns The preference payload.
 */
export function toPreferenceUpdate(
  filters: LocalFilters,
  hideStatus: boolean
): FilterPreferenceUpdate {
  const update: FilterPreferenceUpdate = {
    defaultMake: filters.make.trim() || undefined,
    defaultMinYear: parseOptionalInt(filters.minYear),
    defaultMaxYear: parseOptionalInt(filters.maxYear),
    defaultMinPrice: parseOptionalInt(filters.minPrice),
    defaultMaxPrice: parseOptionalInt(filters.maxPrice),
    defaultMaxHours: parseOptionalInt(filters.maxHours),
  };

  if (!hideStatus) {
    update.defaultStatusFilter = isStatusFilterValue(filters.status)
      ? filters.status
      : undefined;
  }

  return update;
}

/**
 * Parses a filter string into an integer for storage, discarding blanks and
 * unparseable values.
 *
 * @param value - The filter value.
 * @returns The parsed integer, or `undefined`.
 */
function parseOptionalInt(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Reports whether any filter is narrowing the results, which is what enables
 * the reset button.
 *
 * @param filters - The current filter state.
 * @returns True when at least one filter is set.
 */
export function hasActiveFilters(filters: LocalFilters): boolean {
  const { status, ...otherFilters } = filters;
  return (
    status !== DEFAULT_STATUS_FILTER ||
    Object.values(otherFilters).some((value) => value !== "")
  );
}

/**
 * Builds the descending list of year options for the year range dropdowns.
 *
 * @param count - How many years to offer.
 * @param fromYear - The most recent year to offer.
 * @returns Year strings, newest first.
 */
export function buildYearOptions(
  count = 30,
  fromYear: number = new Date().getFullYear()
): string[] {
  return Array.from({ length: count }, (_, index) =>
    (fromYear - index).toString()
  );
}
