import { useLayoutEffect, useRef, useState } from "react";

export interface UsePriceHighlightOptions {
  /** Duration of the highlight animation in milliseconds. Default is 800ms. */
  duration?: number;
}

/**
 * Hook to highlight a price value when it changes, creating a visual "flash" effect.
 *
 * Tracks the previous price value and returns true when a change is detected,
 * allowing consumers to apply conditional styling (e.g., background highlight).
 *
 * @param price - The current price value to track for changes
 * @param options - Optional configuration options
 * @param options.duration - Duration of highlight animation in ms (default: 800)
 * @returns boolean - True when price just changed, false otherwise
 *
 * @example
 * // Default usage (800ms duration)
 * const isHighlighted = usePriceHighlight(currentPrice);
 *
 * @example
 * // Custom duration
 * const isHighlighted = usePriceHighlight(currentPrice, { duration: 1000 });
 */
export function usePriceHighlight(
  price: number,
  options: UsePriceHighlightOptions = {}
): boolean {
  const { duration = 800 } = options;
  const [isHighlighted, setIsHighlighted] = useState(false);
  const previousPrice = useRef(price);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHighlightedRef = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    let shouldScheduleTimeout = false;

    if (price !== previousPrice.current) {
      previousPrice.current = price;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setIsHighlighted(true);
      isHighlightedRef.current = true;
      shouldScheduleTimeout = true;
    } else if (isHighlightedRef.current && timeoutRef.current === null) {
      shouldScheduleTimeout = true;
    }

    if (shouldScheduleTimeout) {
      timeoutRef.current = setTimeout(() => {
        setIsHighlighted(false);
        isHighlightedRef.current = false;
        timeoutRef.current = null;
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [price, duration]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return isHighlighted;
}
