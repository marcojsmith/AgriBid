import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";

interface PermissionPromptProps {
  open: boolean;
  /** Called with false for "Not now" and Escape. */
  onOpenChange: (open: boolean) => void;
  /** Called when the visitor taps Allow. */
  onAllow: () => void;
  /** The sentence under the title, e.g. "So we can tell you when this sale opens." */
  description: string;
  /** The confirm button text; defaults to "Allow". */
  allowLabel?: string;
}

/**
 * The pre-permission prompt shown before the browser's own notification
 * dialog: "Allow notifications?" with Not now and Allow. Asking in our own
 * words first means a "Not now" does not burn the one-shot browser prompt.
 *
 * @param props - Component props
 * @param props.open - Whether the prompt is open
 * @param props.onOpenChange - Called when the prompt asks to open or close
 * @param props.onAllow - Called on Allow
 * @param props.description - The sentence under the title
 * @param props.allowLabel - The confirm button text (default "Allow")
 * @returns The prompt
 */
export function PermissionPrompt({
  open,
  onOpenChange,
  onAllow,
  description,
  allowLabel = "Allow",
}: PermissionPromptProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(0_0_0/.5)]" />
        <Dialog.Content
          data-slot="permission-prompt"
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-4 text-center"
        >
          <Dialog.Title className="font-display text-xl font-semibold">
            Allow notifications?
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-[15px] text-muted-foreground">
            {description}
          </Dialog.Description>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Not now
            </Button>
            <Button className="flex-1" onClick={onAllow}>
              {allowLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
