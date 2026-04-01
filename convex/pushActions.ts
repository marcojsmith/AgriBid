"use node";

import webpush from "web-push";
import { v } from "convex/values";

import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";

/** Push notification payload shape sent to the browser. */
interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: { url?: string; unreadCount?: number };
}

/**
 * Sends a push notification to all devices of a specific user.
 * Called by the notification creation flow when push is enabled.
 *
 * @param userId - The user to send push to
 * @param payload - Notification content
 */
export const sendPushToUser = internalAction({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    icon: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx: ActionCtx, args) => {
    const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const contactEmail = process.env.VAPID_CONTACT_EMAIL;

    if (!publicKey || !privateKey || !contactEmail) {
      throw new Error(
        "Missing VAPID environment variables. Set VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_CONTACT_EMAIL."
      );
    }
    webpush.setVapidDetails(`mailto:${contactEmail}`, publicKey, privateKey);

    const subscriptions = await ctx.runQuery(
      internal.pushQueries.getSubscriptionsForUser,
      { userId: args.userId }
    );

    if (subscriptions.length === 0) return null;

    const payload: PushPayload = {
      title: args.title,
      body: args.body,
      icon: args.icon ?? "/icons/icon-192x192.png",
      data: { url: args.url },
    };

    const payloadString = JSON.stringify(payload);
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payloadString);
      } catch (err) {
        const error = err as { statusCode?: number };
        if (error.statusCode === 410 || error.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else if (error.statusCode === 403) {
          console.error("Push VAPID mismatch for endpoint:", sub.endpoint);
        } else {
          console.error("Push send failed:", error);
        }
      }
    }

    // Clean up expired subscriptions
    for (const endpoint of expiredEndpoints) {
      await ctx.runMutation(internal.pushQueries.removeExpiredSubscription, {
        endpoint,
      });
    }

    return null;
  },
});
