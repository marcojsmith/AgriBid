import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** One specification row. */
export interface SpecItem {
  label: string;
  /** Rows with an empty value are not rendered. */
  value?: ReactNode;
}

interface SpecTableProps {
  items: readonly SpecItem[];
  className?: string;
}

/**
 * Key/value specifications as a semantic `<dl>`. Rows without a value are
 * dropped, so unknown specs never show "N/A".
 *
 * Use it for lot specifications (make, model, year, hours...).
 *
 * @param props - Component props
 * @param props.items - Specification rows; rows without a value are dropped
 * @param props.className - Extra classes merged onto the root element
 * @returns The spec list, or null when nothing has a value
 */
export function SpecTable({ items, className }: SpecTableProps) {
  const rows = items.filter(
    (i) => i.value !== undefined && i.value !== null && i.value !== ""
  );
  if (rows.length === 0) return null;
  return (
    <dl
      data-slot="spec-table"
      className={cn("divide-y divide-border text-sm", className)}
    >
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4 py-2">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="text-right font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
