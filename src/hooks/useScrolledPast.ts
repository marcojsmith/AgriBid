import { useEffect, useState, type RefObject } from "react";

/**
 * Tells whether an element has scrolled out of view above the viewport (used
 * to show the sticky phone bar once the hero call to action is gone). False
 * while the element is visible or still below the fold, and when the browser
 * has no `IntersectionObserver`.
 *
 * @param ref - Ref of the element to watch
 * @returns True once the element sits above the top of the viewport
 */
export function useScrolledPast(ref: RefObject<Element | null>): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return past;
}
