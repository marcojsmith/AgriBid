import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import { MakeAccordionItem } from "./MakeAccordionItem";
import type { Category, EquipmentMetadata } from "./types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Force the accordion content to mount without animation delays.
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
  AccordionTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

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
    <div>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<{
              open?: boolean;
              onOpenChange?: (o: boolean) => void;
            }>,
            { open, onOpenChange }
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
  }) => <div onClick={() => onOpenChange?.(true)}>{children}</div>,
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

const categories: Category[] = [
  {
    _id: "cat1" as Id<"equipmentCategories">,
    _creationTime: 0,
    name: "Tractors",
    isActive: true,
  },
];

const activeMake: EquipmentMetadata = {
  _id: "m1" as Id<"equipmentMetadata">,
  _creationTime: 0,
  make: "John Deere",
  categoryId: "cat1" as Id<"equipmentCategories">,
  categoryName: "Tractors",
  models: ["8R 410"],
  isActive: true,
};

const inactiveMake: EquipmentMetadata = {
  ...activeMake,
  _id: "m2" as Id<"equipmentMetadata">,
  make: "Case IH",
  categoryName: "Harvesters",
  models: ["Magnum 340"],
  isActive: false,
};

const mockUpdateMake = vi.fn();
const mockDeleteMake = vi.fn();
const mockAddModel = vi.fn();
const mockRemoveModel = vi.fn();

/**
 * Renders one make's accordion item.
 *
 * @param item - The make to render.
 * @returns The render result for the accordion item.
 */
const renderItem = (item: EquipmentMetadata = activeMake) =>
  render(
    <MakeAccordionItem
      item={item}
      categories={categories}
      updateMake={mockUpdateMake}
      deleteMake={mockDeleteMake}
      addModel={mockAddModel}
      removeModel={mockRemoveModel}
    />
  );

describe("MakeAccordionItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("shows the make, its category and its models", () => {
    renderItem();

    expect(screen.getByText("John Deere")).toBeInTheDocument();
    expect(screen.getByText("Tractors")).toBeInTheDocument();
    expect(screen.getByText("8R 410")).toBeInTheDocument();
  });

  it("badges an inactive make and shows 'Never' when it was never updated", () => {
    renderItem({ ...inactiveMake, updatedAt: undefined });

    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText(/Never/)).toBeInTheDocument();
  });

  it("shows the last updated date when there is one", () => {
    const updatedAt = Date.UTC(2024, 4, 17);
    const { container } = renderItem({ ...activeMake, updatedAt });

    expect(container.textContent).toContain(
      new Date(updatedAt).toLocaleDateString()
    );
  });

  it("deactivates the make once the confirmation is accepted", async () => {
    mockDeleteMake.mockResolvedValue({});
    renderItem();

    await act(() => {
      fireEvent.click(screen.getByText("Deactivate"));
      return Promise.resolve();
    });

    expect(window.confirm).toHaveBeenCalledWith(
      'Deactivate manufacturer "John Deere"?'
    );
    expect(mockDeleteMake).toHaveBeenCalledWith({ id: "m1" });
    expect(toast.success).toHaveBeenCalledWith("Manufacturer deactivated");
  });

  it("does not deactivate when the confirmation is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderItem();

    fireEvent.click(screen.getByText("Deactivate"));

    expect(mockDeleteMake).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("reports a failed deactivation", async () => {
    mockDeleteMake.mockRejectedValue(new Error("Deactivate fail"));
    renderItem();

    await act(() => {
      fireEvent.click(screen.getByText("Deactivate"));
      return Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith("Deactivate fail");
  });

  it("falls back to a generic message when deactivation throws a non-Error", async () => {
    mockDeleteMake.mockRejectedValue("nope");
    renderItem();

    await act(() => {
      fireEvent.click(screen.getByText("Deactivate"));
      return Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to deactivate");
  });

  it("reactivates an inactive make", async () => {
    mockUpdateMake.mockResolvedValue({});
    renderItem(inactiveMake);

    await act(() => {
      fireEvent.click(screen.getByText("Reactivate"));
      return Promise.resolve();
    });

    expect(mockUpdateMake).toHaveBeenCalledWith({
      id: "m2",
      make: "Case IH",
      categoryId: "cat1",
      models: ["Magnum 340"],
      isActive: true,
    });
    expect(toast.success).toHaveBeenCalledWith("Manufacturer reactivated");
  });

  it("refuses to reactivate a make with no category linkage", () => {
    renderItem({
      ...inactiveMake,
      categoryId: undefined as unknown as Id<"equipmentCategories">,
    });

    fireEvent.click(screen.getByText("Reactivate"));

    expect(mockUpdateMake).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Category linkage missing");
  });

  it("reports a failed reactivation", async () => {
    mockUpdateMake.mockRejectedValue(new Error("Reactivate fail"));
    renderItem(inactiveMake);

    await act(() => {
      fireEvent.click(screen.getByText("Reactivate"));
      return Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith("Reactivate fail");
  });

  it("falls back to a generic message when reactivation throws a non-Error", async () => {
    mockUpdateMake.mockRejectedValue("nope");
    renderItem(inactiveMake);

    await act(() => {
      fireEvent.click(screen.getByText("Reactivate"));
      return Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to reactivate");
  });
});
