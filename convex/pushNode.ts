"use node";

import { v } from "convex/values";
import webpush from "web-push";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { getEnv } from "./config";
import { deliverAll, isAllowedPushEndpoint } from "./lib/pushDelivery";

/**
 * Sends a batch of web pushes with the VAPID keys from the environment and
 * deletes subscriptions the push service reports as gone. Missing VAPID
 * configuration is logged and skipped so the cron never fails.
 */
export const sendPushBatch = internalAction({
  args: {
    messages: v.array(
      v.object({
        endpoint: v.string(),
        p256dh: v.string(),
        auth: v.string(),
        payload: v.string(),
      })
    ),
  },
  returns: v.object({
    delivered: v.number(),
    removed: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const publicKey = getEnv("VAPID_PUBLIC_KEY");
    const privateKey = getEnv("VAPID_PRIVATE_KEY");
    const subject = getEnv("VAPID_SUBJECT");
    if (!publicKey || !privateKey || !subject) {
      console.warn("Web push skipped: VAPID environment variables are not set");
      return { delivered: 0, removed: 0, skipped: 0 };
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    // Defence in depth: never call an endpoint outside the push services.
    const allowed = args.messages.filter((message) =>
      isAllowedPushEndpoint(message.endpoint)
    );
    const skipped = args.messages.length - allowed.length;
    if (skipped > 0) {
      console.warn(
        `Web push skipped ${String(skipped)} disallowed endpoint(s)`
      );
    }
    const { delivered, expired } = await deliverAll(
      allowed,
      (target, payload) =>
        webpush.sendNotification(target, payload, {
          TTL: 3600,
          urgency: "high",
          timeout: 10_000,
        })
    );
    if (expired.length > 0) {
      await ctx.runMutation(internal.push.deleteSubscriptions, {
        endpoints: expired,
      });
    }
    return { delivered, removed: expired.length, skipped };
  },
});
