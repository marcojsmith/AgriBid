import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Doc, Id } from "convex/_generated/dataModel";
import { toast } from "sonner";

import { MetadataCatalog } from "./MetadataCatalog";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Accordion to force mount content and avoid animation delays
vi.mock("@/components/ui/accordion", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Accordion: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AccordionItem: ({ children, className }: any) => <div className={className}>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AccordionTrigger: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AccordionContent: ({ children }: any) => <div>{children}</div>,
}));

// Mock Select component to use native HTML elements for easier testing
vi.mock("@/components/ui/select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Select: ({ children, onValueChange, value }: any) => (
    <select 
      value={value} 
      onChange={(e) => onValueChange(e.target.value)}
      data-testid="mock-select"
    >
      <option value="">Select category</option>
      {children}
    </select>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SelectTrigger: ({ children, id }: any) => <div id={id}>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SelectContent: ({ children }: any) => <>{children}</>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

describe("MetadataCatalog Full Coverage", () => {
  const mockCategories: Doc<"equipmentCategories">[] = [
    {
      _id: "cat1" as Id<"equipmentCategories">,
      _creationTime: Date.now(),
      name: "Tractors",
      isActive: true,
    },
    {
      _id: "cat2" as Id<"equipmentCategories">,
      _creationTime: Date.now(),
      name: "Harvesters",
      isActive: true,
    },
  ];

  const mockMetadata = [
    {
      _id: "m1" as Id<"equipmentMetadata">,
      _creationTime: Date.now(),
      make: "John Deere",
      categoryId: "cat1" as Id<"equipmentCategories">,
      categoryName: "Tractors",
      models: ["8R 410", "7R 330"],
      isActive: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedAt: undefined as any, // Test "Never" branch on first item
    },
    {
      _id: "m2" as Id<"equipmentMetadata">,
      _creationTime: Date.now(),
      make: "Case IH",
      categoryId: "cat1" as Id<"equipmentCategories">,
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
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  const renderCatalog = (metadata = mockMetadata) => {
    return render(
      <MetadataCatalog
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata={metadata as any}
        categories={mockCategories}
        addMake={mockAddMake}
        updateMake={mockUpdateMake}
        deleteMake={mockDeleteMake}
        addModel={mockAddModel}
        removeModel={mockRemoveModel}
      />
    );
  };

  it("should render the list of makes and handle 'Never' updated", async () => {
    renderCatalog();
    expect(screen.getByText("John Deere")).toBeInTheDocument();
    expect(screen.getAllByText("Case IH")[0]).toBeInTheDocument();
    
    // In our mock, content is always visible.
    expect(screen.getByText(/Never/)).toBeInTheDocument();
  });

  it("should show empty state when no metadata", () => {
    renderCatalog([]);
    expect(screen.getByText(/No equipment makes found/i)).toBeInTheDocument();
  });

  describe("Add Make Flow", () => {
    it("should show error if fields are missing", async () => {
      renderCatalog();
      fireEvent.click(screen.getByText("Add Make"));
      
      const submitBtn = screen.getAllByRole("button", { name: "Add Make" }).pop()!;
      fireEvent.click(submitBtn);
      
      expect(toast.error).toHaveBeenCalledWith("All fields are required");
    });

    it("should add a new make successfully", async () => {
      mockAddMake.mockResolvedValue({ success: true });
      renderCatalog();
      
      fireEvent.click(screen.getByText("Add Make"));
      
      fireEvent.change(screen.getByLabelText(/Manufacturer Name/i), { target: { value: "Fendt" } });
      fireEvent.change(screen.getByTestId("mock-select"), { target: { value: "cat1" } });
      fireEvent.change(screen.getByLabelText(/Initial Model/i), { target: { value: "1050 Vario" } });
      
      await act(async () => {
        const submitBtn = screen.getAllByRole("button", { name: "Add Make" }).pop()!;
        fireEvent.click(submitBtn);
      });

      expect(mockAddMake).toHaveBeenCalledWith({
        make: "Fendt",
        categoryId: "cat1",
        models: ["1050 Vario"]
      });
      expect(toast.success).toHaveBeenCalledWith("Equipment make added successfully");
    });

    it("should handle add make error", async () => {
      mockAddMake.mockRejectedValue(new Error("Failed to add"));
      renderCatalog();
      
      fireEvent.click(screen.getByText("Add Make"));
      fireEvent.change(screen.getByLabelText(/Manufacturer Name/i), { target: { value: "Fendt" } });
      fireEvent.change(screen.getByTestId("mock-select"), { target: { value: "cat1" } });
      fireEvent.change(screen.getByLabelText(/Initial Model/i), { target: { value: "X" } });
      
      await act(async () => {
        const submitBtn = screen.getAllByRole("button", { name: "Add Make" }).pop()!;
        fireEvent.click(submitBtn);
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to add");
    });
  });

  describe("Edit Make Flow", () => {
    it("should update make successfully", async () => {
      mockUpdateMake.mockResolvedValue({ success: true });
      renderCatalog();

      // Click first Edit button
      fireEvent.click(screen.getAllByText("Edit")[0]);

      fireEvent.change(screen.getByLabelText("Name"), { target: { value: "JD Updated" } });
      fireEvent.change(screen.getByTestId("mock-select"), { target: { value: "cat2" } });

      await act(async () => {
        fireEvent.click(screen.getByText("Save Changes"));
      });

      expect(mockUpdateMake).toHaveBeenCalledWith(expect.objectContaining({
        make: "JD Updated",
        categoryId: "cat2"
      }));
      expect(toast.success).toHaveBeenCalledWith("Manufacturer updated");
    });

    it("should validate required fields in edit", async () => {
      renderCatalog();
      fireEvent.click(screen.getAllByText("Edit")[0]);

      fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  " } });
      fireEvent.click(screen.getByText("Save Changes"));
      expect(toast.error).toHaveBeenCalledWith("Manufacturer name is required");
    });

    it("should handle update error", async () => {
      mockUpdateMake.mockRejectedValue(new Error("Update failed"));
      renderCatalog();
      fireEvent.click(screen.getAllByText("Edit")[0]);
      
      await act(async () => {
        fireEvent.click(screen.getByText("Save Changes"));
      });
      expect(toast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  describe("Deactivate/Reactivate Flow", () => {
    it("should deactivate when confirmed", async () => {
      mockDeleteMake.mockResolvedValue({});
      renderCatalog();
      
      await act(async () => {
        fireEvent.click(screen.getByText("Deactivate"));
      });
      expect(mockDeleteMake).toHaveBeenCalledWith({ id: "m1" });
      expect(toast.success).toHaveBeenCalledWith("Manufacturer deactivated");
    });

    it("should reactivate when confirmed", async () => {
      mockUpdateMake.mockResolvedValue({});
      
      // Ensure m2 has a categoryId for this test
      const itemWithCat = { ...mockMetadata[1], categoryId: "cat1" as Id<"equipmentCategories"> };
      renderCatalog([mockMetadata[0], itemWithCat]);
      
      await act(async () => {
        fireEvent.click(screen.getByText("Reactivate"));
      });
      expect(mockUpdateMake).toHaveBeenCalledWith(expect.objectContaining({
        id: "m2",
        isActive: true
      }));
      expect(toast.success).toHaveBeenCalledWith("Manufacturer reactivated");
    });

    it("should handle reactivation error", async () => {
      mockUpdateMake.mockRejectedValue(new Error("Fail"));
      const itemWithCat = { ...mockMetadata[1], categoryId: "cat1" as Id<"equipmentCategories"> };
      renderCatalog([mockMetadata[0], itemWithCat]);

      await act(async () => {
        fireEvent.click(screen.getByText("Reactivate"));
      });
      expect(toast.error).toHaveBeenCalledWith("Fail");
    });

    it("should show error if categoryId missing on reactivation", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemNoCat = { ...mockMetadata[1], categoryId: undefined as any };
      renderCatalog([mockMetadata[0], itemNoCat as any]);
      
      fireEvent.click(screen.getByText("Reactivate"));

      expect(toast.error).toHaveBeenCalledWith("Category linkage missing");
    });
  });

  describe("Model Management", () => {
    it("should add model on Enter key", async () => {
      mockAddModel.mockResolvedValue({});
      renderCatalog();
      fireEvent.click(screen.getAllByText("Add Model")[0]);

      const input = screen.getByLabelText(/Model Name/i);
      fireEvent.change(input, { target: { value: "NewModel" } });
      
      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      expect(mockAddModel).toHaveBeenCalledWith({ id: "m1", model: "NewModel" });
    });

    it("should validate model name", async () => {
      renderCatalog();
      fireEvent.click(screen.getAllByText("Add Model")[0]);
      
      await act(async () => {
        // The one in the dialog footer
        const submitBtn = screen.getAllByRole("button", { name: "Add Model" }).pop()!;
        fireEvent.click(submitBtn);
      });
      expect(toast.error).toHaveBeenCalledWith("Model name is required");
    });

    it("should handle remove model error", async () => {
      mockRemoveModel.mockRejectedValue(new Error("Delete fail"));
      renderCatalog();
      
      await waitFor(() => {
        const removeBtn = screen.getByLabelText(/Remove model 8R 410/i);
        fireEvent.click(removeBtn);
      });
      
      expect(toast.error).toHaveBeenCalledWith("Delete fail");
    });
  });
});
