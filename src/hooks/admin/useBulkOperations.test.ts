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
      mutations: {
        update: {
          bulkUpdateLots: "auctions/mutations/update:bulkUpdateLots",
        },
      },
    },
  },
}));

describe("useBulkOperations hook", () => {
  const mockBulkUpdate = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useMutation).mockImplementation(((apiPath: string) => {
      if (apiPath === "auctions/mutations/update:bulkUpdateLots")
        return mockBulkUpdate;
      return vi.fn();
    }) as unknown as typeof useMutation);
  });

  describe("getSelectionState branches", () => {
    it("should handle empty auctions list (default and explicit)", () => {
      const { result } = renderHook(() => useBulkOperations());

      const state1 = result.current.getSelectionState();
      expect(state1.isAllSelected).toBe(false);
      expect(state1.isPartiallySelected).toBe(false);

      const state2 = result.current.getSelectionState([]);
      expect(state2.isAllSelected).toBe(false);
    });

    it("should handle partial selection branches", () => {
      const { result } = renderHook(() => useBulkOperations());
      const auctions = [{ _id: "a1" }, { _id: "a2" }] as Doc<"lots">[];

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"lots">, true);
      });

      const state = result.current.getSelectionState(auctions);
      expect(state.isAllSelected).toBe(false);
      expect(state.isPartiallySelected).toBe(true);
    });
  });

  describe("handleSelectAll branches", () => {
    it("should handle deselect all", () => {
      const { result } = renderHook(() => useBulkOperations());
      const auctions = [{ _id: "a1" }] as Doc<"lots">[];

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
        result.current.handleToggleSelection("a1" as Id<"lots">, true);
      });
      expect(result.current.selectedAuctions).toHaveLength(1);

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"lots">, true);
      });
      expect(result.current.selectedAuctions).toHaveLength(1);
    });

    it("should remove ID if selected is false", () => {
      const { result } = renderHook(() => useBulkOperations());

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"lots">, true);
      });
      expect(result.current.selectedAuctions).toHaveLength(1);

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"lots">, false);
      });
      expect(result.current.selectedAuctions).toHaveLength(0);
    });
  });

  describe("handleBulkStatusUpdate branches", () => {
    it("should return immediately if no selections or no target", async () => {
      const { result } = renderHook(() => useBulkOperations());

      act(() => {
        result.current.setBulkStatusTarget("approved");
      });
      await act(async () => {
        await result.current.handleBulkStatusUpdate();
      });
      expect(mockBulkUpdate).not.toHaveBeenCalled();

      act(() => {
        result.current.setBulkStatusTarget(null);
        result.current.handleToggleSelection("a1" as Id<"lots">, true);
      });
      await act(async () => {
        await result.current.handleBulkStatusUpdate();
      });
      expect(mockBulkUpdate).not.toHaveBeenCalled();
    });

    it("should handle successful bulk status update", async () => {
      const { result } = renderHook(() => useBulkOperations());
      mockBulkUpdate.mockResolvedValue(undefined);

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"lots">, true);
        result.current.setBulkStatusTarget("approved");
      });

      await act(async () => {
        await result.current.handleBulkStatusUpdate();
      });

      expect(mockBulkUpdate).toHaveBeenCalledWith({
        lotIds: ["a1"],
        updates: { status: "approved" },
      });
      expect(toast.success).toHaveBeenCalledWith("Updated 1 lots to approved");
      expect(result.current.selectedAuctions).toHaveLength(0);
      expect(result.current.isBulkProcessing).toBe(false);
      expect(result.current.bulkStatusTarget).toBe(null);
    });

    it("should handle catch block on mutation failure", async () => {
      const { result } = renderHook(() => useBulkOperations());
      mockBulkUpdate.mockRejectedValue(new Error("Mutation failed"));

      act(() => {
        result.current.handleToggleSelection("a1" as Id<"lots">, true);
        result.current.setBulkStatusTarget("approved");
      });

      await act(async () => {
        await result.current.handleBulkStatusUpdate();
      });

      expect(toast.error).toHaveBeenCalledWith("Mutation failed");
      expect(result.current.isBulkProcessing).toBe(false);
    });
  });
});
