import { CheckCircle2, AlertCircle, Info, XCircle } from "lucide-react";
import type { Id } from "convex/_generated/dataModel";

/**
 * Selects an icon component that represents a notification type.
 *
 * @param type - Notification type; supported values: "success", "error", "warning". Any other value selects the default informational icon.
 * @returns The JSX icon element corresponding to the provided notification type.
 */
export function getNotificationIcon(type: string) {
  switch (type) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    default:
      return <Info className="h-4 w-4 text-primary" />;
  }
}

/**
 * Mark a notification as read and navigate to an optional link.
 *
 * @param notificationId - Id of the notification to mark as read
 * @param link - Optional path to navigate to after handling the notification
 * @param navigate - Function that performs navigation to the given path
 * @param markReadFn - Async function that marks the notification as read; called with `{ notificationId }`
 * @description Errors from markReadFn are caught and logged to the console; navigation still occurs if a link is provided.
 */
export async function handleNotificationClick(
  notificationId: Id<"notifications">,
  link: string | undefined,
  navigate: (p: string) => void,
  markReadFn: (args: {
    notificationId: Id<"notifications">;
  }) => Promise<unknown>,
) {
  try {
    await markReadFn({ notificationId });
    if (link) navigate(link);
  } catch (err) {
    console.error("Failed to mark notification as read:", err);
    // If marking read fails, we still navigate if requested, but swallow error to prevent UI crash
    if (link) navigate(link);
  }
}
