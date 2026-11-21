import { renderHook } from "@testing-library/react";
import { useQuery } from "convex/react";
import { describe, expect, it, vi } from "vitest";

import { useVatRate } from "./useVatRate";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("convex/_generated/api", () => ({
  api: { admin: { getVatRate: "admin:getVatRate" } },
}));

describe("useVatRate", () => {
  it("returns undefined while the rate loads", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    const { result } = renderHook(() => useVatRate());
    expect(result.current).toBeUndefined();
    expect(useQuery).toHaveBeenCalledWith("admin:getVatRate");
  });

  it("returns the rate from the public query", () => {
    vi.mocked(useQuery).mockReturnValue({ vatRatePct: 12.5 });
    const { result } = renderHook(() => useVatRate());
    expect(result.current).toBe(12.5);
  });
});
