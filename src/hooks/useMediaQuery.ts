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
    if (typeof window !== "undefined") {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
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
