import { useLayoutEffect, useRef, useState } from "react";

interface UsePriceHighlightOptions {
  duration?: number;
}

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
