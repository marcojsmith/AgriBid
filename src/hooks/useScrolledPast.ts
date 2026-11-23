import { useEffect, useState } from "react";

/**
 * Tells whether an element has scrolled out of view above the viewport (used
 * to show the sticky phone bar once the hero call to action is gone). False
 * while the element is visible or still below the fold, while it is not
 * rendered, and when the browser has no `IntersectionObserver`.
 *
 * Returns a callback ref rather than taking a ref object, so the observer is
 * set up whenever the element mounts, even if it renders after the first
 * paint (for example once its data has loaded).
 *
 * @returns `[ref, past]`: pass `ref` to the element; `past` is true once the
 * element sits above the top of the viewport
 */
export function useScrolledPast(): [(node: Element | null) => void, boolean] {
  const [element, setElement] = useState<Element | null>(null);
  const [past, setPast] = useState(false);

  useEffect(() => {
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      setPast(false);
    };
  }, [element]);

  return [setElement, past];
}
