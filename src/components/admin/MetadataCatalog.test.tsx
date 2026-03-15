import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react";
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
  Accordion: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionItem: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  AccordionTrigger: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  AccordionContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock Dialog component
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (o: boolean) => void;
  }) => (
    <div data-testid="dialog-root">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<{
              open?: boolean;
              onOpenChange?: (o: boolean) => void;
            }>,
            {
              open,
              onOpenChange,
            }
          );
        }
        return child;
      })}
    </div>
  ),
  DialogTrigger: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode;
    onOpenChange?: (o: boolean) => void;
  }) => (
    <div
      onClick={() => onOpenChange && onOpenChange(true)}
      data-testid="dialog-trigger"
    >
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (open ? <div data-testid="dialog-content">{children}</div> : null),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock Select component to use native HTML elements for easier testing
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange: (v: string) => void;
    value?: string;
  }) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      data-testid="mock-select"
    >
      <option value="">Select category</option>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

describe("MetadataCatalog Full Coverage", () => {
  type EquipmentMetadata = Doc<"equipmentMetadata"> & { categoryName: string };

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

  const mockMetadata: EquipmentMetadata[] = [
    {
      _id: "m1" as Id<"equipmentMetadata">,
      _creationTime: Date.now(),
      make: "John Deere",
      categoryId: "cat1" as Id<"equipmentCategories">,
      categoryName: "Tractors",
      models: ["8R 410", "7R 330"],
      isActive: true,
      updatedAt: undefined as unknown as number, // Test "Never" branch on first item
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
        metadata={metadata}
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

      const submitBtn = screen
        .getAllByRole("button", { name: "Add Make" })
        .pop()!;
      fireEvent.click(submitBtn);

      expect(toast.error).toHaveBeenCalledWith("All fields are required");
    });

    it("should add a new make successfully", async () => {
      mockAddMake.mockResolvedValue({ success: true });
      renderCatalog();

      fireEvent.click(screen.getByText("Add Make"));

      fireEvent.change(screen.getByLabelText(/Manufacturer Name/i), {
        target: { value: "Fendt" },
      });
      fireEvent.change(screen.getByTestId("mock-select"), {
        target: { value: "cat1" },
      });
      fireEvent.change(screen.getByLabelText(/Initial Model/i), {
        target: { value: "1050 Vario" },
      });

      await act(async () => {
        const submitBtn = screen
          .getAllByRole("button", { name: "Add Make" })
          .pop()!;
        fireEvent.click(submitBtn);
      });

      expect(mockAddMake).toHaveBeenCalledWith({
        make: "Fendt",
        categoryId: "cat1",
        models: ["1050 Vario"],
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Equipment make added successfully"
      );
    });
  });

  describe("Edit Make Flow", () => {
    it("should update make successfully", async () => {
      mockUpdateMake.mockResolvedValue({ success: true });
      renderCatalog();

      fireEvent.click(screen.getAllByText("Edit")[0]);

      fireEvent.change(screen.getByLabelText("Name"), {
        target: { value: "JD Updated" },
      });
      fireEvent.change(screen.getByTestId("mock-select"), {
        target: { value: "cat2" },
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Save Changes"));
      });

      expect(mockUpdateMake).toHaveBeenCalledWith(
        expect.objectContaining({
          make: "JD Updated",
          categoryId: "cat2",
        })
      );
      expect(toast.success).toHaveBeenCalledWith("Manufacturer updated");
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
      const itemWithCat = {
        ...mockMetadata[1],
        categoryId: "cat1" as Id<"equipmentCategories">,
      };
      renderCatalog([mockMetadata[0], itemWithCat]);

      await act(async () => {
        fireEvent.click(screen.getByText("Reactivate"));
      });
      expect(mockUpdateMake).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "m2",
          isActive: true,
        })
      );
      expect(toast.success).toHaveBeenCalledWith("Manufacturer reactivated");
    });

    it("should show error if categoryId missing on reactivation", async () => {
      const itemNoCat = {
        ...mockMetadata[1],
        categoryId: undefined as unknown as Id<"equipmentCategories">,
      };
      renderCatalog([mockMetadata[0], itemNoCat]);

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

      expect(mockAddModel).toHaveBeenCalledWith({
        id: "m1",
        model: "NewModel",
      });
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

    it("should handle add model failure", async () => {
      mockAddModel.mockRejectedValue(new Error("Add failed"));
      renderCatalog();
      fireEvent.click(screen.getAllByText("Add Model")[0]);

      const input = screen.getByLabelText(/Model Name/i);
      fireEvent.change(input, { target: { value: "NewModel" } });

      await act(async () => {
        const dialog = screen.getByTestId("dialog-content");
        const submitBtn = within(dialog).getByRole("button", { name: "Add Model" });
        fireEvent.click(submitBtn);
      });

      expect(toast.error).toHaveBeenCalledWith("Add failed");
    });

    it("should handle model add failure on Enter key", async () => {
      mockAddModel.mockRejectedValue(new Error("Enter fail"));
      renderCatalog();
      fireEvent.click(screen.getAllByText("Add Model")[0]);

      const input = screen.getByLabelText(/Model Name/i);
      fireEvent.change(input, { target: { value: "NewModel" } });

      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      expect(toast.error).toHaveBeenCalledWith("Enter fail");
    });
  });

  describe("Error Paths", () => {
    it("should handle update make failure", async () => {
      mockUpdateMake.mockRejectedValue(new Error("Update fail"));
      renderCatalog();

      fireEvent.click(screen.getAllByText("Edit")[0]);
      await act(async () => {
        fireEvent.click(screen.getByText("Save Changes"));
      });

      expect(toast.error).toHaveBeenCalledWith("Update fail");
    });

    it("should handle add make failure", async () => {
      mockAddMake.mockRejectedValue(new Error("Add make fail"));
      renderCatalog();

      fireEvent.click(screen.getByText("Add Make"));
      fireEvent.change(screen.getByLabelText(/Manufacturer Name/i), {
        target: { value: "F" },
      });
      fireEvent.change(screen.getByTestId("mock-select"), {
        target: { value: "cat1" },
      });
      fireEvent.change(screen.getByLabelText(/Initial Model/i), {
        target: { value: "M" },
      });

      await act(async () => {
        const submitBtn = screen.getAllByRole("button", { name: "Add Make" }).pop()!;
        fireEvent.click(submitBtn);
      });

      expect(toast.error).toHaveBeenCalledWith("Add make fail");
    });
  });
});
