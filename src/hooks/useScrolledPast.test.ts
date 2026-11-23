import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { useScrolledPast } from "./useScrolledPast";

type Callback = (entries: IntersectionObserverEntry[]) => void;

describe("useScrolledPast", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false when IntersectionObserver is missing", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const ref = { current: document.createElement("div") };
    const { result } = renderHook(() => useScrolledPast(ref));
    expect(result.current).toBe(false);
  });

  it("is false without an element", () => {
    const { result } = renderHook(() => useScrolledPast({ current: null }));
    expect(result.current).toBe(false);
  });

  it("is true once the element is out of view above the viewport", () => {
    let callback: Callback = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: Callback) {
          callback = cb;
        }
        observe = vi.fn();
        disconnect = disconnect;
      }
    );
    const ref = { current: document.createElement("div") };
    const { result, unmount } = renderHook(() => useScrolledPast(ref));
    const entry = (isIntersecting: boolean, top: number) =>
      [
        { isIntersecting, boundingClientRect: { top } },
      ] as unknown as IntersectionObserverEntry[];

    act(() => {
      callback(entry(false, -20));
    });
    expect(result.current).toBe(true);
    act(() => {
      callback(entry(true, 100));
    });
    expect(result.current).toBe(false);
    act(() => {
      callback(entry(false, 900));
    });
    expect(result.current).toBe(false);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
