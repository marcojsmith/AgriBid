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

/** localStorage key remembering when the visitor last said "Not now". */
const DISMISSED_KEY = "agribid.watchAlertsPromptDismissedAt";
/** How long a "Not now" keeps the prompt away. */
const DISMISS_MS = 30 * 24 * 3_600_000;

/**
 * Whether the visitor dismissed the prompt within the last 30 days. Storage can
 * be blocked or empty, in which case the prompt is simply allowed.
 *
 * @returns True while a recent "Not now" is remembered
 */
function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

/** Remembers a "Not now" (best effort). */
function rememberDismissal(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the prompt may return next time, which is harmless.
  }
}

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
  const prefs = useQuery(
    api.userPreferences.getMyPreferences,
    isAuthenticated ? {} : "skip"
  );
  const saveSubscription = useMutation(api.push.saveSubscription);
  const [promptOpen, setPromptOpen] = useState(false);
  const enabled = settings?.watchAlertsEnabled === true;
  // The user's own Settings -> Notifications: outbid alerts are on unless
  // switched off, the 1-hour alert only when the ending setting is unset or 1h.
  // No saved row means the defaults (both on). Promise alerts if either is on.
  const ending = prefs?.notificationsWatchlistEnding;
  const wantsAlerts =
    prefs?.notificationsBidOutbid !== false ||
    ending === undefined ||
    ending === "1h";
  const promise = wantsAlerts ? WATCHING_MESSAGE : WATCHING_SAVED_MESSAGE;

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
    if (hasSubscription) return promise;
    if (
      !pushSupported() ||
      browserNeedsHomeScreenInstall() ||
      typeof vapidKey !== "string"
    ) {
      return WATCHING_SAVED_MESSAGE;
    }
    if (Notification.permission === "granted") {
      return (await subscribe()) ? promise : WATCHING_SAVED_MESSAGE;
    }
    if (Notification.permission === "default" && !recentlyDismissed()) {
      setPromptOpen(true);
    }
    return WATCHING_SAVED_MESSAGE;
  }, [enabled, hasSubscription, vapidKey, subscribe, promise]);

  const onAllow = useCallback(() => {
    setPromptOpen(false);
    void (async () => {
      const permission = await requestReminderPermission();
      if (permission !== "granted") return;
      if (await subscribe()) showToast(promise);
      else toast.error("Couldn't turn on alerts. Try again.");
    })();
  }, [subscribe, promise]);

  return {
    afterWatch,
    promptProps: {
      open: promptOpen,
      onOpenChange: (open) => {
        setPromptOpen(open);
        if (!open) rememberDismissal();
      },
      onAllow,
      description: "Get an alert 1 hour before close and if you're outbid?",
      allowLabel: "Allow alerts",
    },
  };
}
