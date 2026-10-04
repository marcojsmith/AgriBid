import { FilterGroup } from "./FilterGroup";

/**
 * Props for the {@link MakeFilter} component.
 */
interface MakeFilterProps {
  /**
   * Manufacturers available to filter by.
   */
  makes: string[];
  /**
   * Currently selected manufacturer; empty means all manufacturers.
   */
  value: string;
  /**
   * Called with the chosen manufacturer, or an empty string for all.
   */
  onChange: (value: string) => void;
}

/**
 * Manufacturer dropdown, including the "all manufacturers" option.
 *
 * @param props - Component props.
 * @param props.makes - Manufacturers available to filter by.
 * @param props.value - Currently selected manufacturer.
 * @param props.onChange - Called with the chosen manufacturer.
 * @returns The manufacturer filter.
 */
export function MakeFilter({ makes, value, onChange }: MakeFilterProps) {
  return (
    <FilterGroup label="Manufacturer" labelProps={{ htmlFor: "filter-make" }}>
      <select
        id="filter-make"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="w-full h-10 rounded-md border bg-background px-3 font-medium text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
      >
        <option value="">All Manufacturers</option>
        {makes.map((make) => (
          <option key={make} value={make}>
            {make}
          </option>
        ))}
      </select>
    </FilterGroup>
  );
}
