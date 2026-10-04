import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "convex/_generated/api";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";

import {
  DEFAULT_STATUS_FILTER,
  getDefaultFilters,
  hasActiveFilters,
  mergePreferencesWithUrlFilters,
  parseUrlFilters,
  toPreferenceUpdate,
} from "./filterHelpers";
import type { LocalFilters } from "./filterTypes";

/**
 * Options for {@link useFilterSidebar}.
 */
export interface UseFilterSidebarOptions {
  /**
   * Hides the auction status control and skips `status` in URL/preference sync.
   */
  hideStatus: boolean;
  /**
   * Invoked after filters are reset, used to close the mobile overlay.
   */
  onClose?: () => void;
}

/**
 * Owns the sidebar's filter state and keeps it in sync with the URL and the
 * signed-in user's saved default filters.
 *
 * @param options - Hook options.
 * @param options.hideStatus - Whether the status filter is hidden for this page.
 * @param options.onClose - Callback invoked when the filters are reset.
 * @returns An object with:
 * - `filters` — the current filter values.
 * - `activeMakes` — manufacturers available to filter by.
 * - `hasFilters` — whether any filter narrows the results.
 * - `isSignedIn` — whether a session exists, gating the defaults actions.
 * - `pendingDefaultsAction` — "save" or "clear" while a defaults mutation runs.
 * - `updateParam(key, value)` — updates a single filter.
 * - `resetFilters()` — clears filters and URL params, keeping `q`.
 * - `saveDefaults()` — persists the current filters as the user's defaults.
 * - `clearDefaults()` — clears the saved defaults and resets the filters.
 */
export function useFilterSidebar({
  hideStatus,
  onClose,
}: UseFilterSidebarOptions) {
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

  const prefsAppliedRef = useRef<boolean>(false);
  // Tracks whether the next searchParams change was triggered locally (filter
  // change or reset) so the external-navigation sync effect can skip it.
  const isLocalUpdateRef = useRef<boolean>(true);
  // Track the current user ID to detect user switches
  const lastUserIdRef = useRef<string | undefined>(session?.user.id);

  // Always-current reference to searchParams used inside the local→URL effect
  // to avoid adding searchParams to its dependency array (which would cause it
  // to fire on external navigations and overwrite the URL with stale filters).
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  // Stable string representation used as a dep for the preferences effect.
  const searchParamsString = searchParams.toString();

  // Initialize filters from search params only (preferences handled in effect).
  // Use the normalizer to ensure valid initial state.
  const [filters, setFilters] = useState<LocalFilters>(() =>
    parseUrlFilters(searchParams)
  );
  // Tracks which defaults action is in flight so labels reflect it
  const [pendingDefaultsAction, setPendingDefaultsAction] = useState<
    "save" | "clear" | null
  >(null);

  // Sync filters → URL whenever filters change locally.
  // Uses searchParamsRef so it does not run on external URL changes.
  // When hideStatus is set, status is left untouched in the URL.
  useEffect(() => {
    const currentParams = searchParamsRef.current;
    const newParams = new URLSearchParams(currentParams.toString());
    (Object.entries(filters) as [string, string][]).forEach(([key, value]) => {
      if (hideStatus && key === "status") return;
      if (value && !(key === "status" && value === DEFAULT_STATUS_FILTER)) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    if (newParams.toString() !== currentParams.toString()) {
      isLocalUpdateRef.current = true;
      setSearchParams(newParams);
    }
  }, [filters, setSearchParams, hideStatus]);

  // Sync URL → filters when the URL changes due to external navigation
  // (e.g. browser back/forward). Skips updates caused by local filter changes.
  useEffect(() => {
    if (isLocalUpdateRef.current) {
      isLocalUpdateRef.current = false;
      return;
    }
    // Use the normalizer to ensure valid state from URL
    setFilters(parseUrlFilters(searchParams));
  }, [searchParams]);

  // Reset preferences state when user changes
  useEffect(() => {
    const currentUserId = session?.user.id;
    if (currentUserId !== lastUserIdRef.current) {
      lastUserIdRef.current = currentUserId;
      // Reset the applied flag so preferences are re-applied for the new user
      prefsAppliedRef.current = false;
      isLocalUpdateRef.current = false;
    }
  }, [session?.user.id]);

  // Apply saved preferences once when they arrive (only if not yet applied).
  // Uses searchParamsRef to avoid stale closures; searchParamsString ensures
  // the effect re-fires when the URL changes after preferences load.
  useLayoutEffect(() => {
    if (preferences && !prefsAppliedRef.current) {
      prefsAppliedRef.current = true;
      setFilters(
        mergePreferencesWithUrlFilters(
          parseUrlFilters(searchParamsRef.current),
          preferences,
          hideStatus
        )
      );
    }
  }, [preferences, searchParamsString, hideStatus]);

  const updateParam = useCallback((key: keyof LocalFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    prefsAppliedRef.current = true;
    isLocalUpdateRef.current = true;
    const q = searchParams.get("q");
    const newParams = new URLSearchParams();
    if (q) newParams.set("q", q);
    setSearchParams(newParams);
    setFilters(getDefaultFilters());
    onClose?.();
  }, [onClose, searchParams, setSearchParams]);

  const saveDefaults = useCallback(async () => {
    if (!session || pendingDefaultsAction !== null) return;
    setPendingDefaultsAction("save");
    try {
      // hideStatus means no control is shown for the user to set or see
      // this value, so never persist it as a default (it would silently
      // become "active" even though filters.status defaults to that
      // regardless of what the scoped browser is actually using).
      await updateMyPreferences(toPreferenceUpdate(filters, hideStatus));
      toast.success("Default filters saved");
    } catch {
      toast.error("Failed to save default filters");
    } finally {
      setPendingDefaultsAction(null);
    }
  }, [
    filters,
    hideStatus,
    pendingDefaultsAction,
    session,
    updateMyPreferences,
  ]);

  const clearDefaults = useCallback(async () => {
    if (!session || pendingDefaultsAction !== null) return;
    setPendingDefaultsAction("clear");
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
      setFilters(getDefaultFilters());
      const newParams = new URLSearchParams();
      const q = searchParams.get("q");
      if (q) newParams.set("q", q);
      setSearchParams(newParams);
      toast.success("Default filters cleared");
    } catch {
      toast.error("Failed to clear default filters");
    } finally {
      setPendingDefaultsAction(null);
    }
  }, [
    searchParams,
    session,
    pendingDefaultsAction,
    setSearchParams,
    updateMyPreferences,
  ]);

  const hasFilters = useMemo(() => hasActiveFilters(filters), [filters]);

  return {
    filters,
    activeMakes,
    hasFilters,
    isSignedIn: Boolean(session),
    pendingDefaultsAction,
    updateParam,
    resetFilters,
    saveDefaults,
    clearDefaults,
  };
}
