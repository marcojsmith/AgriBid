import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";

interface WatchButtonProps {
  /** Whether the user is watching the lot. */
  watching: boolean;
  /** Called when the user taps the heart. */
  onToggle: () => void;
  /** What is being watched, e.g. "lot 3, John Deere 8370RT". Defaults to "this lot". */
  subject?: string;
  className?: string;
}

/**
 * The watch heart: a 34px solid circle with a 48px tap area, meant to float on
 * a photo (position it with `className`). Filled red when watching. The
 * accessible name changes with the state ("Watch this lot" / "Watching this
 * lot"), so the state is never colour alone.
 *
 * @param props - Component props
 * @param props.watching - Whether the lot is being watched
 * @param props.onToggle - Called on tap
 * @param props.subject - What is watched, used in the accessible name
 * @param props.className - Extra classes merged onto the button
 * @returns The watch button
 */
export function WatchButton({
  watching,
  onToggle,
  subject = "this lot",
  className,
}: WatchButtonProps) {
  return (
    <button
      type="button"
      data-slot="watch-button"
      data-watching={watching}
      aria-label={`${watching ? "Watching" : "Watch"} ${subject}`}
      onClick={onToggle}
      className={cn(
        "flex size-12 items-center justify-center text-foreground",
        className
      )}
    >
      <span className="flex size-[34px] items-center justify-center rounded-full bg-card/95 shadow-[0_1px_3px_rgb(0_0_0/.3)]">
        <Heart
          aria-hidden="true"
          strokeWidth={2}
          className={cn(
            "size-[18px]",
            watching && "fill-watch-on stroke-watch-on"
          )}
        />
      </span>
    </button>
  );
}
