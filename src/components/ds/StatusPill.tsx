import { CheckCircle2, Clock, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/** The outcome of a lot once bidding has closed. */
export type LotOutcome = "sold" | "not-sold" | "under-consideration";

interface StatusPillProps {
  /** The lot outcome. */
  outcome: LotOutcome;
  /** Smaller text for use inside a lot card. */
  size?: "default" | "card";
  className?: string;
}

const CONFIG = {
  sold: {
    label: "Sold",
    classes: "bg-sold-soft text-sold-fg",
    Icon: CheckCircle2,
  },
  "not-sold": {
    label: "Not sold",
    classes: "bg-passed-soft text-passed-fg",
    Icon: Info,
  },
  "under-consideration": {
    label: "Under consideration",
    classes:
      "bg-transparent text-muted-foreground ring-1 ring-inset ring-border",
    Icon: Clock,
  },
} as const;

/**
 * The soft pill for a closed lot's outcome: Sold, Not sold or Under
 * consideration (the 48 hours when the seller decides on a bid below
 * reserve). Icon and text, never colour alone, and it never wraps.
 *
 * @param props - Component props
 * @param props.outcome - The lot outcome
 * @param props.size - `card` for the 13px size inside lot cards
 * @param props.className - Extra classes merged onto the root element
 * @returns The pill
 */
export function StatusPill({
  outcome,
  size = "default",
  className,
}: StatusPillProps) {
  const { label, classes, Icon } = CONFIG[outcome];
  return (
    <span
      data-slot="status-pill"
      data-outcome={outcome}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-sm px-2 py-0.5 leading-snug font-semibold whitespace-nowrap [&>svg]:size-3.5",
        size === "card" ? "text-[13px]" : "text-sm",
        classes,
        className
      )}
    >
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}
