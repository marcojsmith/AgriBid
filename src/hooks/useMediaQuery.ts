import { useState, useEffect } from "react";

/**
 * Returns the window.matchMedia function, or undefined when unavailable
 * (SSR or environments without matchMedia support).
 *
 * @returns The matchMedia function, or undefined if unavailable
 */
const getMatchMedia = (): ((query: string) => MediaQueryList) | undefined => {
  if (typeof window === "undefined") return undefined;
  return window.matchMedia;
};

/**
 * Custom hook to detect media query matches.
 *
 * Initialises synchronously to avoid layout jumps.
 * @param query - The media query to match
 * @returns Whether the media query matches
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    const matchMedia = getMatchMedia();
    if (!matchMedia) return false;
    return matchMedia(query).matches;
  });

  useEffect(() => {
    const matchMedia = getMatchMedia();
    if (!matchMedia) return;
    const media = matchMedia(query);
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
