import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DRIVE_OPTIONS,
  getLotSpecsError,
  parseDrive,
  parseOptionalNumber,
  type LotSpecValues,
} from "@/lib/lotSpecs";

/** Props for {@link LotSpecsFields}. */
export interface LotSpecsFieldsProps {
  /** Current spec values. */
  values: LotSpecValues;
  /** Called with the changed field(s). */
  onChange: (patch: Partial<LotSpecValues>) => void;
  /** Prefix that keeps input ids unique when several forms are mounted. */
  idPrefix: string;
  /** Disables every input. */
  disabled?: boolean;
}

/**
 * Compact grid of the optional machine spec inputs (power, drive, transmission,
 * tyre condition, serial number) with inline range validation.
 *
 * @param props - Component props
 * @param props.values - Current spec values
 * @param props.onChange - Called with the changed field
 * @param props.idPrefix - Prefix that keeps input ids unique
 * @param props.disabled - Disables every input
 * @returns The fields and an inline error line when a value is out of range
 */
export function LotSpecsFields({
  values,
  onChange,
  idPrefix,
  disabled = false,
}: LotSpecsFieldsProps) {
  const error = getLotSpecsError(values);
  const errorId = `${idPrefix}-error`;
  const describedBy = error ? errorId : undefined;

  const numberField = (
    key: "powerKw" | "frontTyrePct" | "rearTyrePct",
    label: string,
    max: number
  ) => (
    <div className="space-y-1">
      <Label htmlFor={`${idPrefix}-${key}`}>{label}</Label>
      <Input
        id={`${idPrefix}-${key}`}
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        value={values[key] ?? ""}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => {
          onChange({ [key]: parseOptionalNumber(event.target.value) });
        }}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {numberField("powerKw", "Power (kW)", 2000)}
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-drive`}>Drive</Label>
          <select
            id={`${idPrefix}-drive`}
            value={values.drive ?? ""}
            disabled={disabled}
            onChange={(event) => {
              onChange({ drive: parseDrive(event.target.value) });
            }}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-base md:text-sm"
          >
            <option value="">Not set</option>
            {DRIVE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 space-y-1 sm:col-span-1">
          <Label htmlFor={`${idPrefix}-transmission`}>Transmission</Label>
          <Input
            id={`${idPrefix}-transmission`}
            value={values.transmission ?? ""}
            disabled={disabled}
            aria-describedby={describedBy}
            onChange={(event) => {
              onChange({ transmission: event.target.value });
            }}
          />
        </div>
        {numberField("frontTyrePct", "Front tyre (%)", 100)}
        {numberField("rearTyrePct", "Rear tyre (%)", 100)}
        <div className="col-span-2 space-y-1 sm:col-span-1">
          <Label htmlFor={`${idPrefix}-serialNumber`}>Serial number</Label>
          <Input
            id={`${idPrefix}-serialNumber`}
            value={values.serialNumber ?? ""}
            disabled={disabled}
            aria-describedby={describedBy}
            onChange={(event) => {
              onChange({ serialNumber: event.target.value });
            }}
          />
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
