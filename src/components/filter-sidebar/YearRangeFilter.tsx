import { useMemo } from "react";

import { FilterGroup } from "./FilterGroup";
import { FilterSelect } from "./FilterSelect";
import { buildYearOptions } from "./filterHelpers";

/**
 * Props for the {@link YearRangeFilter} component.
 */
interface YearRangeFilterProps {
  /**
   * Earliest model year; empty means no lower bound.
   */
  minYear: string;
  /**
   * Latest model year; empty means no upper bound.
   */
  maxYear: string;
  /**
   * Called with the chosen lower bound, or an empty string to clear it.
   */
  onMinYearChange: (value: string) => void;
  /**
   * Called with the chosen upper bound, or an empty string to clear it.
   */
  onMaxYearChange: (value: string) => void;
}

/**
 * Year model range filter, offering the last 30 years.
 *
 * @param props - Component props.
 * @param props.minYear - Earliest model year.
 * @param props.maxYear - Latest model year.
 * @param props.onMinYearChange - Called with the chosen lower bound.
 * @param props.onMaxYearChange - Called with the chosen upper bound.
 * @returns The year range filter.
 */
export function YearRangeFilter({
  minYear,
  maxYear,
  onMinYearChange,
  onMaxYearChange,
}: YearRangeFilterProps) {
  const years = useMemo(() => buildYearOptions(), []);
  const yearOptions = useMemo(
    () => years.map((year) => ({ value: year, label: year })),
    [years]
  );

  return (
    <FilterGroup label="Year Model">
      <div className="grid grid-cols-2 gap-2">
        <FilterSelect
          value={minYear}
          anyLabel="From"
          placeholder="From"
          ariaLabel="Minimum year"
          options={yearOptions}
          onChange={onMinYearChange}
        />
        <FilterSelect
          value={maxYear}
          anyLabel="To"
          placeholder="To"
          ariaLabel="Maximum year"
          options={yearOptions}
          onChange={onMaxYearChange}
        />
      </div>
    </FilterGroup>
  );
}
