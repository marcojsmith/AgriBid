import { toast } from "sonner";

import { Toast } from "./Toast";

/**
 * Shows the design-system `Toast` through Sonner (the app already mounts a
 * `Toaster` in `main.tsx`), at the bottom of the screen.
 *
 * @param message - The message to show
 * @returns The Sonner toast id, usable to dismiss it
 */
export function showToast(message: string): string | number {
  return toast.custom(() => <Toast>{message}</Toast>, {
    position: "bottom-center",
  });
}
