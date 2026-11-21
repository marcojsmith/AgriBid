import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StickyActionBarProps {
  children: ReactNode;
  /** Accessible name of the bar. */
  label?: string;
  /** Hide the bar (e.g. while the bid panel is in view). */
  hidden?: boolean;
  className?: string;
}

/**
 * A bar fixed to the bottom of the screen on phones only (hidden from `md`),
 * padded for the device safe area. Put the primary action(s) inside.
 *
 * Use it for the one action that must stay reachable while scrolling a long
 * mobile page. The page needs bottom padding so content isn't covered.
 *
 * @param props - Component props
 * @param props.children
 * @param props.label
 * @param props.hidden
 * @param props.className
 * @returns The bar
 */
export function StickyActionBar({
  children,
  label = "Actions",
  hidden = false,
  className,
}: StickyActionBarProps) {
  if (hidden) return null;
  return (
    <div
      role="region"
      aria-label={label}
      data-slot="sticky-action-bar"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
