import { cn } from "@/lib/utils";

interface RegProgressProps {
  /** The current step, counted from 1. */
  step: number;
  /** How many steps the flow has (4 for SA ID and passport with deposit, 3 without). */
  total: 3 | 4;
  /** The name of the current step, e.g. "ID". */
  label: string;
  className?: string;
}

/**
 * The registration progress bar: `total` segments (4px high, 4px apart), done
 * segments solid `primary`, the current one `primary` at 55%, the rest
 * `border`. Below it "**Step 2 of 4** · ID". The root carries the full text as
 * its accessible name and the bar is hidden from assistive tech.
 *
 * @param props - Component props
 * @param props.step - The current step, from 1
 * @param props.total - 3 or 4 steps
 * @param props.label - The name of the current step
 * @param props.className - Extra classes merged onto the root element
 * @returns The progress indicator
 */
export function RegProgress({
  step,
  total,
  label,
  className,
}: RegProgressProps) {
  const segments = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div
      role="group"
      aria-label={`Step ${String(step)} of ${String(total)}, ${label}`}
      data-slot="reg-progress"
      className={cn("mt-1 mb-3.5", className)}
    >
      <div
        aria-hidden="true"
        data-slot="reg-progress-bar"
        className="flex gap-1"
      >
        {segments.map((n) => {
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <i
              key={n}
              data-segment=""
              data-state={state}
              className={cn(
                "block h-1 flex-1 rounded",
                state === "done" && "bg-primary",
                state === "current" && "bg-primary/55",
                state === "todo" && "bg-border"
              )}
            />
          );
        })}
      </div>
      <p aria-hidden="true" className="mt-2 mb-0 text-sm text-muted-foreground">
        <b className="font-semibold text-foreground">
          {`Step ${String(step)} of ${String(total)}`}
        </b>
        {` · ${label}`}
      </p>
    </div>
  );
}
