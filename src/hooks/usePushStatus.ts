import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import { ensurePushSubscription } from "@/lib/ensurePushSubscription";
import { browserNeedsHomeScreenInstall } from "@/lib/homeScreen";
import {
  currentSubscription,
  pushSupported,
  unsubscribeFromPush,
} from "@/lib/push";
import { requestReminderPermission } from "@/lib/reminders";

/**
 * What "On this phone" shows: `loading` until everything is known, `on`,
 * `off`, `blocked` (the browser says no), `install` (iPhone Safari needs the
 * Home Screen app first) or `unsupported` (no push here, or none configured).
 */
export type PushState =
  "loading" | "on" | "off" | "blocked" | "install" | "unsupported";

/** What {@link PushStatus.turnOn} ends with. */
export type TurnOnResult =
  "on" | "blocked" | "install" | "unsupported" | "failed";

/** The push state of this browser and the actions to change it. */
export interface PushStatus {
  state: PushState;
  /** A turn-on or turn-off is running. */
  busy: boolean;
  /** Asks for permission if needed, subscribes this browser and saves it. */
  turnOn: () => Promise<TurnOnResult>;
  /** Drops this browser's subscription and the saved copy. */
  turnOff: () => Promise<void>;
}

/**
 * Lets the dev-only design-system page show every push state: a provider
 * above the Account pages replaces what {@link usePushStatus} returns. Null
 * (the default) means the real browser state is used.
 */
export const PushStatusOverride = createContext<PushStatus | null>(null);

/**
 * The current notification permission, or "unsupported" without push.
 *
 * @returns The permission
 */
function readPermission(): NotificationPermission | "unsupported" {
  return pushSupported() ? Notification.permission : "unsupported";
}

/**
 * Push status for the Account notifications page. Combines what the browser
 * says (permission, its own subscription) with what the server has saved, and
 * offers turn on and turn off for this browser. The permission is read again
 * when the window regains focus, so coming back from the browser settings
 * shows the new state.
 *
 * @returns The state and the actions
 */
export function usePushStatus(): PushStatus {
  const override = useContext(PushStatusOverride);
  const { isAuthenticated } = useConvexAuth();
  const vapidKey = useQuery(api.push.getVapidPublicKey, {});
  const hasServer = useQuery(
    api.push.hasMySubscription,
    isAuthenticated ? {} : "skip"
  );
  const saveSubscription = useMutation(api.push.saveSubscription);
  const removeSubscription = useMutation(api.push.removeSubscription);
  const [permission, setPermission] = useState(readPermission);
  const [local, setLocal] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped by turnOn and turnOff so a refresh that started earlier (a focus
  // event while the permission prompt was closing) cannot overwrite them.
  const actionVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      const version = actionVersion.current;
      setPermission(readPermission());
      currentSubscription()
        .then((subscription) => {
          if (!active || version !== actionVersion.current) return;
          setLocal(subscription !== null);
          // Keep the saved copy of this phone fresh: another device may have
          // made the server say yes, or the saved row may have been pruned.
          if (subscription !== null && readPermission() === "granted") {
            saveSubscription(subscription).catch(() => undefined);
          }
        })
        .catch(() => {
          if (active) setLocal(false);
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, [saveSubscription]);

  const turnOn = useCallback(async (): Promise<TurnOnResult> => {
    if (browserNeedsHomeScreenInstall()) return "install";
    actionVersion.current += 1;
    setBusy(true);
    try {
      const result = await requestReminderPermission();
      setPermission(readPermission());
      if (result === "denied") return "blocked";
      if (result === "unsupported") return "unsupported";
      // Still loading is a failure to retry, not "this browser can't".
      if (typeof vapidKey !== "string") return "failed";
      try {
        await ensurePushSubscription(vapidKey, saveSubscription);
      } catch {
        return "failed";
      }
      setLocal(true);
      return "on";
    } finally {
      setBusy(false);
    }
  }, [vapidKey, saveSubscription]);

  const turnOff = useCallback(async (): Promise<void> => {
    actionVersion.current += 1;
    setBusy(true);
    try {
      const endpoint = await unsubscribeFromPush();
      // The browser has dropped it whatever the server says next.
      setLocal(false);
      if (endpoint !== null) await removeSubscription({ endpoint });
    } finally {
      setBusy(false);
    }
  }, [removeSubscription]);

  let state: PushState;
  if (browserNeedsHomeScreenInstall()) state = "install";
  else if (permission === "unsupported" || vapidKey === null)
    state = "unsupported";
  else if (vapidKey === undefined || hasServer === undefined || local === null)
    state = "loading";
  else if (permission === "denied") state = "blocked";
  else if (permission === "granted" && local && hasServer) state = "on";
  else state = "off";

  return override ?? { state, busy, turnOn, turnOff };
}
