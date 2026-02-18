import { CheckCircle2, AlertCircle, Info, XCircle } from "lucide-react";
import type { Id } from "convex/_generated/dataModel";

export function getNotificationIcon(type: string) {
  switch (type) {
    case "success": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "error": return <XCircle className="h-4 w-4 text-destructive" />;
    case "warning": return <AlertCircle className="h-4 w-4 text-orange-500" />;
    default: return <Info className="h-4 w-4 text-primary" />;
  }
}

export async function handleNotificationClick(
  notificationId: Id<"notifications">,
  link: string | undefined,
  navigate: (p: string) => void,
  markReadFn: (args: { notificationId: Id<"notifications"> }) => Promise<any>
) {
  try {
    await markReadFn({ notificationId });
  } catch (err) {
    console.error("Failed to mark notification as read:", err);
    throw err;
  } finally {
    if (link) navigate(link);
  }
}
