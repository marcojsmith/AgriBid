import { useCallback, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "convex/_generated/api";

import { showToast } from "@/components/ds/showToast";
import { WATCHING_MESSAGE, WATCHING_SAVED_MESSAGE } from "@/lib/auctionRules";
import { ensurePushSubscription } from "@/lib/ensurePushSubscription";
import { browserNeedsHomeScreenInstall } from "@/lib/homeScreen";
import { pushSupported } from "@/lib/push";
import { requestReminderPermission } from "@/lib/reminders";

/** Props for the `PermissionPrompt` the page renders. */
export interface WatchAlertsPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAllow: () => void;
  description: string;
  allowLabel: string;
}

/** What {@link useWatchAlerts} gives a page. */
export interface WatchAlerts {
  /**
   * Call after a heart tap turned watching ON. Returns the toast text, which
   * promises alerts only when they will actually be sent, and opens the
   * permission prompt when the browser still has to be asked.
   */
  afterWatch: () => Promise<string>;
  /** Spread onto the page's `PermissionPrompt`. */
  promptProps: WatchAlertsPromptProps;
}

/**
 * Watched-lot alerts for a page with a heart: after a heart tap turns watching
 * on, makes sure this browser can receive the outbid and closing-soon pushes.
 * Needs the admin `watchAlertsEnabled` setting; where push is unsupported or
 * iOS needs the Home Screen install it stays quiet (no sheet on a heart tap).
 *
 * @returns The `afterWatch` action and the permission prompt props
 */
export function useWatchAlerts(): WatchAlerts {
  const { isAuthenticated } = useConvexAuth();
  const settings = useQuery(api.admin.platformSettings.getPlatformSettings);
  const vapidKey = useQuery(api.push.getVapidPublicKey, {});
  const hasSubscription =
    useQuery(api.push.hasMySubscription, isAuthenticated ? {} : "skip") ??
    false;
  const saveSubscription = useMutation(api.push.saveSubscription);
  const [promptOpen, setPromptOpen] = useState(false);
  const enabled = settings?.watchAlertsEnabled === true;

  /** Subscribes and saves; false when the browser or server refused. */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (typeof vapidKey !== "string") return false;
    try {
      await ensurePushSubscription(vapidKey, saveSubscription);
      return true;
    } catch {
      return false;
    }
  }, [vapidKey, saveSubscription]);

  const afterWatch = useCallback(async (): Promise<string> => {
    if (!enabled) return WATCHING_SAVED_MESSAGE;
    if (hasSubscription) return WATCHING_MESSAGE;
    if (
      !pushSupported() ||
      browserNeedsHomeScreenInstall() ||
      typeof vapidKey !== "string"
    ) {
      return WATCHING_SAVED_MESSAGE;
    }
    if (Notification.permission === "granted") {
      return (await subscribe()) ? WATCHING_MESSAGE : WATCHING_SAVED_MESSAGE;
    }
    if (Notification.permission === "default") setPromptOpen(true);
    return WATCHING_SAVED_MESSAGE;
  }, [enabled, hasSubscription, vapidKey, subscribe]);

  const onAllow = useCallback(() => {
    setPromptOpen(false);
    void (async () => {
      const permission = await requestReminderPermission();
      if (permission !== "granted") return;
      if (await subscribe()) showToast(WATCHING_MESSAGE);
      else toast.error("Couldn't turn on alerts. Try again.");
    })();
  }, [subscribe]);

  return {
    afterWatch,
    promptProps: {
      open: promptOpen,
      onOpenChange: setPromptOpen,
      onAllow,
      description: "Get an alert 1 hour before close and if you're outbid?",
      allowLabel: "Allow alerts",
    },
  };
}
