import type { MutationCtx } from "../_generated/server";

/**
 * Format money as shown in notifications, e.g. `R 428 000`.
 *
 * @param amount - The amount in rand.
 * @returns The formatted amount.
 */
export function formatNotificationRand(amount: number): string {
  return `R ${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

/**
 * Insert an in-app notification for one user.
 *
 * Lives here (re-exported from `auctions/internal`) so library modules that
 * `auctions/internal` itself imports can notify without an import cycle.
 *
 * @param ctx - The mutation context.
 * @param notification - Recipient and content.
 * @param notification.recipientId - The user to notify.
 * @param notification.type - Severity/tone of the notification.
 * @param notification.title - Short heading.
 * @param notification.message - Body text.
 * @param notification.link - In-app path the notification opens.
 */
export async function notifyUser(
  ctx: MutationCtx,
  notification: {
    recipientId: string;
    type: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
    link: string;
  }
): Promise<void> {
  await ctx.db.insert("notifications", {
    ...notification,
    isRead: false,
    createdAt: Date.now(),
  });
}
