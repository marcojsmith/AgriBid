import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { useScrolledPast } from "./useScrolledPast";

type Callback = (entries: IntersectionObserverEntry[]) => void;

/**
 * Builds an observer entry.
 *
 * @param isIntersecting - Whether the element is in view
 * @param top - Its top edge relative to the viewport
 * @returns The entries array the observer callback receives
 */
const entry = (isIntersecting: boolean, top: number) =>
  [
    { isIntersecting, boundingClientRect: { top } },
  ] as unknown as IntersectionObserverEntry[];

describe("useScrolledPast", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false when IntersectionObserver is missing", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { result } = renderHook(() => useScrolledPast());
    act(() => {
      result.current[0](document.createElement("div"));
    });
    expect(result.current[1]).toBe(false);
  });

  it("is false while no element is attached", () => {
    const { result } = renderHook(() => useScrolledPast());
    expect(result.current[1]).toBe(false);
  });

  it("observes an element attached after the first render", () => {
    let callback: Callback = () => undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: Callback) {
          callback = cb;
        }
        observe = observe;
        disconnect = disconnect;
      }
    );
    const { result, unmount } = renderHook(() => useScrolledPast());
    expect(observe).not.toHaveBeenCalled();

    const node = document.createElement("div");
    act(() => {
      result.current[0](node);
    });
    expect(observe).toHaveBeenCalledWith(node);

    act(() => {
      callback(entry(false, -20));
    });
    expect(result.current[1]).toBe(true);
    act(() => {
      callback(entry(true, 100));
    });
    expect(result.current[1]).toBe(false);
    act(() => {
      callback(entry(false, 900));
    });
    expect(result.current[1]).toBe(false);

    act(() => {
      callback(entry(false, -20));
    });
    act(() => {
      result.current[0](null);
    });
    expect(result.current[1]).toBe(false);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
