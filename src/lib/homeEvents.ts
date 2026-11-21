import { CLOSING_SOON_MS } from "@/lib/auction-badges";
import { getEventBucket } from "@/lib/auction-utils";

/** The three views of the Home event list. */
export type HomeView = "live" | "soon" | "results";

/** Sort orders of the Home event list (not offered on Results). */
export type HomeSort = "soonest" | "newest";

/** The fields of an auction event the Home helpers need. */
interface EventWindow {
  status: "draft" | "published" | "closed";
  startTime: number;
  endTime: number;
  effectiveEndTime: number;
}

const VIEWS: readonly HomeView[] = ["live", "soon", "results"];

/**
 * Reads the Home view from the URL. Falls back to the old `?status=closed`
 * param (before the redesign) so existing links keep working.
 *
 * @param view - Value of the `view` search param
 * @param legacyStatus - Value of the old `status` search param
 * @returns The view to show; `live` when nothing valid is given
 */
export function parseHomeView(
  view: string | null,
  legacyStatus: string | null
): HomeView {
  const match = VIEWS.find((v) => v === view);
  if (match) return match;
  return legacyStatus === "closed" ? "results" : "live";
}

/**
 * Reads the sort order from the URL.
 *
 * @param sort - Value of the `sort` search param
 * @returns `newest` when asked for, otherwise `soonest`
 */
export function parseHomeSort(sort: string | null): HomeSort {
  return sort === "newest" ? "newest" : "soonest";
}

/**
 * Picks and orders the events shown for a Home view. Time-dependent, so it is
 * evaluated on the client with `now` (a cached query cannot track time).
 *
 * - `live`: open or upcoming sales (ended sales drop out)
 * - `soon`: open sales whose last lot closes within 24 hours
 * - `results`: ended sales, most recently closed first
 *
 * @param events - Events from `getPublishedAuctions`
 * @param view - Which view to show
 * @param sort - Order for `live` and `soon`
 * @param now - Current time (ms)
 * @returns The events to render, in order
 */
export function selectEvents<T extends EventWindow>(
  events: readonly T[],
  view: HomeView,
  sort: HomeSort,
  now: number
): T[] {
  if (view === "results") {
    return events
      .filter((e) => getEventBucket(e, now) === "closed")
      .sort((a, b) => b.effectiveEndTime - a.effectiveEndTime);
  }
  const shown = events.filter((e) => {
    const bucket = getEventBucket(e, now);
    if (view === "soon") {
      return bucket === "live" && e.effectiveEndTime - now < CLOSING_SOON_MS;
    }
    return bucket !== "closed";
  });
  return shown.sort((a, b) =>
    sort === "newest"
      ? b.startTime - a.startTime
      : a.effectiveEndTime - b.effectiveEndTime
  );
}

/** Classes that lay out the event cards so the grid never ends in a gap. */
export interface EventGridPlan {
  /** Classes for the grid container. */
  gridClass: string;
  /** Extra classes for the first card (it may span several columns and lay out side by side). */
  firstClass: string;
}

const SIDE_BY_SIDE_FULL = "lg:grid lg:grid-cols-[2fr_3fr]";
const SIDE_BY_SIDE_DOUBLE = "lg:grid lg:grid-cols-[3fr_2fr]";

/**
 * Chooses the grid for `count` events. Phone: one column. Tablet: two columns,
 * the first card spans both when the count is odd. Desktop: three columns,
 * where the first card spans the leftover so the last row is always full:
 * 1 event spans all, 2 events share two columns, 4 and 7 put a full-width
 * first card (photos left, details right) above rows of three, and 5 and 8
 * have a double-width first card.
 *
 * @param count - Number of events shown
 * @returns The grid plan
 */
export function eventGridPlan(count: number): EventGridPlan {
  if (count <= 1) {
    return {
      gridClass: "grid grid-cols-1 gap-4 md:gap-6",
      firstClass: SIDE_BY_SIDE_FULL,
    };
  }
  if (count === 2) {
    return {
      gridClass: "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6",
      firstClass: "",
    };
  }
  const base = "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3";
  const oddAtTablet = count % 2 === 1;
  const remainder = count % 3;
  if (remainder === 1) {
    return {
      gridClass: base,
      firstClass: `${oddAtTablet ? "md:col-span-2 " : ""}lg:col-span-3 ${SIDE_BY_SIDE_FULL}`,
    };
  }
  if (remainder === 2) {
    return {
      gridClass: base,
      firstClass: `${oddAtTablet ? "md:col-span-2 " : ""}lg:col-span-2 ${SIDE_BY_SIDE_DOUBLE}`,
    };
  }
  return {
    gridClass: base,
    firstClass: oddAtTablet ? "md:col-span-2 lg:col-span-1" : "",
  };
}
