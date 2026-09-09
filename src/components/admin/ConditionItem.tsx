// app/src/components/admin/ConditionItem.tsx
import { Check, X } from "lucide-react";

/**
 * Renders a compact labeled condition indicator.
 *
 * Displays a green check and "Pass" when `value` is `true`, a destructive X and "Fail" when `value` is `false`, or a muted dash and "N/A" when `value` is `undefined`.
 *
 * @param label.label
 * @param label - The condition label shown above the status
 * @param value - Optional boolean indicating condition state: `true` = pass, `false` = fail, `undefined` = unavailable
 * @param label.value
 * @returns A JSX element representing the labeled condition indicator
 */
export function ConditionItem({
  label,
  value,
}: {
  label: string;
  value?: boolean;
}) {
  return (
    <div className="space-y-1 text-center md:text-left">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        {value === true ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : value === false ? (
          <X className="h-3 w-3 text-destructive" />
        ) : (
          <span className="h-3 w-3 text-muted-foreground">—</span>
        )}
        <span className="text-xs font-semibold">
          {value === true ? "Pass" : value === false ? "Fail" : "N/A"}
        </span>
      </div>
    </div>
  );
}
