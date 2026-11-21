import {
  PROVINCES,
  PROVINCE_LABELS,
  isProvince,
  type Province,
} from "@/lib/provinces";
import { cn } from "@/lib/utils";

/**
 * Props for {@link ProvinceSelect}.
 */
export interface ProvinceSelectProps {
  /** DOM id, used to associate an external `<label htmlFor>`. */
  id: string;
  /** Currently selected province, or undefined when none is chosen. */
  value: Province | undefined;
  /** Called with the chosen province. */
  onChange: (province: Province) => void;
  /** Extra classes for the select element. */
  className?: string;
  /** Disables the control. */
  disabled?: boolean;
}

/**
 * A native select listing the nine South African provinces. A native control
 * keeps the picker accessible and thumb-friendly on mobile.
 *
 * @param props - Component props.
 * @param props.id - DOM id for the label association.
 * @param props.value - Selected province, if any.
 * @param props.onChange - Called with the chosen province.
 * @param props.className - Extra classes for the select.
 * @param props.disabled - Disables the control.
 * @returns The rendered province select.
 */
export function ProvinceSelect({
  id,
  value,
  onChange,
  className,
  disabled,
}: ProvinceSelectProps) {
  return (
    <select
      id={id}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => {
        const next = event.target.value;
        if (isProvince(next)) onChange(next);
      }}
      className={cn(
        "border-input bg-background h-12 w-full rounded-md border px-3 text-base md:text-sm disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <option value="" disabled>
        Select a province
      </option>
      {PROVINCES.map((province) => (
        <option key={province} value={province}>
          {PROVINCE_LABELS[province]}
        </option>
      ))}
    </select>
  );
}
