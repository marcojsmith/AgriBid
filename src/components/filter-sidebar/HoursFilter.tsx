import { FilterGroup } from "./FilterGroup";
import { FilterSelect } from "./FilterSelect";
import { MAX_HOURS_OPTIONS } from "./filterHelpers";

/**
 * Props for the {@link HoursFilter} component.
 */
interface HoursFilterProps {
  /**
   * Highest operating hours allowed; empty means no limit.
   */
  maxHours: string;
  /**
   * Called with the chosen ceiling, or an empty string to clear it.
   */
  onMaxHoursChange: (value: string) => void;
}

/**
 * Maximum operating hours filter.
 *
 * @param props - Component props.
 * @param props.maxHours - Highest operating hours allowed.
 * @param props.onMaxHoursChange - Called with the chosen ceiling.
 * @returns The operating hours filter.
 */
export function HoursFilter({ maxHours, onMaxHoursChange }: HoursFilterProps) {
  return (
    <FilterGroup label="Max Operating Hours" labelProps={{ id: "hours-label" }}>
      <FilterSelect
        value={maxHours}
        anyLabel="Any"
        placeholder="Any"
        ariaLabelledBy="hours-label"
        options={MAX_HOURS_OPTIONS}
        onChange={onMaxHoursChange}
      />
    </FilterGroup>
  );
}
