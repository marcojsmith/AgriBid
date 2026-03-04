import { useState, useEffect, useRef } from "react";

/**
 * A hook that tracks if a loading state has persisted beyond a specified threshold.
 *
 * @param isLoading - Whether the data is currently loading (usually check for undefined)
 * @param timeoutMs - How long to wait before timing out (default 10000ms)
 * @returns boolean - True if the threshold has been reached while loading
 */
export function useLoadingTimeout(
  isLoading: boolean,
  timeoutMs: number = 10000
): boolean {
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const prevIsLoadingRef = useRef(isLoading);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading) {
      resetTimerRef.current = setTimeout(() => setHasTimedOut(false), 0);
    }
    prevIsLoadingRef.current = isLoading;

    if (!isLoading) return;

    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [isLoading, timeoutMs]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  return isLoading && hasTimedOut;
}
