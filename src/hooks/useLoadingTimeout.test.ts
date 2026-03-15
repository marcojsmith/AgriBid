import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useLoadingTimeout } from "./useLoadingTimeout";

describe("useLoadingTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return false initially when loading", () => {
    const { result } = renderHook(() => useLoadingTimeout(true));
    expect(result.current).toBe(false);
  });

  it("should return false when not loading", () => {
    const { result } = renderHook(() => useLoadingTimeout(false));
    expect(result.current).toBe(false);
  });

  it("should return true after timeout reached while loading", () => {
    const timeoutMs = 5000;
    const { result } = renderHook(() => useLoadingTimeout(true, timeoutMs));

    act(() => {
      vi.advanceTimersByTime(timeoutMs);
    });

    expect(result.current).toBe(true);
  });

  it("should return false if loading finishes before timeout", () => {
    const timeoutMs = 5000;
    const { result, rerender } = renderHook(
      ({ isLoading }) => useLoadingTimeout(isLoading, timeoutMs),
      {
        initialProps: { isLoading: true },
      }
    );

    act(() => {
      vi.advanceTimersByTime(timeoutMs / 2);
    });

    rerender({ isLoading: false });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(timeoutMs / 2);
    });

    expect(result.current).toBe(false);
  });

  it("should reset timeout state when loading starts again", () => {
    const timeoutMs = 5000;
    const { result, rerender } = renderHook(
      ({ isLoading }) => useLoadingTimeout(isLoading, timeoutMs),
      {
        initialProps: { isLoading: true },
      }
    );

    // Reach timeout
    act(() => {
      vi.advanceTimersByTime(timeoutMs);
    });
    expect(result.current).toBe(true);

    // Stop loading
    rerender({ isLoading: false });
    expect(result.current).toBe(false);

    // Wait for the next tick for state update (useEffect cleanup and timeout(0))
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Start loading again
    rerender({ isLoading: true });
    expect(result.current).toBe(false);

    // Should timeout again after timeoutMs
    act(() => {
      vi.advanceTimersByTime(timeoutMs);
    });
    expect(result.current).toBe(true);
  });
});
