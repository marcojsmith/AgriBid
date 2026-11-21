import { CheckCircle2, CircleSlash, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

/** Reserve state of a lot. */
export type ReserveState = "met" | "not-met" | "none";

interface ReservePillProps {
  state: ReserveState;
  className?: string;
}

const MET = {
  label: "Reserve met",
  classes: "bg-live-soft text-live-fg",
  Icon: CheckCircle2,
};
const NOT_MET = {
  label: "Reserve not met",
  classes: "bg-soon-soft text-soon-fg",
  Icon: Lock,
};
const NONE = {
  label: "No reserve",
  classes: "bg-primary-soft text-primary",
  Icon: CircleSlash,
};

const reserveConfig = (state: ReserveState) =>
  state === "met" ? MET : state === "not-met" ? NOT_MET : NONE;

/**
 * Shows whether a lot's reserve has been met, with an icon and text.
 *
 * Use it in the bid panel and on lot cards. Do not show it for ended lots.
 *
 * @param props - Component props
 * @param props.state - Reserve state: met, not-met or none
 * @param props.className - Extra classes merged onto the root element
 * @returns The reserve pill
 */
export function ReservePill({ state, className }: ReservePillProps) {
  const { label, classes, Icon } = reserveConfig(state);
  return (
    <span
      data-slot="reserve-pill"
      data-state={state}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold [&>svg]:size-3",
        classes,
        className
      )}
    >
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}
