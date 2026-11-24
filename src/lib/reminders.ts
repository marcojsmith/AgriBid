/** What the visitor decided in the browser's notification dialog. */
export type ReminderPermission = "granted" | "denied" | "unsupported";

/**
 * Asks the browser for notification permission after the visitor said Allow in
 * our own prompt. It only handles permission; `usePushReminders` then creates
 * the push subscription (`src/lib/push.ts`) and stores it with the reminder.
 *
 * @returns `granted`, `denied`, or `unsupported` when the browser has no Notification API
 */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result === "granted" ? "granted" : "denied";
}
