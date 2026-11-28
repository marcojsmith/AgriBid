import { countdownTone, formatClosesIn } from "@/lib/countdown";
import { formatSastDate } from "@/lib/dates";
import { spokenRemaining } from "@/lib/myBids";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";

interface ClosesLineProps {
  /** When bidding closes (ms), including any soft-close extension. */
  closesAt: number;
}

/**
 * "Closes in 2h 30m · Wed 25 Nov, 11:00". The whole line turns amber under one
 * hour and red under ten minutes (the My bids rule), ticks every second and
 * says the time left in words for screen readers.
 *
 * @param props - Component props
 * @param props.closesAt - Closing time (ms)
 * @returns The line
 */
export function ClosesLine({ closesAt }: ClosesLineProps) {
  const now = useNow(1000);
  const remaining = closesAt - now;
  const tone = countdownTone(remaining);
  return (
    <p
      role="timer"
      aria-label={
        remaining > 0 ? `Closes in ${spokenRemaining(remaining)}` : "Closed"
      }
      data-tone={tone}
      className={cn(
        "num text-[15px] font-semibold",
        tone === "urgent"
          ? "text-urgent-fg"
          : tone === "warn"
            ? "text-warn-fg"
            : "text-foreground"
      )}
    >
      <span aria-hidden="true">
        {formatClosesIn(remaining)}
        <span
          className={cn("font-normal", tone !== "neutral" && "text-foreground")}
        >
          {" "}
          · {formatSastDate(closesAt)}
        </span>
      </span>
    </p>
  );
}
