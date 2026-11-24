import type { ReactNode } from "react";
import { AlertTriangle, Check, Clock, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

/** One row of the registration status list. */
export interface RegStatusRow {
  key: string;
  title: string;
  sub: ReactNode;
  /** ok: approved or saved. pending: under review. bad: needs replacing. neutral: not started. */
  tone: "ok" | "pending" | "bad" | "neutral";
  /** A link or button shown on the right ("Pay now", "Replace"). */
  action?: ReactNode;
}

interface RegStatusListProps {
  rows: readonly RegStatusRow[];
  className?: string;
}

const TONES = {
  ok: { classes: "bg-ok-soft text-ok-fg", Icon: Check, icon: "check" },
  pending: { classes: "bg-warn-soft text-warn-fg", Icon: Clock, icon: "clock" },
  bad: {
    classes: "bg-urgent-soft text-urgent-fg",
    Icon: AlertTriangle,
    icon: "alert",
  },
  neutral: {
    classes: "bg-muted text-muted-foreground",
    Icon: FileText,
    icon: "file",
  },
} as const;

/**
 * The "Your registration" checklist: a divided list where each row has a 32px
 * round icon (colour and glyph by tone, never colour alone), a 16px/600 title,
 * a 14px muted sub line and an optional action on the right.
 *
 * @param props - Component props
 * @param props.rows - The rows, in order
 * @param props.className - Extra classes merged onto the list
 * @returns The list
 */
export function RegStatusList({ rows, className }: RegStatusListProps) {
  return (
    <ul
      data-slot="reg-status-list"
      className={cn("m-0 mb-4 list-none border-b border-border p-0", className)}
    >
      {rows.map((row) => {
        const { classes, Icon, icon } = TONES[row.tone];
        return (
          <li
            key={row.key}
            className="flex items-center gap-3 border-t border-border py-3.5"
          >
            <span
              data-slot="reg-status-icon"
              data-icon={icon}
              className={cn(
                "flex size-8 flex-none items-center justify-center rounded-full",
                classes
              )}
            >
              <Icon aria-hidden="true" className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-base font-semibold">{row.title}</b>
              <small className="mt-px block text-sm text-muted-foreground">
                {row.sub}
              </small>
            </span>
            {row.action ? (
              <span className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-[15px] font-semibold text-primary underline">
                {row.action}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
