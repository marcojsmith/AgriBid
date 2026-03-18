import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, render as rtlRender } from "@testing-library/react";
import * as convexReact from "convex/react";

import { AdminStatsProvider } from "./AdminStatsContext";
import { useAdminStats } from "./useAdminStats";

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

describe("AdminStatsContext", () => {
  const mockStats = {
    totalAuctions: 100,
    activeAuctions: 50,
    pendingReview: 10,
    totalUsers: 1000,
    verifiedSellers: 200,
    kycPending: 50,
    status: "healthy" as const,
    liveUsers: 10,
    activeWatch: 20,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("AdminStatsProvider", () => {
    it("should render children", () => {
      const { container } = render(
        <AdminStatsProvider>
          <div>Test Content</div>
        </AdminStatsProvider>
      );

      expect(container).toHaveTextContent("Test Content");
    });

    it("should provide stats to children", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(mockStats);

      const TestComponent = () => {
        const stats = useAdminStats();
        return <div>{stats?.totalAuctions}</div>;
      };

      const { container } = render(
        <AdminStatsProvider>
          <TestComponent />
        </AdminStatsProvider>
      );

      expect(container).toHaveTextContent("100");
    });
  });

  describe("useAdminStats", () => {
    it("should return stats when used within provider", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(mockStats);

      const { result } = renderHook(() => useAdminStats(), {
        wrapper: AdminStatsProvider,
      });

      expect(result.current).toEqual(mockStats);
    });

    it("should return undefined while loading", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(undefined);

      const { result } = renderHook(() => useAdminStats(), {
        wrapper: AdminStatsProvider,
      });

      expect(result.current).toBeUndefined();
    });
  });
});

// Helper function to render components for testing
function render(element: ReactNode) {
  return rtlRender(element);
}
