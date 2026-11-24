import { toast } from "sonner";

import { Toast, type ToastTone } from "./Toast";

/**
 * Shows the design-system `Toast` through Sonner (the app already mounts a
 * `Toaster` in `main.tsx`), at the bottom of the screen.
 *
 * @param message - The message to show
 * @param tone - success (default) or error
 * @returns The Sonner toast id, usable to dismiss it
 */
export function showToast(
  message: string,
  tone: ToastTone = "success"
): string | number {
  return toast.custom(() => <Toast tone={tone}>{message}</Toast>, {
    position: "bottom-center",
  });
}
