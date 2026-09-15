import { useEffect, useState } from "react";

/**
 * Hook that tracks whether an auction's scheduled startTime has arrived.
 *
 * Unlike a plain `startTime > Date.now()` check computed at render time,
 * this self-updates via a timer so a component watching a scheduled
 * auction reflects the transition to "started" without needing an
 * unrelated re-render or a manual page refresh.
 *
 * @param startTime - The auction's scheduled start timestamp in milliseconds, if any
 * @returns True once the auction has started (or has no scheduled startTime)
 */
export function useAuctionStarted(startTime?: number): boolean {
  const [hasStarted, setHasStarted] = useState(
    () => !startTime || startTime <= Date.now()
  );

  /* eslint-disable react-hooks/set-state-in-effect -- flipping to "started" once the scheduled startTime arrives is the point of this hook */
  useEffect(() => {
    if (!startTime) {
      setHasStarted(true);
      return;
    }

    const msUntilStart = startTime - Date.now();
    if (msUntilStart <= 0) {
      setHasStarted(true);
      return;
    }

    setHasStarted(false);
    const timer = setTimeout(() => {
      setHasStarted(true);
    }, msUntilStart);

    return () => {
      clearTimeout(timer);
    };
  }, [startTime]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return hasStarted;
}
