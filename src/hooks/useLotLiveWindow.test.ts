import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  getLotLiveWindow,
  useLotLiveWindow,
  type LotLiveWindowInput,
} from "./useLotLiveWindow";

const NOW = 1_000_000_000_000;

const makeLot = (
  overrides: Partial<LotLiveWindowInput> = {}
): LotLiveWindowInput => ({
  status: "assigned",
  auctionStatus: "published",
  auctionStartTime: NOW - 60_000,
  auctionEndTime: NOW + 60_000,
  ...overrides,
});

describe("getLotLiveWindow", () => {
  it("treats a draft lot as unavailable", () => {
    const window = getLotLiveWindow(makeLot({ status: "draft" }), NOW);
    expect(window.phase).toBe("unavailable");
    expect(window.isUnavailable).toBe(true);
    expect(window.isLive).toBe(false);
  });

  it("treats an approved (unassigned) lot as unavailable", () => {
    const window = getLotLiveWindow(
      makeLot({ status: "approved", auctionStatus: undefined }),
      NOW
    );
    expect(window.phase).toBe("unavailable");
    expect(window.isEnded).toBe(false);
  });

  it("treats a published lot before its start as upcoming", () => {
    const window = getLotLiveWindow(
      makeLot({ auctionStartTime: NOW + 60_000 }),
      NOW
    );
    expect(window.phase).toBe("upcoming");
    expect(window.isUpcoming).toBe(true);
    expect(window.isLive).toBe(false);
  });

  it("treats a lot inside its window as live", () => {
    const window = getLotLiveWindow(makeLot(), NOW);
    expect(window.phase).toBe("live");
    expect(window.isLive).toBe(true);
  });

  it("treats a lot past its effective end as ended", () => {
    const window = getLotLiveWindow(
      makeLot({ auctionEndTime: NOW - 1_000 }),
      NOW
    );
    expect(window.phase).toBe("ended");
    expect(window.isEnded).toBe(true);
  });

  it("uses extendedEndTime over auctionEndTime for the effective end", () => {
    const window = getLotLiveWindow(
      makeLot({
        auctionEndTime: NOW - 1_000,
        extendedEndTime: NOW + 120_000,
      }),
      NOW
    );
    expect(window.phase).toBe("live");
    expect(window.effectiveEndTime).toBe(NOW + 120_000);
  });

  it("treats sold, unsold and rejected lots as ended", () => {
    for (const status of ["sold", "unsold", "rejected"]) {
      const window = getLotLiveWindow(makeLot({ status }), NOW);
      expect(window.phase).toBe("ended");
    }
  });

  it("does not treat an assigned lot with an unpublished parent as live", () => {
    const window = getLotLiveWindow(
      makeLot({ auctionStatus: "draft" }),
      NOW
    );
    expect(window.phase).toBe("ended");
  });
});

describe("useLotLiveWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("self-updates from upcoming to live once the start time elapses", () => {
    const { result } = renderHook(() =>
      useLotLiveWindow(makeLot({ auctionStartTime: NOW + 60_000 }))
    );
    expect(result.current.phase).toBe("upcoming");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.phase).toBe("live");
  });

  it("self-updates from live to ended once the effective end elapses", () => {
    const { result } = renderHook(() =>
      useLotLiveWindow(makeLot({ auctionEndTime: NOW + 60_000 }))
    );
    expect(result.current.phase).toBe("live");

    act(() => {
      vi.advanceTimersByTime(60_100);
    });

    expect(result.current.phase).toBe("ended");
    expect(result.current.isEnded).toBe(true);
  });

  it("honours the soft-close extension when scheduling the end transition", () => {
    const { result } = renderHook(() =>
      useLotLiveWindow(
        makeLot({
          auctionEndTime: NOW + 60_000,
          extendedEndTime: NOW + 120_000,
        })
      )
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.phase).toBe("live");

    act(() => {
      vi.advanceTimersByTime(60_100);
    });
    expect(result.current.phase).toBe("ended");
  });
});
