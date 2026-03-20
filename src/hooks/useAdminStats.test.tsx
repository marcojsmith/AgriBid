import React from "react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import {
  AdminStatsContext,
  type AdminStats,
} from "@/contexts/admin-stats-types";

import { useAdminStats } from "./useAdminStats";

describe("useAdminStats", () => {
  it("should throw error when used outside of Provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useAdminStats())).toThrow(
      "useAdminStats must be used within an AdminStatsProvider"
    );

    consoleSpy.mockRestore();
  });

  it("should return context when used within Provider", () => {
    const mockStats = { totalUsers: 100, activeAuctions: 50 };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminStatsContext.Provider value={mockStats as unknown as AdminStats}>
        {children}
      </AdminStatsContext.Provider>
    );

    const { result } = renderHook(() => useAdminStats(), { wrapper });
    expect(result.current).toBe(mockStats);
  });
});
