import { formatRand } from "@/lib/currency";

/** The closed-sale totals: lots sold of all lots, and what they sold for. */
export interface ClosedTotals {
  sold: number;
  total: number;
  soldTotal: number;
  underConsideration: number;
}

/**
 * The closed-sale line: "5 of 6 lots sold · R 982 000", plus
 * " · 1 under consideration" when lots are with their sellers.
 *
 * @param totals - The sale's outcome counts
 * @returns The sentence, without a full stop
 */
export function closedSummary(totals: ClosedTotals): string {
  const lots = `${String(totals.sold)} of ${String(totals.total)} lots sold`;
  const base =
    totals.sold > 0 ? `${lots} · ${formatRand(totals.soldTotal)}` : lots;
  return totals.underConsideration > 0
    ? `${base} · ${String(totals.underConsideration)} under consideration`
    : base;
}

/** How the event page orders its lots. */
export type EventSort = "lot_number" | "price_asc" | "most_watched";

/** The sort options, in the order they are listed. */
export const SORT_OPTIONS: readonly { value: EventSort; label: string }[] = [
  { value: "lot_number", label: "Lot number" },
  { value: "price_asc", label: "Price low–high" },
  { value: "most_watched", label: "Most watched" },
];
