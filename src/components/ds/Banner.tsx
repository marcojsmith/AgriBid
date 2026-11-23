import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/** What the banner says about the user's own state. */
export type BannerKind = "ok" | "warn" | "urgent" | "info" | "sold";

interface BannerProps {
  /** ok: You're leading. warn: You've been outbid. urgent: bidding extended. info: under consideration. sold: the lot sold. */
  kind: BannerKind;
  children: ReactNode;
  className?: string;
}

const CONFIG = {
  ok: { classes: "bg-ok-soft text-ok-fg", Icon: CheckCircle2 },
  warn: { classes: "bg-warn-soft text-warn-fg", Icon: AlertTriangle },
  urgent: { classes: "bg-urgent-soft text-urgent-fg", Icon: Clock },
  info: { classes: "bg-primary-soft text-foreground", Icon: Info },
  sold: { classes: "bg-sold-soft text-sold-fg", Icon: CheckCircle2 },
} as const;

/**
 * A full-width banner for the user's own state on a lot ("You're leading",
 * "You've been outbid"): 15px/600, 6px radius, 18px icon. Icon and text, never
 * colour alone. A `StatusBadge` names a sale and a `StatusPill` names a lot;
 * the banner names what it means for this user.
 *
 * @param props - Component props
 * @param props.kind - ok, warn, urgent, info or sold
 * @param props.children - The message
 * @param props.className - Extra classes merged onto the root element
 * @returns The banner
 */
export function Banner({ kind, children, className }: BannerProps) {
  const { classes, Icon } = CONFIG[kind];
  return (
    <div
      role={kind === "warn" || kind === "urgent" ? "alert" : "status"}
      data-slot="banner"
      data-kind={kind}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-[15px] leading-snug font-semibold",
        classes,
        className
      )}
    >
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      <span>{children}</span>
    </div>
  );
}
