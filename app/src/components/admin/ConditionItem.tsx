// app/src/components/admin/ConditionItem.tsx
import { Check, X } from "lucide-react";

/**
 * Render a compact labeled condition indicator that visually shows whether a condition passed or failed.
 *
 * @param label - The label for the condition
 * @param value - The boolean value indicating pass/fail
 * @returns A React element for the condition item
 */
export function ConditionItem({ label, value }: { label: string; value?: boolean }) {
  return (
    <div className="space-y-1 text-center md:text-left">
      <p className="text-[8px] font-black uppercase text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-1">
        {value === true ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : value === false ? (
          <X className="h-3 w-3 text-destructive" />
        ) : (
          <span className="h-3 w-3 text-muted-foreground">—</span>
        )}
        <span className="text-[10px] font-bold uppercase">
          {value === true ? "PASS" : value === false ? "FAIL" : "N/A"}
        </span>
      </div>
    </div>
  );
}
