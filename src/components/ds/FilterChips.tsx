import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/** One active filter. */
export interface ActiveFilter {
  key: string;
  label: string;
}

interface FilterChipsProps {
  filters: readonly ActiveFilter[];
  onRemove: (key: string) => void;
  onClear: () => void;
  className?: string;
}

/**
 * The active filters as removable chips plus a "Clear filters" button.
 * Renders nothing when no filter is active.
 *
 * Use it above a filtered list so users can see and undo what narrows it.
 *
 * @param props - Component props
 * @param props.filters
 * @param props.onRemove
 * @param props.onClear
 * @param props.className
 * @returns The chips, or null
 */
export function FilterChips({
  filters,
  onRemove,
  onClear,
  className,
}: FilterChipsProps) {
  if (filters.length === 0) return null;
  return (
    <div
      data-slot="filter-chips"
      role="group"
      aria-label="Active filters"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          aria-label={`Remove filter: ${f.label}`}
          onClick={() => {
            onRemove(f.key);
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm bg-primary-soft px-2.5 text-[13px] font-medium text-primary md:min-h-8"
        >
          {f.label}
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="min-h-11 px-2 text-[13px] font-medium text-primary underline underline-offset-4 md:min-h-8"
      >
        Clear filters
      </button>
    </div>
  );
}
