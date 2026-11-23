import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface ToastProps {
  children: ReactNode;
  className?: string;
}

/**
 * The toast: a dark 6px-radius message with a check icon and white 15px text.
 * It floats 16px from both sides and 24px above the bottom of the screen; the
 * floating layer is the one place shadows are allowed.
 *
 * This is the presentation only. Show it with `showToast` (Sonner), or render
 * it directly in a fixed container.
 *
 * @param props - Component props
 * @param props.children - The message, e.g. "Watching. We'll notify you 1 hour before close and if you're outbid."
 * @param props.className - Extra classes merged onto the root element
 * @returns The toast
 */
export function Toast({ children, className }: ToastProps) {
  return (
    <div
      role="status"
      data-slot="toast"
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md bg-[rgb(24_28_24/.96)] px-3.5 py-3 text-[15px] leading-snug text-white shadow-[0_4px_16px_rgb(0_0_0/.3)]",
        className
      )}
    >
      <Check aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />
      <span>{children}</span>
    </div>
  );
}
