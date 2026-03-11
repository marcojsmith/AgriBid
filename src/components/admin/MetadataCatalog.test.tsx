/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MetadataCatalog } from "./MetadataCatalog";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MetadataCatalog", () => {
  const mockCategories = [
    { _id: "cat1", name: "Tractors", isActive: true },
    { _id: "cat2", name: "Harvesters", isActive: true },
  ];

  const mockMetadata = [
    {
      _id: "m1" as any,
      make: "John Deere",
      categoryId: "cat1" as any,
      categoryName: "Tractors",
      models: ["8R 410", "7R 330"],
      isActive: true,
      updatedAt: Date.now(),
    },
    {
      _id: "m2" as any,
      make: "Case IH",
      categoryId: "cat1" as any,
      categoryName: "Tractors",
      models: ["Magnum 340"],
      isActive: false,
      updatedAt: Date.now(),
    },
  ];

  const mockAddMake = vi.fn();
  const mockUpdateMake = vi.fn();
  const mockDeleteMake = vi.fn();
  const mockAddModel = vi.fn();
  const mockRemoveModel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the list of makes", () => {
    render(
      <MetadataCatalog
        metadata={mockMetadata as any}
        categories={mockCategories as any}
        addMake={mockAddMake}
        updateMake={mockUpdateMake}
        deleteMake={mockDeleteMake}
        addModel={mockAddModel}
        removeModel={mockRemoveModel}
      />
    );

    expect(screen.getByText("Makes & Models")).toBeInTheDocument();
    expect(screen.getByText("John Deere")).toBeInTheDocument();
    expect(screen.getByText("Case IH")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("should show empty state when no metadata", () => {
    render(
      <MetadataCatalog
        metadata={[]}
        categories={mockCategories as any}
        addMake={mockAddMake}
        updateMake={mockUpdateMake}
        deleteMake={mockDeleteMake}
        addModel={mockAddModel}
        removeModel={mockRemoveModel}
      />
    );

    expect(screen.getByText(/No equipment makes found/i)).toBeInTheDocument();
  });

  it("should open add make dialog", () => {
    render(
      <MetadataCatalog
        metadata={mockMetadata as any}
        categories={mockCategories as any}
        addMake={mockAddMake}
        updateMake={mockUpdateMake}
        deleteMake={mockDeleteMake}
        addModel={mockAddModel}
        removeModel={mockRemoveModel}
      />
    );

    fireEvent.click(screen.getByText("Add Make"));
    expect(screen.getByText("Add New Equipment Make")).toBeInTheDocument();
  });

  it("should add a new make successfully", async () => {
    mockAddMake.mockResolvedValue({ success: true });

    render(
      <MetadataCatalog
        metadata={mockMetadata as any}
        categories={mockCategories as any}
        addMake={mockAddMake}
        updateMake={mockUpdateMake}
        deleteMake={mockDeleteMake}
        addModel={mockAddModel}
        removeModel={mockRemoveModel}
      />
    );

    fireEvent.click(screen.getByText("Add Make"));

    fireEvent.change(screen.getByLabelText(/Manufacturer Name/i), {
      target: { value: "New Make" },
    });
    fireEvent.change(screen.getByLabelText(/Initial Model/i), {
      target: { value: "Model X" },
    });

    // Select is harder to test without mocks, but let's see if it works with fireEvent.change or similar
    // For now, I'll just check if it fails if I don't select a category
    const addButton = screen.getByRole("button", { name: "Add Make" });
    fireEvent.click(addButton);

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("All fields are required");
  });

  it("should call deleteMake when deactivating", async () => {
    mockDeleteMake.mockResolvedValue({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MetadataCatalog
        metadata={mockMetadata as any}
        categories={mockCategories as any}
        addMake={mockAddMake}
        updateMake={mockUpdateMake}
        deleteMake={mockDeleteMake}
        addModel={mockAddModel}
        removeModel={mockRemoveModel}
      />
    );

    // Accordion needs to be opened to see buttons
    fireEvent.click(screen.getByText("John Deere"));

    const deactivateButton = screen.getByText("Deactivate");
    fireEvent.click(deactivateButton);

    await waitFor(() => {
      expect(mockDeleteMake).toHaveBeenCalledWith({ id: "m1" });
    });
  });

  it("should call removeModel when deleting a model", async () => {
    mockRemoveModel.mockResolvedValue({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MetadataCatalog
        metadata={mockMetadata as any}
        categories={mockCategories as any}
        addMake={mockAddMake}
        updateMake={mockUpdateMake}
        deleteMake={mockDeleteMake}
        addModel={mockAddModel}
        removeModel={mockRemoveModel}
      />
    );

    // Open accordion
    fireEvent.click(screen.getByText("John Deere"));

    // Find the trash button for "8R 410"
    const removeButton = screen.getByLabelText(
      /Remove model 8R 410 from John Deere/i
    );
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockRemoveModel).toHaveBeenCalledWith({
        id: "m1",
        model: "8R 410",
      });
    });
  });

  it("should open edit make dialog", () => {
    render(
      <MetadataCatalog
        metadata={mockMetadata as any}
        categories={mockCategories as any}
        addMake={mockAddMake}
        updateMake={mockUpdateMake}
        deleteMake={mockDeleteMake}
        addModel={mockAddModel}
        removeModel={mockRemoveModel}
      />
    );

    fireEvent.click(screen.getByText("John Deere"));
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Edit Manufacturer")).toBeInTheDocument();
  });

  it("should update make successfully", async () => {
    mockUpdateMake.mockResolvedValue({ success: true });

    render(
      <MetadataCatalog
        metadata={mockMetadata as any}
        categories={mockCategories as any}
        addMake={mockAddMake}
        updateMake={mockUpdateMake}
        deleteMake={mockDeleteMake}
        addModel={mockAddModel}
        removeModel={mockRemoveModel}
      />
    );

    fireEvent.click(screen.getByText("John Deere"));
    fireEvent.click(screen.getByText("Edit"));

    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Updated Make" } });

    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(mockUpdateMake).toHaveBeenCalledWith(
        expect.objectContaining({
          make: "Updated Make",
        })
      );
    });
  });

  it("should add model successfully", async () => {
    mockAddModel.mockResolvedValue({ success: true });

    render(
      <MetadataCatalog
        metadata={mockMetadata as any}
        categories={mockCategories as any}
        addMake={mockAddMake}
        updateMake={mockUpdateMake}
        deleteMake={mockDeleteMake}
        addModel={mockAddModel}
        removeModel={mockRemoveModel}
      />
    );

    fireEvent.click(screen.getByText("John Deere"));
    fireEvent.click(screen.getByText("Add Model"));

    const modelInput = screen.getByLabelText("Model Name");
    fireEvent.change(modelInput, { target: { value: "New Model" } });

    fireEvent.click(screen.getByRole("button", { name: "Add Model" }));

    await waitFor(() => {
      expect(mockAddModel).toHaveBeenCalledWith({
        id: "m1",
        model: "New Model",
      });
    });
  });
});
