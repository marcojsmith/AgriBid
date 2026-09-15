import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useAuctionStarted } from "./useAuctionStarted";

describe("useAuctionStarted", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when startTime is undefined", () => {
    const { result } = renderHook(() => useAuctionStarted(undefined));
    expect(result.current).toBe(true);
  });

  it("returns true when startTime is already in the past", () => {
    const { result } = renderHook(() => useAuctionStarted(Date.now() - 60_000));
    expect(result.current).toBe(true);
  });

  it("returns false when startTime is in the future", () => {
    const { result } = renderHook(() => useAuctionStarted(Date.now() + 60_000));
    expect(result.current).toBe(false);
  });

  it("self-updates to true once startTime elapses, without a manual re-render (regression)", () => {
    const futureTime = Date.now() + 60_000;
    const { result } = renderHook(() => useAuctionStarted(futureTime));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current).toBe(true);
  });

  it("does not flip early before startTime elapses", () => {
    const { result } = renderHook(() => useAuctionStarted(Date.now() + 60_000));

    act(() => {
      vi.advanceTimersByTime(59_000);
    });

    expect(result.current).toBe(false);
  });

  it("re-arms the timer when startTime prop changes", () => {
    const { result, rerender } = renderHook(
      ({ startTime }: { startTime: number | undefined }) =>
        useAuctionStarted(startTime),
      { initialProps: { startTime: Date.now() + 60_000 } }
    );
    expect(result.current).toBe(false);

    rerender({ startTime: Date.now() + 5_000 });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current).toBe(true);
  });
});
