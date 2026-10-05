import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ANY_FILTER_VALUE } from "./filterHelpers";
import type { FilterOption } from "./filterTypes";

/**
 * Props for the {@link FilterSelect} component.
 */
interface FilterSelectProps {
  /**
   * Currently selected value; an empty string means "no filter".
   */
  value: string;
  /**
   * Label of the leading "no filter" option.
   */
  anyLabel: string;
  /**
   * The selectable filter values, excluding the "no filter" option.
   */
  options: FilterOption[];
  /**
   * Placeholder shown while no value is selected.
   */
  placeholder: string;
  /**
   * Accessible name for the trigger.
   */
  ariaLabel?: string;
  /**
   * Id of the label describing this filter, used with `aria-labelledby`.
   */
  ariaLabelledBy?: string;
  /**
   * Called with the chosen value, or an empty string for "no filter".
   */
  onChange: (value: string) => void;
}

/**
 * Dropdown for a single filter, always offering a leading "no filter" option
 * that clears the filter.
 *
 * @param props - Component props.
 * @param props.value - Currently selected value; empty means "no filter".
 * @param props.anyLabel - Label of the leading "no filter" option.
 * @param props.options - The selectable filter values.
 * @param props.placeholder - Placeholder shown while no value is selected.
 * @param props.ariaLabel - Accessible name for the trigger.
 * @param props.ariaLabelledBy - Id of the label describing this filter.
 * @param props.onChange - Called with the chosen value, empty for "no filter".
 * @returns The filter dropdown.
 */
export function FilterSelect({
  value,
  anyLabel,
  options,
  placeholder,
  ariaLabel,
  ariaLabelledBy,
  onChange,
}: FilterSelectProps) {
  return (
    <Select
      value={value || ANY_FILTER_VALUE}
      onValueChange={(next: string) => {
        onChange(next === ANY_FILTER_VALUE ? "" : next);
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className="h-10 rounded-md border font-medium"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY_FILTER_VALUE}>{anyLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
