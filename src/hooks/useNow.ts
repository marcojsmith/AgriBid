import { useState, useEffect } from "react";

/**
 * Hook that returns the current timestamp and updates periodically.
 *
 * Useful for components that need to show live status (e.g., "Live Now" badges)
 * without forcing the entire parent tree to re-render on every tick.
 *
 * The default interval is 30 seconds, suitable for coarse-grained status
 * checks like auction liveness windows.
 *
 * @param intervalMs - Update interval in milliseconds (default 30_000)
 * @returns Current timestamp in milliseconds since epoch
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [intervalMs]);

  return now;
}
