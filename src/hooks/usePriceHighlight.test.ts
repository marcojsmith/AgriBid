import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { usePriceHighlight } from "./usePriceHighlight";

describe("usePriceHighlight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return false initially", () => {
    const { result } = renderHook(() => usePriceHighlight(100));
    expect(result.current).toBe(false);
  });

  it("should return true when price changes", () => {
    const { result, rerender } = renderHook(
      ({ price }) => usePriceHighlight(price),
      {
        initialProps: { price: 100 },
      }
    );

    rerender({ price: 110 });
    expect(result.current).toBe(true);
  });

  it("should return false after duration", () => {
    const duration = 800;
    const { result, rerender } = renderHook(
      ({ price }) => usePriceHighlight(price, { duration }),
      {
        initialProps: { price: 100 },
      }
    );

    rerender({ price: 110 });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(duration);
    });

    expect(result.current).toBe(false);
  });

  it("should handle rapid price changes by extending highlight", () => {
    const duration = 800;
    const { result, rerender } = renderHook(
      ({ price }) => usePriceHighlight(price, { duration }),
      {
        initialProps: { price: 100 },
      }
    );

    // First change
    rerender({ price: 110 });
    expect(result.current).toBe(true);

    // Wait half duration
    act(() => {
      vi.advanceTimersByTime(duration / 2);
    });
    expect(result.current).toBe(true);

    // Second change
    rerender({ price: 120 });
    expect(result.current).toBe(true);

    // Wait another half duration (total since first change = duration)
    act(() => {
      vi.advanceTimersByTime(duration / 2);
    });
    // Should still be true because second change reset the timer
    expect(result.current).toBe(true);

    // Wait another half duration
    act(() => {
      vi.advanceTimersByTime(duration / 2);
    });
    expect(result.current).toBe(false);
  });

  it("should not highlight if price is NaN", () => {
    const { result, rerender } = renderHook(
      ({ price }) => usePriceHighlight(price),
      {
        initialProps: { price: 100 },
      }
    );

    rerender({ price: NaN });
    expect(result.current).toBe(false);
  });

  it("should not highlight if price is same", () => {
    const { result, rerender } = renderHook(
      ({ price }) => usePriceHighlight(price),
      {
        initialProps: { price: 100 },
      }
    );

    rerender({ price: 100 });
    expect(result.current).toBe(false);
  });

  it("should clear timeout on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    const { rerender, unmount } = renderHook(
      ({ price }) => usePriceHighlight(price),
      {
        initialProps: { price: 100 },
      }
    );

    rerender({ price: 110 });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("should reschedule timeout if duration changes during highlight", () => {
    const { result, rerender } = renderHook(
      ({ price, duration }) => usePriceHighlight(price, { duration }),
      {
        initialProps: { price: 100, duration: 800 },
      }
    );

    // Start highlight
    act(() => {
      rerender({ price: 110, duration: 800 });
    });
    expect(result.current).toBe(true);

    // Change duration while highlighted
    act(() => {
      rerender({ price: 110, duration: 1000 });
    });
    expect(result.current).toBe(true);

    // Should have rescheduled (timeoutRef was null after cleanup of first effect)
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(result.current).toBe(true); // Still true because 1000ms duration used

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(false);
  });

  it("should handle unmount without active timeout", () => {
    const { unmount } = renderHook(() => usePriceHighlight(100));
    unmount();
    // No error should occur
  });

  it("should use default duration if options not provided", () => {
    const { result, rerender } = renderHook(
      ({ price }) => usePriceHighlight(price),
      {
        initialProps: { price: 100 },
      }
    );

    rerender({ price: 110 });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current).toBe(false);
  });
});
