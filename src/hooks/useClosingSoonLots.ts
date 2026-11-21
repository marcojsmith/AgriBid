import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import type { ClosingSoonLot } from "@/lib/closingSoon";

import {
  CLOSING_SOON_LOT_LIMIT,
  CLOSING_SOON_REFRESH_BUCKET_MS,
} from "../../convex/constants";

/**
 * Loads the lots closing in the next 24 hours for the Home strip.
 *
 * Convex does not re-run a query as time passes, so the current time rounded
 * down to {@link CLOSING_SOON_REFRESH_BUCKET_MS} is passed as `asOf`: every
 * bucket is a fresh cache entry and the server re-evaluates its 24 h window.
 * While the next bucket loads, the previous result stays on screen instead of
 * flashing the loading state.
 *
 * @param now - Current time in ms (from `useNow`)
 * @param enabled - False skips the query (e.g. while searching)
 * @returns The lots, or undefined until the first result arrives
 */
export function useClosingSoonLots(
  now: number,
  enabled: boolean
): readonly ClosingSoonLot[] | undefined {
  const asOf =
    Math.floor(now / CLOSING_SOON_REFRESH_BUCKET_MS) *
    CLOSING_SOON_REFRESH_BUCKET_MS;
  const result = useQuery(
    api.auctions.getClosingSoonLots,
    enabled ? { limit: CLOSING_SOON_LOT_LIMIT, asOf } : "skip"
  );
  // Keep the last result while a new bucket loads (set-state-in-render is the
  // sanctioned way to derive state from changing data).
  const [kept, setKept] = useState<readonly ClosingSoonLot[] | undefined>();
  if (result !== undefined && result !== kept) setKept(result);
  return result ?? kept;
}
