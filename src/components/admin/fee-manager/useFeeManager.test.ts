import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";

import { useFeeManager } from "./useFeeManager";
import {
  defaultFeeFormData,
  type FeeFormData,
  type PlatformFee,
} from "./types";

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

vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getPlatformFees: "admin:getPlatformFees",
      createPlatformFee: "admin:createPlatformFee",
      updatePlatformFee: "admin:updatePlatformFee",
      deletePlatformFee: "admin:deletePlatformFee",
      reorderPlatformFees: "admin:reorderPlatformFees",
    },
  },
}));

/**
 * Builds a platform fee document for tests.
 *
 * @param overrides - Fields to override on the default fee.
 * @returns A complete fee document.
 */
const makeFee = (overrides: Partial<PlatformFee> = {}): PlatformFee => ({
  _id: "fee1" as Id<"platformFees">,
  _creationTime: 0,
  name: "Seller Commission",
  feeType: "percentage",
  value: 0.05,
  appliesTo: "seller",
  isActive: true,
  visibleToBuyer: false,
  visibleToSeller: true,
  sortOrder: 0,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const mockCreateFee = vi.fn();
const mockUpdateFee = vi.fn();
const mockDeleteFee = vi.fn();
const mockReorderFees = vi.fn();

let queryResult: { allFees: PlatformFee[] } | undefined;

/**
 * Form states the create/edit validation must reject before any mutation runs.
 */
const invalidFormCases: {
  label: string;
  overrides: Partial<FeeFormData>;
  message: string;
}[] = [
  {
    label: "a blank name",
    overrides: { name: " " },
    message: "Fee name is required",
  },
  {
    label: "a percentage below the minimum",
    overrides: { name: "Fee", value: 0 },
    message: "Percentage must be between 0.01% and 100%",
  },
  {
    label: "a percentage above the maximum",
    overrides: { name: "Fee", value: 100.5 },
    message: "Percentage must be between 0.01% and 100%",
  },
  {
    label: "a non-positive fixed fee",
    overrides: { name: "Fee", feeType: "fixed", value: 0 },
    message: "Fixed fee must be greater than 0",
  },
];

describe("useFeeManager hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResult = {
      allFees: [
        makeFee({ _id: "fee2" as Id<"platformFees">, sortOrder: 1 }),
        makeFee({ _id: "fee1" as Id<"platformFees">, sortOrder: 0 }),
      ],
    };
    (useQuery as Mock).mockImplementation((apiPath: string) =>
      apiPath === "admin:getPlatformFees" ? queryResult : undefined
    );
    (useMutation as Mock).mockImplementation((apiPath: string) => {
      if (apiPath === "admin:createPlatformFee") return mockCreateFee;
      if (apiPath === "admin:updatePlatformFee") return mockUpdateFee;
      if (apiPath === "admin:deletePlatformFee") return mockDeleteFee;
      if (apiPath === "admin:reorderPlatformFees") return mockReorderFees;
      return vi.fn();
    });
  });

  it("sorts the fees it exposes for display", () => {
    const { result } = renderHook(() => useFeeManager());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fees.map((fee) => fee._id)).toEqual(["fee1", "fee2"]);
  });

  it("reports loading and no fees while the query is in flight", () => {
    queryResult = undefined;
    const { result } = renderHook(() => useFeeManager());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.fees).toEqual([]);
  });

  it("opens a blank create form", () => {
    const { result } = renderHook(() => useFeeManager());

    act(() => {
      result.current.openCreate();
    });

    expect(result.current.isFormOpen).toBe(true);
    expect(result.current.editingFeeId).toBeNull();
    expect(result.current.formData).toEqual(defaultFeeFormData);
  });

  it("loads a fee into the form, scaling percentages and defaulting the description", () => {
    const { result } = renderHook(() => useFeeManager());
    const fee = makeFee({ _id: "fee9" as Id<"platformFees">, value: 0.07 });

    act(() => {
      result.current.openEdit(fee);
    });

    expect(result.current.editingFeeId).toBe("fee9");
    const { value: formValue, ...restOfFormData } = result.current.formData;
    expect(restOfFormData).toEqual({
      ...defaultFeeFormData,
      name: "Seller Commission",
      description: "",
      visibleToBuyer: false,
      visibleToSeller: true,
      value: undefined,
    });
    // 7% shown as 7 on the form's percent scale.
    expect(formValue).toBeCloseTo(7);
  });

  it("keeps a fixed fee value unscaled when editing", () => {
    const { result } = renderHook(() => useFeeManager());

    act(() => {
      result.current.openEdit(
        makeFee({ feeType: "fixed", value: 250, description: "Storage" })
      );
    });

    expect(result.current.formData.value).toBe(250);
    expect(result.current.formData.description).toBe("Storage");
  });

  it("creates a fee and closes the dialog", async () => {
    mockCreateFee.mockResolvedValue({});
    const { result } = renderHook(() => useFeeManager());

    act(() => {
      result.current.openCreate();
      result.current.setFormData({
        ...defaultFeeFormData,
        name: "New Fee",
        value: 10,
      });
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(mockCreateFee).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Fee", value: 0.1 })
    );
    expect(toast.success).toHaveBeenCalledWith("Fee created successfully");
    expect(result.current.isFormOpen).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  it("updates an existing fee with its id", async () => {
    mockUpdateFee.mockResolvedValue({});
    const { result } = renderHook(() => useFeeManager());

    act(() => {
      result.current.openEdit(makeFee({ _id: "fee5" as Id<"platformFees"> }));
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(mockUpdateFee).toHaveBeenCalledWith(
      expect.objectContaining({ feeId: "fee5", value: 0.05 })
    );
    expect(toast.success).toHaveBeenCalledWith("Fee updated successfully");
  });

  it.each(invalidFormCases)(
    "rejects $label without calling a mutation",
    async ({ overrides, message }) => {
      const { result } = renderHook(() => useFeeManager());

      act(() => {
        result.current.setFormData({ ...defaultFeeFormData, ...overrides });
      });
      await act(async () => {
        await result.current.submit();
      });

      expect(toast.error).toHaveBeenCalledWith(message);
      expect(mockCreateFee).not.toHaveBeenCalled();
    }
  );

  it("reports the mutation error when saving fails", async () => {
    mockCreateFee.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useFeeManager());

    act(() => {
      result.current.setFormData({
        ...defaultFeeFormData,
        name: "New Fee",
        value: 10,
      });
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(toast.error).toHaveBeenCalledWith("Network error");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("falls back to a generic message when a save throws a non-Error", async () => {
    mockCreateFee.mockRejectedValue("boom");
    const { result } = renderHook(() => useFeeManager());

    act(() => {
      result.current.setFormData({
        ...defaultFeeFormData,
        name: "New Fee",
        value: 10,
      });
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to save fee");
  });

  it("deletes the selected fee and closes the dialog", async () => {
    mockDeleteFee.mockResolvedValue({});
    const { result } = renderHook(() => useFeeManager());

    act(() => {
      result.current.openDelete("fee3" as Id<"platformFees">);
    });
    expect(result.current.isDeleteDialogOpen).toBe(true);

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(mockDeleteFee).toHaveBeenCalledWith({ feeId: "fee3" });
    expect(toast.success).toHaveBeenCalledWith("Fee deleted successfully");
    expect(result.current.isDeleteDialogOpen).toBe(false);
  });

  it("does nothing when no fee is selected for deletion", async () => {
    const { result } = renderHook(() => useFeeManager());

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(mockDeleteFee).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and reports the error when deletion fails", async () => {
    mockDeleteFee.mockRejectedValue(new Error("Delete failed"));
    const { result } = renderHook(() => useFeeManager());

    act(() => {
      result.current.openDelete("fee3" as Id<"platformFees">);
    });
    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(toast.error).toHaveBeenCalledWith("Delete failed");
    expect(result.current.isDeleteDialogOpen).toBe(true);
  });

  it("falls back to a generic message when deletion throws a non-Error", async () => {
    mockDeleteFee.mockRejectedValue("boom");
    const { result } = renderHook(() => useFeeManager());

    act(() => {
      result.current.openDelete("fee3" as Id<"platformFees">);
    });
    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to delete fee");
  });

  it("moves a fee up by swapping it with the previous row", async () => {
    mockReorderFees.mockResolvedValue({});
    const { result } = renderHook(() => useFeeManager());

    await act(async () => {
      await result.current.moveUp(1);
    });

    expect(mockReorderFees).toHaveBeenCalledWith({
      feeIds: ["fee2", "fee1"],
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Fee order updated successfully"
    );
  });

  it("moves a fee down by swapping it with the next row", async () => {
    mockReorderFees.mockResolvedValue({});
    const { result } = renderHook(() => useFeeManager());

    await act(async () => {
      await result.current.moveDown(0);
    });

    expect(mockReorderFees).toHaveBeenCalledWith({
      feeIds: ["fee2", "fee1"],
    });
  });

  it("ignores moves past either end of the list", async () => {
    const { result } = renderHook(() => useFeeManager());

    await act(async () => {
      await result.current.moveUp(0);
      await result.current.moveDown(1);
    });

    expect(mockReorderFees).not.toHaveBeenCalled();
  });

  it("reports the error when reordering fails", async () => {
    mockReorderFees.mockRejectedValue(new Error("Reorder failed"));
    const { result } = renderHook(() => useFeeManager());

    await act(async () => {
      await result.current.moveDown(0);
    });

    expect(toast.error).toHaveBeenCalledWith("Reorder failed");
    expect(result.current.reorderingIndex).toBeNull();
  });

  it("falls back to a generic message when reordering throws a non-Error", async () => {
    mockReorderFees.mockRejectedValue("boom");
    const { result } = renderHook(() => useFeeManager());

    await act(async () => {
      await result.current.moveUp(1);
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to reorder fees");
  });

  it("ignores further moves while a reorder is in flight", async () => {
    let releaseReorder: (() => void) | undefined;
    mockReorderFees.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseReorder = resolve;
        })
    );
    const { result } = renderHook(() => useFeeManager());

    let inFlight: Promise<void> | undefined;
    act(() => {
      inFlight = result.current.moveUp(1);
    });
    expect(result.current.reorderingIndex).toBe(1);

    await act(async () => {
      await result.current.moveDown(0);
    });
    expect(mockReorderFees).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseReorder?.();
      await inFlight;
    });
    expect(result.current.reorderingIndex).toBeNull();
  });
});
