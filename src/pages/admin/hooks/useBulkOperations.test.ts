import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { Id, Doc } from "convex/_generated/dataModel";

import { useBulkOperations } from "./useBulkOperations";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      bulkUpdateAuctions: "auctions:bulkUpdateAuctions",
    },
  },
}));

describe("useBulkOperations hook", () => {
  const mockBulkUpdate = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useMutation).mockImplementation(((apiPath: string) => {
      if (apiPath === "auctions:bulkUpdateAuctions") return mockBulkUpdate;
      return vi.fn();
    }) as unknown as ReturnType<typeof useMutation>);
  });

  describe("getSelectionState branches", () => {
    it("should handle empty auctions list (default and explicit)", () => {
      const { result } = renderHook(() => useBulkOperations());

      const state1 = result.current.getSelectionState(); // Default []
      expect(state1.isAllSelected).toBe(false);
      expect(state1.isPartiallySelected).toBe(false);

      const state2 = result.current.getSelectionState([]); // Explicit []
      expect(state2.isAllSelected).toBe(false);
    });

    it("should handle partial selection branches", () => {
      const { result } = renderHook(() => useBulkOperations());
      const auctions = [{ _id: "a1" }, { _id: "a2" }] as Doc<"auctions">[];

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"auctions">, true);
      });

      const state = result.current.getSelectionState(auctions);
      expect(state.isAllSelected).toBe(false);
      expect(state.isPartiallySelected).toBe(true);
    });
  });

  describe("handleSelectAll branches", () => {
    it("should handle deselect all", () => {
      const { result } = renderHook(() => useBulkOperations());
      const auctions = [{ _id: "a1" }] as Doc<"auctions">[];

      act(() => {
        result.current.handleSelectAll(auctions, true);
      });
      expect(result.current.selectedAuctions).toContain("a1");

      act(() => {
        result.current.handleSelectAll(auctions, false);
      });
      expect(result.current.selectedAuctions).not.toContain("a1");
    });
  });

  describe("handleToggleSelection branches", () => {
    it("should not add duplicate ID if already selected", () => {
      const { result } = renderHook(() => useBulkOperations());

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"auctions">, true);
      });
      expect(result.current.selectedAuctions).toHaveLength(1);

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"auctions">, true);
      });
      expect(result.current.selectedAuctions).toHaveLength(1); // Still 1
    });

    it("should remove ID if selected is false", () => {
      const { result } = renderHook(() => useBulkOperations());

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"auctions">, true);
      });
      expect(result.current.selectedAuctions).toHaveLength(1);

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"auctions">, false);
      });
      expect(result.current.selectedAuctions).toHaveLength(0);
    });
  });

  describe("handleBulkStatusUpdate branches", () => {
    it("should return immediately if no selections or no target", async () => {
      const { result } = renderHook(() => useBulkOperations());

      // No selections, target set
      act(() => {
        result.current.setBulkStatusTarget("active");
      });
      await act(async () => {
        await result.current.handleBulkStatusUpdate();
      });
      expect(mockBulkUpdate).not.toHaveBeenCalled();

      // Selections present, no target
      act(() => {
        result.current.setBulkStatusTarget(null);
        result.current.handleToggleSelection("a1" as Id<"auctions">, true);
      });
      await act(async () => {
        await result.current.handleBulkStatusUpdate();
      });
      expect(mockBulkUpdate).not.toHaveBeenCalled();
    });

    it("should handle catch block on mutation failure", async () => {
      const { result } = renderHook(() => useBulkOperations());
      mockBulkUpdate.mockRejectedValue(new Error("Mutation failed"));

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"auctions">, true);
        result.current.setBulkStatusTarget("active");
      });

      await act(async () => {
        await result.current.handleBulkStatusUpdate();
      });

      expect(toast.error).toHaveBeenCalledWith("Mutation failed");
      expect(result.current.isBulkProcessing).toBe(false);
    });
  });
});
