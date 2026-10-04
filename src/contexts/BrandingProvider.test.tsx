import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as rtlRender, renderHook } from "@testing-library/react";
import { useQuery } from "convex/react";
import * as convexApi from "convex/_generated/api";

import { useBranding, type Branding } from "@/hooks/useBranding";

import { BrandingProvider } from "./BrandingProvider";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getBusinessInfo: "mockGetBusinessInfo",
    },
  },
}));

interface BrandingHookResult {
  current: Branding | null | undefined;
}

/**
 * Reads the branding value from a `renderHook` result, failing loudly when the
 * hook has not produced a value yet.
 *
 * @param result - The result object returned by `renderHook`
 * @returns The branding value the hook currently exposes
 */
function currentBranding(result: BrandingHookResult): Branding {
  if (result.current === null || result.current === undefined) {
    throw new Error("Expected useBranding to return a branding value");
  }
  return result.current;
}

describe("BrandingProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    const { container } = render(
      <BrandingProvider>
        <div>Test Content</div>
      </BrandingProvider>
    );
    expect(container).toHaveTextContent("Test Content");
  });

  it("should provide SITE_NAME as appName while loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);

    const { result } = renderHook(() => useBranding(), {
      wrapper: BrandingProvider,
    });

    expect(currentBranding(result).appName).toBe("AgriBid");
  });

  it("should provide business name when available", () => {
    vi.mocked(useQuery).mockReturnValue({
      businessName: "Custom Farm Equipment",
    });

    const { result } = renderHook(() => useBranding(), {
      wrapper: BrandingProvider,
    });

    expect(currentBranding(result).appName).toBe("Custom Farm Equipment");
  });

  it("should fall back to SITE_NAME when businessName is empty string", () => {
    vi.mocked(useQuery).mockReturnValue({
      businessName: "",
    });

    const { result } = renderHook(() => useBranding(), {
      wrapper: BrandingProvider,
    });

    expect(currentBranding(result).appName).toBe("AgriBid");
  });

  it("should fall back to SITE_NAME when businessName is whitespace", () => {
    vi.mocked(useQuery).mockReturnValue({
      businessName: "   ",
    });

    const { result } = renderHook(() => useBranding(), {
      wrapper: BrandingProvider,
    });

    expect(currentBranding(result).appName).toBe("AgriBid");
  });

  it("should trim business name", () => {
    vi.mocked(useQuery).mockReturnValue({
      businessName: "  Trimmed Name  ",
    });

    const { result } = renderHook(() => useBranding(), {
      wrapper: BrandingProvider,
    });

    expect(currentBranding(result).appName).toBe("Trimmed Name");
  });

  it("should expose the raw business info for descendants", () => {
    const businessInfo = {
      businessName: "Test Business",
      telephone: "+27-11-000-0000",
    };
    vi.mocked(useQuery).mockReturnValue(businessInfo);

    const { result } = renderHook(() => useBranding(), {
      wrapper: BrandingProvider,
    });

    expect(currentBranding(result).businessInfo).toEqual(businessInfo);
  });

  it("should expose no business info while loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);

    const { result } = renderHook(() => useBranding(), {
      wrapper: BrandingProvider,
    });

    expect(currentBranding(result).businessInfo).toBeUndefined();
  });

  it("should call useQuery with correct query", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);

    render(
      <BrandingProvider>
        <div>Test</div>
      </BrandingProvider>
    );

    expect(useQuery).toHaveBeenCalledWith(convexApi.api.admin.getBusinessInfo);
  });
});

describe("useBranding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw error when used outside of provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // intentional no-op: suppress expected missing-provider error log
    });

    expect(() => renderHook(() => useBranding())).toThrow(
      "useBranding must be used within a BrandingProvider"
    );

    consoleSpy.mockRestore();
  });

  it("should return branding values when used within provider", () => {
    vi.mocked(useQuery).mockReturnValue({
      businessName: "Test Business",
    });

    const { result } = renderHook(() => useBranding(), {
      wrapper: BrandingProvider,
    });

    expect(result.current).toEqual({
      appName: "Test Business",
      businessInfo: { businessName: "Test Business" },
    });
  });

  it("should maintain stable context value identity across unrelated re-renders", () => {
    vi.mocked(useQuery).mockReturnValue({
      businessName: "Stable Business",
    });

    const { result, rerender } = renderHook(() => useBranding(), {
      wrapper: BrandingProvider,
    });

    const value1 = currentBranding(result);
    rerender();
    const value2 = currentBranding(result);

    expect(Object.is(value1, value2)).toBe(true);
  });
});

function render(element: ReactNode) {
  return rtlRender(element);
}
