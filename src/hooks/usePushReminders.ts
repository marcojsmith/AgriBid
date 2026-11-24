import { useCallback, useEffect } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

import { browserNeedsHomeScreenInstall } from "@/lib/homeScreen";
import {
  currentSubscription,
  pushSupported,
  subscribeToPush,
} from "@/lib/push";
import { requestReminderPermission } from "@/lib/reminders";

/** What tapping Remind me should do next. */
export type RemindStep =
  | "remove"
  | "home-screen"
  | "sign-in"
  | "unsupported"
  | "subscribe"
  | "permission";

/** The outcome of {@link PushReminders.enable}. */
export type EnableResult = "granted" | "denied" | "unsupported" | "failed";

/** State and actions for one sale's "Remind me when it opens" reminder. */
export interface PushReminders {
  /** Whether the signed-in visitor already asked to be reminded. */
  reminded: boolean;
  /** The step Remind me should take now. */
  nextStep: () => RemindStep;
  /** Asks for permission if needed, subscribes this browser and saves the reminder. */
  enable: () => Promise<EnableResult>;
  /** Removes the reminder for this sale. */
  disable: () => Promise<void>;
}

/**
 * Drives the Remind me button on an upcoming sale: whether a reminder is set,
 * which step the next tap needs (install to Home Screen, sign in, permission)
 * and the actions to set or remove it. Reminders belong to the signed-in user.
 * While signed in with notifications already allowed, the browser's push
 * subscription is re-saved on mount so a rotated endpoint never goes stale.
 *
 * @param auctionId - The sale; undefined (no sale in the URL) disables the reminder
 * @returns The reminder state and actions
 */
export function usePushReminders(
  auctionId: Id<"auctions"> | undefined
): PushReminders {
  const { isAuthenticated } = useConvexAuth();
  const reminded =
    useQuery(
      api.push.getMySaleReminder,
      isAuthenticated && auctionId ? { auctionId } : "skip"
    ) ?? false;
  const vapidKey = useQuery(api.push.getVapidPublicKey, {});
  const saveSubscription = useMutation(api.push.saveSubscription);
  const setSaleReminder = useMutation(api.push.setSaleReminder);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !pushSupported() ||
      Notification.permission !== "granted"
    ) {
      return;
    }
    void currentSubscription()
      .then((subscription) =>
        subscription ? saveSubscription(subscription) : undefined
      )
      .catch(() => undefined);
  }, [isAuthenticated, saveSubscription]);

  const nextStep = useCallback((): RemindStep => {
    if (reminded) return "remove";
    if (browserNeedsHomeScreenInstall()) return "home-screen";
    if (!isAuthenticated) return "sign-in";
    if (!pushSupported() || vapidKey === null) return "unsupported";
    if (Notification.permission === "granted") return "subscribe";
    return "permission";
  }, [reminded, isAuthenticated, vapidKey]);

  const enable = useCallback(async (): Promise<EnableResult> => {
    if (!auctionId) return "failed";
    const permission = await requestReminderPermission();
    if (permission !== "granted") return permission;
    if (!vapidKey) return "unsupported";
    try {
      const subscription = await subscribeToPush(vapidKey);
      await saveSubscription(subscription);
      await setSaleReminder({ auctionId, on: true });
      return "granted";
    } catch {
      return "failed";
    }
  }, [vapidKey, saveSubscription, setSaleReminder, auctionId]);

  const disable = useCallback(async (): Promise<void> => {
    if (!auctionId) return;
    await setSaleReminder({ auctionId, on: false });
  }, [setSaleReminder, auctionId]);

  return { reminded, nextStep, enable, disable };
}
