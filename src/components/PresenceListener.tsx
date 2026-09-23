import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import { useSession } from "../lib/auth-client";

// Fallback used until the admin-configured interval query resolves. Must stay
// in sync with PRESENCE_HEARTBEAT_INTERVAL_MS_DEFAULT in convex/constants.ts.
const HEARTBEAT_INTERVAL_DEFAULT = 60 * 1000; // 60 seconds (threshold is 90s)

/**
 * Global component that maintains the user's online presence.
 *
 * Sends a heartbeat mutation to the backend at regular intervals
 * while the user has an active session and the tab is visible. The interval
 * is admin-configurable at runtime (settings key
 * `presence_heartbeat_interval_ms`); the hardcoded default is used while the
 * query loads or if no override is stored.
 *
 * @returns null
 */
export const PresenceListener = () => {
  const { data: session } = useSession();
  const heartbeat = useMutation(api.presence.heartbeat);
  const configuredIntervalMs = useQuery(api.presence.getHeartbeatIntervalMs);
  const intervalMs = configuredIntervalMs ?? HEARTBEAT_INTERVAL_DEFAULT;
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = () => {
      // Only send heartbeat if the page is visible to save bandwidth/resources
      if (document.visibilityState === "visible") {
        heartbeat().catch((err: unknown) => {
          console.error("Presence heartbeat failed:", err);
        });
      }
    };

    // Send initial heartbeat immediately
    sendHeartbeat();

    // Set up periodic heartbeat
    const interval = setInterval(sendHeartbeat, intervalMs);

    // Listen for visibility changes to respond quickly when user returns
    document.addEventListener("visibilitychange", sendHeartbeat);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", sendHeartbeat);
    };
  }, [userId, heartbeat, intervalMs]);

  return null;
};
