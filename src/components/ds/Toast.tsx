import type { ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** How a toast reads: a confirmation or a failure. */
export type ToastTone = "success" | "error";

interface ToastProps {
  children: ReactNode;
  /** success (default): check icon. error: alert icon and a destructive tint. */
  tone?: ToastTone;
  className?: string;
}

/**
 * The toast: a dark 6px-radius message with a check icon and white 15px text.
 * The error tone swaps the icon for an alert and tints the background
 * destructive.
 * It floats 16px from both sides and 24px above the bottom of the screen; the
 * floating layer is the one place shadows are allowed.
 *
 * This is the presentation only. Show it with `showToast` (Sonner), or render
 * it directly in a fixed container.
 *
 * @param props - Component props
 * @param props.children - The message, e.g. "Watching. We'll notify you 1 hour before close and if you're outbid."
 * @param props.tone - success (default) or error
 * @param props.className - Extra classes merged onto the root element
 * @returns The toast
 */
export function Toast({ children, tone = "success", className }: ToastProps) {
  const Icon = tone === "error" ? AlertCircle : Check;
  return (
    <div
      role="status"
      data-slot="toast"
      data-tone={tone}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md px-3.5 py-3 text-[15px] leading-snug text-white shadow-[0_4px_16px_rgb(0_0_0/.3)]",
        tone === "error" ? "bg-destructive" : "bg-[rgb(24_28_24/.96)]",
        className
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />
      <span>{children}</span>
    </div>
  );
}
