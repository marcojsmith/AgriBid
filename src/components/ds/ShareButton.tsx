import { Share2 } from "lucide-react";

import { shareOrCopy, type SharePayload, type ShareResult } from "@/lib/share";
import { cn } from "@/lib/utils";

interface ShareButtonProps extends SharePayload {
  /** Called with the outcome, so the page can show "Link copied" or an error. */
  onResult?: (result: ShareResult) => void;
  /**
   * `boxed` (default) is the 44px bordered icon button. `overlay` matches
   * `WatchButton`: a 48px tap area with a 34px card circle, for use over photos.
   */
  variant?: "boxed" | "overlay";
  className?: string;
}

/**
 * The share button: a plain share glyph in a 44px boxed icon button that opens
 * the native share sheet, falling back to copying the link. Tell the user
 * about a `copied` or `failed` result with a toast in `onResult`.
 *
 * @param props - Component props
 * @param props.title - Title of the shared item
 * @param props.text - Prefill text
 * @param props.url - Absolute link to share
 * @param props.onResult - Called with the share outcome
 * @param props.variant - `boxed` (default) or `overlay` for use over photos
 * @param props.className - Extra classes merged onto the button
 * @returns The share button
 */
export function ShareButton({
  title,
  text,
  url,
  onResult,
  variant = "boxed",
  className,
}: ShareButtonProps) {
  const overlay = variant === "overlay";
  return (
    <button
      type="button"
      data-slot="share-button"
      aria-label="Share"
      onClick={() => {
        void shareOrCopy({ title, text, url }).then((result) => {
          onResult?.(result);
        });
      }}
      className={cn(
        overlay
          ? "flex size-12 items-center justify-center text-foreground"
          : "flex size-11 items-center justify-center rounded-md border border-border bg-card text-foreground",
        className
      )}
    >
      {overlay ? (
        <span className="flex size-[34px] items-center justify-center rounded-full bg-card/95 shadow-[0_1px_3px_rgb(0_0_0/.3)]">
          <Share2 aria-hidden="true" strokeWidth={2} className="size-[18px]" />
        </span>
      ) : (
        <Share2 aria-hidden="true" className="size-5" />
      )}
    </button>
  );
}
