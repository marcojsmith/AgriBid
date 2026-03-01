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

  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (price !== previousPrice.current) {
      previousPrice.current = price;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setIsHighlighted(true);

      timeoutRef.current = setTimeout(() => {
        setIsHighlighted(false);
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [price, duration]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return isHighlighted;
}
