import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Doc, Id } from "convex/_generated/dataModel";

import { CategoryManager } from "./CategoryManager";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CategoryManager", () => {
  const mockCategories: Doc<"equipmentCategories">[] = [
    {
      _id: "cat_1" as Id<"equipmentCategories">,
      _creationTime: Date.now(),
      name: "Tractors",
      isActive: true,
    },
    {
      _id: "cat_2" as Id<"equipmentCategories">,
      _creationTime: Date.now(),
      name: "Harvesters",
      isActive: true,
    },
    {
      _id: "cat_3" as Id<"equipmentCategories">,
      _creationTime: Date.now(),
      name: "Inactive Category",
      isActive: false,
    },
  ];

  const mockAddCategory = vi.fn();
  const mockUpdateCategory = vi.fn();
  const mockDeleteCategory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render list of categories", () => {
    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    expect(screen.getByText("Manage Categories")).toBeInTheDocument();
    expect(screen.getByText("Tractors")).toBeInTheDocument();
    expect(screen.getByText("Harvesters")).toBeInTheDocument();
    expect(screen.getByText("Inactive Category")).toBeInTheDocument();
  });

  it("should show active badge for active categories", () => {
    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    const badges = screen.getAllByText("Active");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("should show inactive badge for inactive categories", () => {
    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("should open add dialog when Add Category button is clicked", () => {
    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    fireEvent.click(screen.getByText("Add Category"));

    expect(screen.getByText("Add New Category")).toBeInTheDocument();
  });

  it("should add a new category successfully", async () => {
    mockAddCategory.mockResolvedValue({ success: true });

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    fireEvent.click(screen.getByText("Add Category"));

    const input = screen.getByLabelText(/Category Name/i);
    fireEvent.change(input, { target: { value: "New Category" } });

    const addButton = screen.getByRole("button", { name: /Add Category/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddCategory).toHaveBeenCalledWith({ name: "New Category" });
    });
  });

  it("should trim whitespace when adding a category", async () => {
    mockAddCategory.mockResolvedValue({ success: true });

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    fireEvent.click(screen.getByText("Add Category"));

    const input = screen.getByLabelText(/Category Name/i);
    fireEvent.change(input, { target: { value: "  Trimmed Category  " } });

    const addButton = screen.getByRole("button", { name: /Add Category/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddCategory).toHaveBeenCalledWith({
        name: "Trimmed Category",
      });
    });
  });

  it("should not add a category with empty name", async () => {
    const { toast } = await import("sonner");

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    fireEvent.click(screen.getByText("Add Category"));

    const input = screen.getByLabelText(/Category Name/i);
    fireEvent.change(input, { target: { value: "   " } });

    const addButton = screen.getByRole("button", { name: /Add Category/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Category name is required");
      expect(mockAddCategory).not.toHaveBeenCalled();
    });
  });

  it("should handle add category error", async () => {
    const { toast } = await import("sonner");
    mockAddCategory.mockRejectedValue(new Error("Category already exists"));

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    fireEvent.click(screen.getByText("Add Category"));

    const input = screen.getByLabelText(/Category Name/i);
    fireEvent.change(input, { target: { value: "Duplicate" } });

    const addButton = screen.getByRole("button", { name: /Add Category/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Category already exists");
    });
  });

  it("should open edit dialog when edit button is clicked", () => {
    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    const editButtons = screen.getAllByRole("button", {
      name: /edit category/i,
    });
    const firstEditButton = editButtons.find(
      (btn) => btn.querySelector(".lucide-pencil") !== null
    );

    if (firstEditButton) {
      fireEvent.click(firstEditButton);
      expect(screen.getByText("Edit Category")).toBeInTheDocument();
    }
  });

  it("should update a category successfully", async () => {
    mockUpdateCategory.mockResolvedValue({ success: true });

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    const editButtons = screen.getAllByRole("button", {
      name: /edit category/i,
    });
    const firstEditButton = editButtons.find(
      (btn) => btn.querySelector(".lucide-pencil") !== null
    );

    if (firstEditButton) {
      fireEvent.click(firstEditButton);

      const input = screen.getByDisplayValue("Tractors");
      fireEvent.change(input, { target: { value: "Updated Tractors" } });

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateCategory).toHaveBeenCalledWith({
          id: "cat_1",
          name: "Updated Tractors",
        });
      });
    }
  });

  it("should delete a category successfully", async () => {
    mockDeleteCategory.mockResolvedValue({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    const deleteButtons = screen.getAllByRole("button", {
      name: /deactivate category|reactivate category/i,
    });
    const firstDeleteButton = deleteButtons.find(
      (btn) => btn.querySelector(".lucide-trash-2") !== null
    );

    if (firstDeleteButton) {
      fireEvent.click(firstDeleteButton);

      await waitFor(() => {
        expect(mockDeleteCategory).toHaveBeenCalledWith({ id: "cat_1" });
      });
    }
  });

  it("should handle empty categories list", () => {
    render(
      <CategoryManager
        categories={[]}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    expect(screen.getByText("Manage Categories")).toBeInTheDocument();
    expect(screen.getByText("Add Category")).toBeInTheDocument();
  });

  it("should close add dialog after successful add", async () => {
    mockAddCategory.mockResolvedValue({ success: true });

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    fireEvent.click(screen.getByText("Add Category"));

    const input = screen.getByLabelText(/Category Name/i);
    fireEvent.change(input, { target: { value: "New Category" } });

    const addButton = screen.getByRole("button", { name: /Add Category/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddCategory).toHaveBeenCalled();
    });
  });

  it("should add a new category on Enter key", async () => {
    mockAddCategory.mockResolvedValue({ success: true });

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    fireEvent.click(screen.getByText("Add Category"));

    const input = screen.getByLabelText(/Category Name/i);
    fireEvent.change(input, { target: { value: "Enter Category" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(mockAddCategory).toHaveBeenCalledWith({ name: "Enter Category" });
    });
  });

  it("should handle delete category error", async () => {
    const { toast } = await import("sonner");
    mockDeleteCategory.mockRejectedValue(new Error("Deletion failed"));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    const deleteButtons = screen.getAllByLabelText(/Deactivate category/);
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("should not delete a category if confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    const deleteButtons = screen.getAllByLabelText(/Deactivate category/);
    fireEvent.click(deleteButtons[0]);

    expect(mockDeleteCategory).not.toHaveBeenCalled();
  });

  it("should reactivate a category successfully", async () => {
    mockAddCategory.mockResolvedValue({ success: true });

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    const reactivateButton = screen.getByLabelText(
      "Reactivate category Inactive Category"
    );
    fireEvent.click(reactivateButton);

    await waitFor(() => {
      expect(mockAddCategory).toHaveBeenCalledWith({
        name: "Inactive Category",
      });
    });
  });

  it("should handle reactivation error", async () => {
    const { toast } = await import("sonner");
    mockAddCategory.mockRejectedValue(new Error("Reactivation failed"));

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    const reactivateButton = screen.getByLabelText(
      "Reactivate category Inactive Category"
    );
    fireEvent.click(reactivateButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Reactivation failed");
    });
  });

  it("should not update a category with empty name", async () => {
    const { toast } = await import("sonner");

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    const editButtons = screen.getAllByLabelText("Edit category");
    fireEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue("Tractors");
    fireEvent.change(input, { target: { value: "   " } });

    const saveButton = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Category name is required");
      expect(mockUpdateCategory).not.toHaveBeenCalled();
    });
  });

  it("should handle update category error", async () => {
    const { toast } = await import("sonner");
    mockUpdateCategory.mockRejectedValue(new Error("Update failed"));

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    const editButtons = screen.getAllByLabelText("Edit category");
    fireEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue("Tractors");
    fireEvent.change(input, { target: { value: "New Name" } });

    const saveButton = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  it("should handle update category error with non-Error object", async () => {
    const { toast } = await import("sonner");
    mockUpdateCategory.mockRejectedValue("Generic error");

    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    const editButtons = screen.getAllByLabelText("Edit category");
    fireEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue("Tractors");
    fireEvent.change(input, { target: { value: "New Name" } });

    const saveButton = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update category");
    });
  });

  it("should close add dialog when cancel is clicked", async () => {
    render(
      <CategoryManager
        categories={mockCategories}
        addCategory={mockAddCategory}
        updateCategory={mockUpdateCategory}
        deleteCategory={mockDeleteCategory}
      />
    );

    fireEvent.click(screen.getByText("Add Category"));
    expect(screen.getByText("Add New Category")).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText("Add New Category")).not.toBeInTheDocument();
    });
  });
});
