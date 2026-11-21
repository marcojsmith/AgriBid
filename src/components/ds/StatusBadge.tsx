import { cva } from "class-variance-authority";
import { CheckCircle2, Clock, MinusCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatSastDate } from "@/lib/dates";
import type { DisplayStatus } from "@/lib/auction-badges";

type Tone = "live" | "soon" | "urgent" | "sold" | "passed";

const SOLID = cva("", {
  variants: {
    tone: {
      live: "bg-live-solid text-white",
      soon: "bg-soon-solid text-white",
      urgent: "bg-urgent-solid text-white",
      sold: "bg-sold-solid text-white",
      passed: "bg-passed-solid text-white",
    },
  },
});

const SOFT = cva("", {
  variants: {
    tone: {
      live: "bg-live-soft text-live-fg",
      soon: "bg-soon-soft text-soon-fg",
      urgent: "bg-urgent-soft text-urgent-fg",
      sold: "bg-sold-soft text-sold-fg",
      passed: "bg-passed-soft text-passed-fg",
    },
  },
});

interface StatusBadgeProps {
  /** Status from `deriveDisplayStatus`. */
  status: DisplayStatus;
  /** `solid` for use on photos, `soft` on plain surfaces. */
  variant?: "solid" | "soft";
  className?: string;
}

/**
 * Maps a display status to its tone, label and icon. The icon and text carry
 * the meaning so status is never conveyed by colour alone.
 *
 * @param status - The display status
 * @returns Tone, visible label and a decorative icon element
 */
function describeStatus(status: DisplayStatus): {
  tone: Tone;
  label: string;
  icon: React.ReactNode;
} {
  switch (status.kind) {
    case "live":
      return {
        tone: "live",
        label: "Live",
        icon: <span aria-hidden="true">●</span>,
      };
    case "closing-soon":
      return {
        tone: status.urgent ? "urgent" : "soon",
        label: "Closing soon",
        icon: <Clock aria-hidden="true" />,
      };
    case "opens":
      return {
        tone: "soon",
        label: `Opens ${formatSastDate(status.startTime)}`,
        icon: <Clock aria-hidden="true" />,
      };
    case "sold":
      return {
        tone: "sold",
        label: "Sold",
        icon: <CheckCircle2 aria-hidden="true" />,
      };
    case "passed":
      return {
        tone: "passed",
        label: "Passed in",
        icon: <MinusCircle aria-hidden="true" />,
      };
  }
}

/**
 * The single status indicator for auctions and lots: Live, Opens {date},
 * Closing soon (urgent inside the last hour), Sold, Passed in.
 *
 * Use it anywhere an auction or lot shows its state. Do not hand-roll badges
 * from `Badge` colours for status.
 *
 * @param props - Component props
 * @param props.status - The display status from deriveDisplayStatus
 * @param props.variant - solid (on photos) or soft (on plain surfaces)
 * @param props.className - Extra classes merged onto the root element
 * @returns The status badge
 */
export function StatusBadge({
  status,
  variant = "solid",
  className,
}: StatusBadgeProps) {
  const { tone, label, icon } = describeStatus(status);
  return (
    <span
      data-slot="status-badge"
      data-tone={tone}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold [&>svg]:size-3",
        variant === "solid" ? SOLID({ tone }) : SOFT({ tone }),
        className
      )}
    >
      {icon}
      {label}
    </span>
  );
}
