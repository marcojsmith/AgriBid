import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  /** Section title (rendered as an h2). */
  title: string;
  /** Controls aligned to the right (sort, view toggle, link). */
  controls?: ReactNode;
  id?: string;
  className?: string;
}

/**
 * A section heading with an optional right-aligned controls group, sharing a
 * baseline. Wraps on narrow screens.
 *
 * Use it to open every page section so headings stay consistent.
 *
 * @param props - Component props
 * @param props.title - Section title, rendered as an h2
 * @param props.controls - Controls aligned to the right of the title
 * @param props.id - Id for the heading element
 * @param props.className - Extra classes merged onto the root element
 * @returns The header
 */
export function SectionHeader({
  title,
  controls,
  id,
  className,
}: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2",
        className
      )}
    >
      <h2 id={id} className="text-[22px] leading-tight">
        {title}
      </h2>
      {controls ? (
        <div className="flex items-baseline gap-3">{controls}</div>
      ) : null}
    </div>
  );
}
