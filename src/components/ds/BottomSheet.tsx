import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog } from "radix-ui";

import { cn } from "@/lib/utils";

interface BottomSheetProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Called when the user closes it (close button, scrim, Escape). */
  onOpenChange: (open: boolean) => void;
  /** The 20px Lora title, also the accessible name. */
  title: string;
  /** The body: rows, numbered steps or a form. */
  children: ReactNode;
  /** The action buttons under the body. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The bottom sheet shell: `card` background, 8px top radius, a 36 by 4px grab
 * bar, a 20px Lora title with a 44px close button, the body, then actions.
 * Built on the Radix dialog (focus trap, Escape, scrim) so it is a real modal.
 * Use it for Fees & rules, confirm bid and Add to Home Screen.
 *
 * @param props - Component props
 * @param props.open - Whether the sheet is open
 * @param props.onOpenChange - Called when the sheet asks to open or close
 * @param props.title - Sheet title
 * @param props.children - The body
 * @param props.actions - The action buttons
 * @param props.className - Extra classes merged onto the sheet
 * @returns The sheet
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  actions,
  className,
}: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-slot="bottom-sheet-overlay"
          className="fixed inset-0 z-50 bg-[rgb(0_0_0/.5)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <Dialog.Content
          data-slot="bottom-sheet"
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full flex-col overflow-y-auto rounded-t-lg border-t border-border bg-card px-4 pt-2 pb-5 md:max-w-lg",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
            className
          )}
        >
          <div
            aria-hidden="true"
            className="mx-auto mt-0.5 mb-1.5 h-1 w-9 shrink-0 rounded-[2px] bg-border"
          />
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-display text-xl leading-tight font-semibold">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="-mr-2 flex size-11 items-center justify-center text-foreground"
            >
              <X aria-hidden="true" className="size-[22px]" />
            </Dialog.Close>
          </div>
          <div className="mt-1">{children}</div>
          {actions ? (
            <div data-slot="bottom-sheet-actions" className="mt-4 flex gap-2">
              {actions}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
