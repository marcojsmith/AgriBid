import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useMediaQuery } from "./useMediaQuery";

describe("useMediaQuery", () => {
  let matchMediaMock: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const addEventListenerMock = vi.fn();
    const removeEventListenerMock = vi.fn();
    matchMediaMock = {
      matches: false,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    };
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => matchMediaMock),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return initial matches value", () => {
    matchMediaMock.matches = true;
    const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("should update when media query changes", () => {
    const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"));

    expect(result.current).toBe(false);

    const calls = matchMediaMock.addEventListener.mock.calls;
    expect(calls.length).toBe(1);
    const listener = calls[0][1] as () => void;

    matchMediaMock.matches = true;
    act(() => {
      listener();
    });

    expect(result.current).toBe(true);
  });

  it("should clean up listener on unmount", () => {
    const removeSpy = vi.spyOn(matchMediaMock, "removeEventListener");
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    unmount();
    expect(removeSpy).toHaveBeenCalled();
  });

  it("should handle undefined window gracefully", () => {
    const originalMatchMedia = window.matchMedia;
    // @ts-expect-error - simulating non-browser environment
    window.matchMedia = undefined;

    try {
      const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"));
      expect(result.current).toBe(false);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
