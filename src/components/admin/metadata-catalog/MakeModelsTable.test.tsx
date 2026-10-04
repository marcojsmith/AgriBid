import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import { MakeModelsTable } from "./MakeModelsTable";
import type { EquipmentMetadata } from "./types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const make: EquipmentMetadata = {
  _id: "m1" as Id<"equipmentMetadata">,
  _creationTime: 0,
  make: "John Deere",
  categoryId: "cat1" as Id<"equipmentCategories">,
  categoryName: "Tractors",
  models: ["8R 410", "7R 330"],
  isActive: true,
};

const mockRemoveModel = vi.fn();

describe("MakeModelsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists every model of the make", () => {
    render(<MakeModelsTable item={make} removeModel={mockRemoveModel} />);

    expect(screen.getByText("8R 410")).toBeInTheDocument();
    expect(screen.getByText("7R 330")).toBeInTheDocument();
  });

  it("removes a model once the confirmation is accepted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockRemoveModel.mockResolvedValue({});
    render(<MakeModelsTable item={make} removeModel={mockRemoveModel} />);

    fireEvent.click(
      screen.getByLabelText("Remove model 8R 410 from John Deere")
    );

    await waitFor(() => {
      expect(mockRemoveModel).toHaveBeenCalledWith({
        id: "m1",
        model: "8R 410",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Model removed");
  });

  it("does nothing when the confirmation is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<MakeModelsTable item={make} removeModel={mockRemoveModel} />);

    fireEvent.click(
      screen.getByLabelText("Remove model 8R 410 from John Deere")
    );

    expect(mockRemoveModel).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("reports a failed removal", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockRemoveModel.mockRejectedValue(new Error("Delete fail"));
    render(<MakeModelsTable item={make} removeModel={mockRemoveModel} />);

    fireEvent.click(
      screen.getByLabelText("Remove model 8R 410 from John Deere")
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Delete fail");
    });
  });
});
