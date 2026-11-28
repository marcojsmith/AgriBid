import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** Which badge a My bids row wears. */
export type RowBadgeKind =
  | "outbid"
  | "leading"
  | "extended"
  | "consideration"
  | "won"
  | "lost"
  | "not-sold";

/**
 * The colour classes and icon of a badge kind.
 *
 * @param kind - The badge kind
 * @returns Classes and icon
 */
function configOf(kind: RowBadgeKind): { classes: string; Icon: LucideIcon } {
  switch (kind) {
    case "outbid":
      return { classes: "bg-warn-soft text-warn-fg", Icon: AlertTriangle };
    case "leading":
    case "won":
      return { classes: "bg-ok-soft text-ok-fg", Icon: CheckCircle2 };
    case "extended":
      return { classes: "bg-urgent-soft text-urgent-fg", Icon: Clock };
    case "consideration":
      return {
        classes:
          "bg-transparent text-muted-foreground ring-1 ring-inset ring-border",
        Icon: Clock,
      };
    case "lost":
    case "not-sold":
      return { classes: "bg-passed-soft text-passed-fg", Icon: Info };
  }
}

interface RowBadgeProps {
  kind: RowBadgeKind;
  children: ReactNode;
}

/**
 * The soft pill at the top of a My bids row: the buyer's position on a lot
 * (Outbid, Leading, Extended), what is happening to it (Under consideration)
 * or how it ended (Won, Paid, Lost, Not sold). Icon and text, never colour
 * alone, and it never wraps.
 *
 * @param props - Component props
 * @param props.kind - Chooses the colour and icon
 * @param props.children - The label
 * @returns The pill
 */
export function RowBadge({ kind, children }: RowBadgeProps) {
  const { classes, Icon } = configOf(kind);
  return (
    <span
      data-slot="row-badge"
      data-kind={kind}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-sm px-2 py-0.5 text-sm leading-snug font-semibold whitespace-nowrap [&>svg]:size-3.5",
        classes
      )}
    >
      <Icon aria-hidden="true" />
      {children}
    </span>
  );
}
