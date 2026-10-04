import { ArrowUpDown } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Status filters offered above the bid list. */
const BID_FILTERS = [
  { value: "all", label: "All" },
  { value: "winning", label: "Winning" },
  { value: "outbid", label: "Outbid" },
  { value: "ended", label: "Ended" },
] as const;

/** Sort orders offered above the bid list. */
const BID_SORTS = [
  { value: "ending", label: "Ending Soon" },
  { value: "recent", label: "Recent Activity" },
  { value: "bid", label: "Highest Bid" },
] as const;

interface BidFiltersProps {
  /** The active status filter. */
  filter: string;
  /** Called with the next status filter value. */
  onFilterChange: (filter: string) => void;
  /** The active sort order. */
  sortBy: string;
  /** Called with the next sort order value. */
  onSortChange: (sortBy: string) => void;
}

/**
 * Filter tabs and sort select rendered above the "My Bids" list.
 *
 * @param props - Component props
 * @param props.filter - The active status filter
 * @param props.onFilterChange - Called with the next status filter value
 * @param props.sortBy - The active sort order
 * @param props.onSortChange - Called with the next sort order value
 * @returns The rendered filter and sort bar
 */
export function BidFilters({
  filter,
  onFilterChange,
  sortBy,
  onSortChange,
}: BidFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
      <Tabs
        value={filter}
        onValueChange={onFilterChange}
        className="w-full sm:w-auto"
      >
        <TabsList className="bg-muted/50 p-1">
          {BID_FILTERS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="font-bold text-xs px-4 transition-[background-color,color]"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger
            aria-label="Sort bids"
            className="w-[180px] font-bold text-xs bg-muted/30 border transition-[border-color,background-color]"
          >
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {BID_SORTS.map((sort) => (
              <SelectItem
                key={sort.value}
                value={sort.value}
                className="font-bold text-xs"
              >
                {sort.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
