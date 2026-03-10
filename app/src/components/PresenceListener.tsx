import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";

import { useSession } from "../lib/auth-client";

const HEARTBEAT_INTERVAL = 25 * 1000; // 25 seconds (threshold is 30s)

/**
 * Global component that maintains the user's online presence.
 *
 * Sends a heartbeat mutation to the backend at regular intervals
 * while the user has an active session and the tab is visible.
 *
 * @returns null
 */
export const PresenceListener = () => {
  const { data: session } = useSession();
  const heartbeat = useMutation(api.presence.heartbeat);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = () => {
      // Only send heartbeat if the page is visible to save bandwidth/resources
      if (document.visibilityState === "visible") {
        heartbeat().catch((err) => {
          console.error("Presence heartbeat failed:", err);
        });
      }
    };

    // Send initial heartbeat immediately
    sendHeartbeat();

    // Set up periodic heartbeat
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Listen for visibility changes to respond quickly when user returns
    document.addEventListener("visibilitychange", sendHeartbeat);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", sendHeartbeat);
    };
  }, [userId, heartbeat]);

  return null;
};
