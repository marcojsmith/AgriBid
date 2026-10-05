import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";

import { useFilterSidebar } from "./useFilterSidebar";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(() => ({ data: null })),
}));

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      getActiveMakes: "auctions:getActiveMakes",
    },
    userPreferences: {
      getMyPreferences: "userPreferences:getMyPreferences",
      updateMyPreferences: "userPreferences:updateMyPreferences",
    },
  },
}));

const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams();
let preferences: Record<string, unknown> | null = null;
const mockUpdateMyPreferences = vi.fn();

/**
 * Replaces the search params the mocked `useSearchParams` returns.
 *
 * @param query - The params the next render should see.
 */
const setSearchParams = (query: Record<string, string>) => {
  mockSearchParams = new URLSearchParams(query);
};

describe("useFilterSidebar hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    preferences = null;
    (useSession as Mock).mockReturnValue({ data: null });
    (useQuery as Mock).mockImplementation((apiPath: string) => {
      if (apiPath === "auctions:getActiveMakes")
        return ["John Deere", "Case IH"];
      if (apiPath === "userPreferences:getMyPreferences") return preferences;
      return undefined;
    });
    (useMutation as Mock).mockReturnValue(mockUpdateMyPreferences);
  });

  it("seeds the filters from the current URL", () => {
    setSearchParams({ status: "closed", make: "John Deere", minYear: "2020" });
    const { result } = renderHook(() =>
      useFilterSidebar({ hideStatus: false })
    );

    expect(result.current.filters).toEqual({
      status: "closed",
      make: "John Deere",
      minYear: "2020",
      maxYear: "",
      minPrice: "",
      maxPrice: "",
      maxHours: "",
    });
    expect(result.current.activeMakes).toEqual(["John Deere", "Case IH"]);
    expect(result.current.isSignedIn).toBe(false);
    expect(result.current.hasFilters).toBe(true);
  });

  it("writes local filter changes to the URL", () => {
    const { result } = renderHook(() =>
      useFilterSidebar({ hideStatus: false })
    );

    act(() => {
      result.current.updateParam("minYear", "2024");
    });

    const [written] = mockSetSearchParams.mock.calls[0] as [URLSearchParams];
    expect(written.get("minYear")).toBe("2024");
    expect(result.current.hasFilters).toBe(true);
  });

  it("leaves the URL status alone when the status filter is hidden", () => {
    const onClose = vi.fn();
    setSearchParams({ status: "closed" });
    const { result } = renderHook(() =>
      useFilterSidebar({ hideStatus: true, onClose })
    );

    act(() => {
      result.current.updateParam("make", "John Deere");
    });

    const [written] = mockSetSearchParams.mock.calls[0] as [URLSearchParams];
    expect(written.get("make")).toBe("John Deere");
    expect(written.get("status")).toBe("closed");
  });

  it("syncs filters when the URL changes externally", () => {
    const { result, rerender } = renderHook(() =>
      useFilterSidebar({ hideStatus: false })
    );
    expect(result.current.filters.status).toBe("active");

    // An external navigation (browser back/forward, a link) swaps the URL
    // object without any local filter change, so the filters must follow it.
    setSearchParams({ status: "all", maxHours: "5000" });
    rerender();

    expect(result.current.filters.status).toBe("all");
    expect(result.current.filters.maxHours).toBe("5000");
  });

  it("does not rewrite an unchanged URL on the first render", () => {
    setSearchParams({ status: "all" });
    renderHook(() => useFilterSidebar({ hideStatus: false }));

    expect(mockSetSearchParams).not.toHaveBeenCalled();
  });

  it("resets filters, keeps the search query and closes the sidebar", () => {
    const onClose = vi.fn();
    setSearchParams({ q: "tractor", make: "John Deere" });
    const { result } = renderHook(() =>
      useFilterSidebar({ hideStatus: false, onClose })
    );

    act(() => {
      result.current.resetFilters();
    });

    const [written] = mockSetSearchParams.mock.calls[0] as [URLSearchParams];
    expect(written.get("q")).toBe("tractor");
    expect(written.has("make")).toBe(false);
    expect(result.current.filters).toEqual({
      status: "active",
      make: "",
      minYear: "",
      maxYear: "",
      minPrice: "",
      maxPrice: "",
      maxHours: "",
    });
    expect(result.current.hasFilters).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resets without an onClose callback", () => {
    setSearchParams({ make: "John Deere" });
    const { result } = renderHook(() =>
      useFilterSidebar({ hideStatus: false })
    );

    expect(() => {
      act(() => {
        result.current.resetFilters();
      });
    }).not.toThrow();
  });

  it("saves the current filters as defaults", async () => {
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    mockUpdateMyPreferences.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useFilterSidebar({ hideStatus: false })
    );

    act(() => {
      result.current.updateParam("status", "closed");
      result.current.updateParam("make", "John Deere");
      result.current.updateParam("maxHours", "1000");
    });
    expect(result.current.isSignedIn).toBe(true);

    await act(async () => {
      await result.current.saveDefaults();
    });

    expect(mockUpdateMyPreferences).toHaveBeenCalledWith({
      defaultStatusFilter: "closed",
      defaultMake: "John Deere",
      defaultMinYear: undefined,
      defaultMaxYear: undefined,
      defaultMinPrice: undefined,
      defaultMaxPrice: undefined,
      defaultMaxHours: 1000,
    });
    expect(toast.success).toHaveBeenCalledWith("Default filters saved");
    expect(result.current.pendingDefaultsAction).toBeNull();
  });

  it("never persists the status default when the status filter is hidden", async () => {
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    mockUpdateMyPreferences.mockResolvedValue(null);
    const { result } = renderHook(() => useFilterSidebar({ hideStatus: true }));

    act(() => {
      result.current.updateParam("status", "closed");
    });
    await act(async () => {
      await result.current.saveDefaults();
    });

    expect(mockUpdateMyPreferences).toHaveBeenCalledTimes(1);
    const payload = mockUpdateMyPreferences.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(Object.keys(payload)).not.toContain("defaultStatusFilter");
  });

  it("ignores the defaults actions when signed out", async () => {
    const { result } = renderHook(() =>
      useFilterSidebar({ hideStatus: false })
    );

    await act(async () => {
      await result.current.saveDefaults();
      await result.current.clearDefaults();
    });

    expect(mockUpdateMyPreferences).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("clears the saved defaults and resets the filters", async () => {
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    mockUpdateMyPreferences.mockResolvedValue(null);
    setSearchParams({ q: "tractor", make: "John Deere" });
    const { result } = renderHook(() =>
      useFilterSidebar({ hideStatus: false })
    );

    act(() => {
      result.current.updateParam("minYear", "2020");
    });
    mockSetSearchParams.mockClear();

    await act(async () => {
      await result.current.clearDefaults();
    });

    expect(mockUpdateMyPreferences).toHaveBeenCalledWith({
      defaultStatusFilter: undefined,
      defaultMake: undefined,
      defaultMinYear: undefined,
      defaultMaxYear: undefined,
      defaultMinPrice: undefined,
      defaultMaxPrice: undefined,
      defaultMaxHours: undefined,
    });
    expect(result.current.filters.status).toBe("active");
    expect(result.current.filters.minYear).toBe("");
    const [written] = mockSetSearchParams.mock.calls[0] as [URLSearchParams];
    expect(written.get("q")).toBe("tractor");
    expect(toast.success).toHaveBeenCalledWith("Default filters cleared");
  });

  it("reports a failed save", async () => {
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    mockUpdateMyPreferences.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() =>
      useFilterSidebar({ hideStatus: false })
    );

    await act(async () => {
      await result.current.saveDefaults();
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to save default filters");
    expect(result.current.pendingDefaultsAction).toBeNull();
  });

  it("reports a failed clear", async () => {
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    mockUpdateMyPreferences.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() =>
      useFilterSidebar({ hideStatus: false })
    );

    await act(async () => {
      await result.current.clearDefaults();
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to clear default filters");
  });

  it("applies saved preferences once they load", () => {
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    preferences = { defaultStatusFilter: "closed", defaultMake: "Case IH" };
    const { result } = renderHook(() =>
      useFilterSidebar({ hideStatus: false })
    );

    expect(result.current.filters.status).toBe("closed");
    expect(result.current.filters.make).toBe("Case IH");
  });

  it("re-applies preferences after the signed-in user changes", () => {
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    preferences = { defaultMake: "John Deere" };
    const { result, rerender } = renderHook(() =>
      useFilterSidebar({ hideStatus: false })
    );
    expect(result.current.filters.make).toBe("John Deere");

    // A user switch resets the "preferences applied" flag so the next user's
    // defaults are seeded instead of the previous user's.
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u2" } } });
    rerender();
    // The preferences query then resolves for the new user.
    preferences = { defaultMake: "Case IH" };
    rerender();

    expect(result.current.filters.make).toBe("Case IH");
  });
});
