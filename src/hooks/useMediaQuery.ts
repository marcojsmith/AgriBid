import { useState, useEffect } from "react";

/**
 * Custom hook to detect media query matches.
 *
 * Initialises synchronously to avoid layout jumps.
 * @param query - The media query to match
 * @returns Whether the media query matches
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(query);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncs matches state immediately when query prop changes
    setMatches(media.matches);
    const listener = () => {
      setMatches(media.matches);
    };
    media.addEventListener("change", listener);
    return () => {
      media.removeEventListener("change", listener);
    };
  }, [query]);

  return matches;
}
