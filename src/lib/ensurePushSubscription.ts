import { subscribeToPush, type PushSubscriptionKeys } from "@/lib/push";

/**
 * Makes sure this browser has a push subscription and that the server has it
 * saved for the signed-in user. Notification permission must already be
 * granted. Shared by "Remind me when it opens" and the watched-lot alerts.
 *
 * @param vapidKey - The server's public VAPID key
 * @param save - Stores the subscription for the signed-in user
 * @throws Error when the browser cannot subscribe or the save fails
 */
export async function ensurePushSubscription(
  vapidKey: string,
  save: (subscription: PushSubscriptionKeys) => Promise<unknown>
): Promise<void> {
  await save(await subscribeToPush(vapidKey));
}
