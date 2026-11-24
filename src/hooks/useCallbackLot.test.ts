import { renderHook } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetConvexState, setQuery } from "@/pages/register/testing";

import { useCallbackLot } from "./useCallbackLot";

const useQuerySpy = vi.hoisted(() => vi.fn());
vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  return {
    useQuery: (...args: Parameters<typeof t.mockUseQuery>) => {
      useQuerySpy(...args);
      return t.mockUseQuery(...args);
    },
  };
});

const LOT_ID = "k57abcdefghjkmnpqrstvwxyz2345678";

describe("useCallbackLot", () => {
  beforeEach(() => {
    resetConvexState();
    useQuerySpy.mockClear();
  });

  it.each(["//evil.com", "https://x", "/\\evil", "javascript:1", ""])(
    "rejects %s and never queries",
    (url) => {
      const { result } = renderHook(() => useCallbackLot(url));
      expect(result.current).toBeNull();
      expect(useQuerySpy).toHaveBeenCalledWith(
        api.auctions.getLotHeadline,
        "skip"
      );
    }
  );

  it("returns null without a callback", () => {
    const { result } = renderHook(() => useCallbackLot(null));
    expect(result.current).toBeNull();
  });

  it("labels a non-lot path 'Back' and skips the lookup", () => {
    const { result } = renderHook(() => useCallbackLot("/watchlist?x=1"));
    expect(result.current).toEqual({ href: "/watchlist?x=1", label: "Back" });
    expect(useQuerySpy).toHaveBeenCalledWith(
      api.auctions.getLotHeadline,
      "skip"
    );
  });

  it("looks up a lot page and builds 'Lot 3 · title'", () => {
    const lot = {
      lotNumber: 3,
      title: "New Holland T6070",
      closesAt: 1_000,
      photoUrl: "https://img.test/a.jpg",
    };
    setQuery(api.auctions.getLotHeadline, lot);
    const { result } = renderHook(() =>
      useCallbackLot(`/auction/${LOT_ID}?ref=x`)
    );
    expect(useQuerySpy).toHaveBeenCalledWith(api.auctions.getLotHeadline, {
      lotId: LOT_ID,
    });
    expect(result.current).toEqual({
      href: `/auction/${LOT_ID}?ref=x`,
      label: "Lot 3 · New Holland T6070",
      lot,
    });
  });

  it("uses just the title when the lot has no number", () => {
    setQuery(api.auctions.getLotHeadline, { title: "Baler" });
    const { result } = renderHook(() => useCallbackLot(`/auction/${LOT_ID}`));
    expect(result.current?.label).toBe("Baler");
  });

  it("falls back to 'Back' while the lot loads or when it is hidden", () => {
    const { result } = renderHook(() => useCallbackLot(`/auction/${LOT_ID}`));
    expect(result.current).toEqual({
      href: `/auction/${LOT_ID}`,
      label: "Back",
    });
  });
});
