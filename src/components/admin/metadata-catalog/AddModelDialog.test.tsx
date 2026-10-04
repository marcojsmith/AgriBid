import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import { AddModelDialog } from "./AddModelDialog";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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

const makeId = "m1" as Id<"equipmentMetadata">;
const mockAddModel = vi.fn();

/**
 * Finds the dialog's submit button, which shares its label with the trigger.
 *
 * @returns The submit button inside the open dialog.
 */
const getSubmitButton = (): HTMLElement =>
  within(screen.getByTestId("dialog-content")).getByRole("button", {
    name: "Add Model",
  });

/**
 * Opens the add-model dialog.
 *
 * @returns The render result for the opened dialog.
 */
const renderDialog = () => {
  const result = render(
    <AddModelDialog makeId={makeId} addModel={mockAddModel} />
  );
  fireEvent.click(screen.getByText("Add Model"));
  return result;
};

describe("AddModelDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a blank model name", () => {
    renderDialog();

    fireEvent.click(getSubmitButton());

    expect(mockAddModel).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Model name is required");
  });

  it("adds a trimmed model name and closes", async () => {
    mockAddModel.mockResolvedValue({});
    renderDialog();

    const input = screen.getByLabelText(/Model Name/i);
    fireEvent.change(input, { target: { value: "  8R 410  " } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(mockAddModel).toHaveBeenCalledWith({
        id: makeId,
        model: "8R 410",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Model added");
  });

  it("adds a model when Enter is pressed", async () => {
    mockAddModel.mockResolvedValue({});
    renderDialog();

    const input = screen.getByLabelText(/Model Name/i);
    fireEvent.change(input, { target: { value: "7R 330" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockAddModel).toHaveBeenCalledWith({
        id: makeId,
        model: "7R 330",
      });
    });
  });

  it("reports the mutation error", async () => {
    mockAddModel.mockRejectedValue(new Error("Add failed"));
    renderDialog();

    const input = screen.getByLabelText(/Model Name/i);
    fireEvent.change(input, { target: { value: "7R 330" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Add failed");
    });
  });

  it("falls back to a generic message when the mutation throws a non-Error", async () => {
    mockAddModel.mockRejectedValue("nope");
    renderDialog();

    const input = screen.getByLabelText(/Model Name/i);
    fireEvent.change(input, { target: { value: "7R 330" } });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to add model");
    });
  });

  it("closes without adding when cancelled", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
    expect(mockAddModel).not.toHaveBeenCalled();
  });
});
