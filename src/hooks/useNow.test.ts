import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useNow } from "./useNow";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current timestamp on initial render", () => {
    const { result } = renderHook(() => useNow());
    expect(result.current).toBeGreaterThan(0);
    expect(typeof result.current).toBe("number");
  });

  it("updates timestamp after the interval elapses", () => {
    const { result } = renderHook(() => useNow(10_000));
    const initialNow = result.current;

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current).toBeGreaterThan(initialNow);
  });

  it("uses the provided interval", () => {
    const { result } = renderHook(() => useNow(5_000));
    const initialNow = result.current;

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current).toBeGreaterThan(initialNow);
  });

  it("clears the interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = renderHook(() => useNow());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
