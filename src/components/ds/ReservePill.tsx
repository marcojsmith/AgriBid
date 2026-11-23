import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/** Reserve state of a lot: before any bid `applies`, then `not-met` or `met`, or `none`. */
export type ReserveState = "applies" | "met" | "not-met" | "none";

interface ReservePillProps {
  state: ReserveState;
  /** Smaller text for use inside a lot card. */
  size?: "default" | "card";
  className?: string;
}

const CONFIG = {
  applies: {
    label: "Reserve applies",
    classes:
      "bg-transparent text-muted-foreground ring-1 ring-inset ring-border",
    Icon: Info,
  },
  met: {
    label: "Reserve met",
    classes: "bg-ok-soft text-ok-fg",
    Icon: CheckCircle2,
  },
  "not-met": {
    label: "Reserve not met",
    classes: "bg-warn-soft text-warn-fg",
    Icon: AlertTriangle,
  },
  none: {
    label: "No reserve",
    classes: "bg-ok-soft text-ok-fg",
    Icon: CheckCircle2,
  },
} as const;

/**
 * Shows the reserve state of a lot, with an icon and text: "Reserve applies"
 * (neutral, before any bid), "Reserve not met", "Reserve met" or "No reserve".
 *
 * Use it in the bid panel and on lot cards. Do not show it for ended lots
 * (use `StatusPill`).
 *
 * @param props - Component props
 * @param props.state - Reserve state: applies, met, not-met or none
 * @param props.size - `card` for the 13px size inside lot cards
 * @param props.className - Extra classes merged onto the root element
 * @returns The reserve pill
 */
export function ReservePill({
  state,
  size = "default",
  className,
}: ReservePillProps) {
  const { label, classes, Icon } = CONFIG[state];
  return (
    <span
      data-slot="reserve-pill"
      data-state={state}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-sm px-2 py-0.5 leading-snug font-semibold whitespace-nowrap",
        size === "card"
          ? "text-[13px] [&>svg]:size-[13px]"
          : "text-sm [&>svg]:size-3.5",
        classes,
        className
      )}
    >
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}
