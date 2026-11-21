import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useQuery } from "convex/react";

import type { ClosingSoonLot } from "@/lib/closingSoon";

import {
  CLOSING_SOON_LOT_LIMIT,
  CLOSING_SOON_REFRESH_BUCKET_MS,
} from "../../convex/constants";
import { useClosingSoonLots } from "./useClosingSoonLots";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));

const BUCKET = CLOSING_SOON_REFRESH_BUCKET_MS;
const BASE = 1_700_000_000_000 - (1_700_000_000_000 % BUCKET);
const lotsA = [{ _id: "a" }] as unknown as ClosingSoonLot[];
const lotsB = [{ _id: "b" }] as unknown as ClosingSoonLot[];

describe("useClosingSoonLots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockReturnValue(lotsA);
  });

  it("asks for the maximum with the time rounded down to the bucket", () => {
    renderHook(() => useClosingSoonLots(BASE + BUCKET - 1, true));
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), {
      limit: CLOSING_SOON_LOT_LIMIT,
      asOf: BASE,
    });
  });

  it("keeps one cache key across the 30 s useNow ticks inside a bucket", () => {
    const { rerender } = renderHook(
      ({ now }) => useClosingSoonLots(now, true),
      { initialProps: { now: BASE } }
    );
    for (let tick = 1; tick < BUCKET / 30_000; tick++) {
      rerender({ now: BASE + tick * 30_000 });
    }
    const keys = (useQuery as Mock).mock.calls.map(
      (call: unknown[]) => (call[1] as { asOf: number }).asOf
    );
    expect(new Set(keys)).toEqual(new Set([BASE]));
  });

  it("uses a new cache key in the next bucket", () => {
    const { rerender } = renderHook(
      ({ now }) => useClosingSoonLots(now, true),
      { initialProps: { now: BASE } }
    );
    rerender({ now: BASE + BUCKET });
    expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), {
      limit: CLOSING_SOON_LOT_LIMIT,
      asOf: BASE + BUCKET,
    });
  });

  it("skips the query when disabled", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    const { result } = renderHook(() => useClosingSoonLots(BASE, false));
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
    expect(result.current).toBeUndefined();
  });

  it("is undefined until the first result arrives", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    const { result } = renderHook(() => useClosingSoonLots(BASE, true));
    expect(result.current).toBeUndefined();
  });

  it("keeps the previous result while the next bucket loads", () => {
    const { result, rerender } = renderHook(
      ({ now }) => useClosingSoonLots(now, true),
      { initialProps: { now: BASE } }
    );
    expect(result.current).toBe(lotsA);
    (useQuery as Mock).mockReturnValue(undefined);
    rerender({ now: BASE + BUCKET });
    expect(result.current).toBe(lotsA);
    (useQuery as Mock).mockReturnValue(lotsB);
    rerender({ now: BASE + BUCKET });
    expect(result.current).toBe(lotsB);
  });
});
