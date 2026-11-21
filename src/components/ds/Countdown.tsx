import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import {
  countdownTone,
  formatRemaining,
  type CountdownTone,
} from "@/lib/countdown";
import { formatSastDate } from "@/lib/dates";

const TONE_CLASS: Record<CountdownTone, string> = {
  neutral: "text-foreground",
  warn: "text-warn-fg",
  urgent: "text-urgent-fg",
};

interface CountdownProps {
  /** End time in ms since epoch; null/undefined shows "TBD". */
  endTime?: number | null;
  /** Show the absolute SAST end time (`Sat 22 Nov, 10:00 SAST`) instead of a live countdown. */
  absolute?: boolean;
  className?: string;
}

/**
 * Time remaining for an auction or lot. Neutral by default, amber under one
 * hour, red under two minutes, tabular figures (no monospace). With
 * `absolute` it shows the SAST closing time instead.
 *
 * Use it for every closing time. Add the label ("Closes in") yourself.
 *
 * @param props - Component props
 * @param props.endTime - End time in ms since epoch (null shows TBD)
 * @param props.absolute - Show the SAST closing time instead of a countdown
 * @param props.className - Extra classes
 * @returns The countdown text
 */
export function Countdown({
  endTime,
  absolute = false,
  className,
}: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (absolute || endTime === undefined || endTime === null) return;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (endTime - current <= 0) clearInterval(interval);
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [endTime, absolute]);

  const base = cn("num font-semibold", className);

  if (endTime === undefined || endTime === null) {
    return <span className={cn(base, "text-muted-foreground")}>TBD</span>;
  }
  if (absolute) {
    return <span className={base}>{formatSastDate(endTime)}</span>;
  }
  const remaining = endTime - now;
  if (remaining <= 0) {
    return <span className={cn(base, "text-muted-foreground")}>Ended</span>;
  }
  const tone = countdownTone(remaining);
  return (
    <span data-tone={tone} className={cn(base, TONE_CLASS[tone])}>
      {formatRemaining(remaining)}
    </span>
  );
}
