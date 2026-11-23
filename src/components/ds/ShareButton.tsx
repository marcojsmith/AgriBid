import { Share2 } from "lucide-react";

import { shareOrCopy, type SharePayload, type ShareResult } from "@/lib/share";
import { cn } from "@/lib/utils";

interface ShareButtonProps extends SharePayload {
  /** Called with the outcome, so the page can show "Link copied" or an error. */
  onResult?: (result: ShareResult) => void;
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
 * @param props.className - Extra classes merged onto the button
 * @returns The share button
 */
export function ShareButton({
  title,
  text,
  url,
  onResult,
  className,
}: ShareButtonProps) {
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
        "flex size-11 items-center justify-center rounded-md border border-border bg-card text-foreground",
        className
      )}
    >
      <Share2 aria-hidden="true" className="size-5" />
    </button>
  );
}
