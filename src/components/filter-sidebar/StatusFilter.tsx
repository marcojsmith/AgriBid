import { FilterGroup } from "./FilterGroup";

/**
 * Props for the {@link StatusFilter} component.
 */
interface StatusFilterProps {
  /**
   * Currently selected auction status.
   */
  status: string;
  /**
   * Called with the chosen status.
   */
  onStatusChange: (value: string) => void;
}

/**
 * Auction status filter (active, closed or all auctions).
 *
 * @param props - Component props.
 * @param props.status - Currently selected auction status.
 * @param props.onStatusChange - Called with the chosen status.
 * @returns The auction status filter.
 */
export function StatusFilter({ status, onStatusChange }: StatusFilterProps) {
  return (
    <FilterGroup
      label="Auction Status"
      labelProps={{ htmlFor: "filter-status" }}
    >
      <select
        id="filter-status"
        value={status}
        onChange={(e) => {
          onStatusChange(e.target.value);
        }}
        className="w-full h-10 rounded-md border bg-background px-3 font-medium text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
      >
        <option value="active">Active Auctions</option>
        <option value="closed">Closed Auctions</option>
        <option value="all">All Auctions</option>
      </select>
    </FilterGroup>
  );
}
