import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface IconListProps {
  children: ReactNode;
  className?: string;
}

interface IconRowProps {
  /** The lucide icon, drawn 18px in the `primary` colour. */
  icon: LucideIcon;
  /** The row text. May contain links. */
  children: ReactNode;
  /** Use the 14px light-on-green style of the dark band. */
  onDark?: boolean;
  className?: string;
}

/**
 * The list that holds `IconRow`s (a `ul` with no markers).
 *
 * @param props - Component props
 * @param props.children - The rows
 * @param props.className - Extra classes merged onto the list
 * @returns The list
 */
export function IconList({ children, className }: IconListProps) {
  return (
    <ul data-slot="icon-list" className={cn("m-0 list-none p-0", className)}>
      {children}
    </ul>
  );
}

/**
 * One row of an icon list: an 18px icon and 15px text with 6px of vertical
 * padding (14px on the dark band). Used for condition rows, "Before you bid"
 * terms and seller facts.
 *
 * @param props - Component props
 * @param props.icon - The lucide icon
 * @param props.children - The row text
 * @param props.onDark - 14px light-on-green style
 * @param props.className - Extra classes merged onto the row
 * @returns The list item
 */
export function IconRow({
  icon: Icon,
  children,
  onDark = false,
  className,
}: IconRowProps) {
  return (
    <li
      data-slot="icon-row"
      className={cn(
        "flex gap-2.5 py-1.5",
        onDark ? "text-sm text-hero-muted" : "text-[15px]",
        className
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-[3px] size-[18px] shrink-0",
          onDark ? "text-hero-muted" : "text-primary"
        )}
      />
      <span>{children}</span>
    </li>
  );
}
