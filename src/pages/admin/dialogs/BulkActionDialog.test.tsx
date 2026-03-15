import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { BulkActionDialog } from "./BulkActionDialog";

describe("BulkActionDialog", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    isProcessing: false,
    selectedCount: 5,
    targetStatus: "active",
  };

  it("should render the dialog when open", () => {
    render(<BulkActionDialog {...defaultProps} />);

    expect(screen.getByText("Perform Bulk Status Update?")).toBeInTheDocument();
    expect(screen.getByText("5 auctions")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("should call onClose when Cancel is clicked", () => {
    render(<BulkActionDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Cancel"));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call onConfirm when Confirm Update is clicked", () => {
    render(<BulkActionDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Confirm Update"));

    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it("should disable Confirm button when processing", () => {
    render(<BulkActionDialog {...defaultProps} isProcessing={true} />);

    const confirmButton = screen.getByText("Confirm Update").closest("button");
    expect(confirmButton?.disabled).toBe(true);
  });

  it("should show loading indicator when processing", () => {
    render(<BulkActionDialog {...defaultProps} isProcessing={true} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("should display unspecified status when targetStatus is null", () => {
    render(<BulkActionDialog {...defaultProps} targetStatus={null} />);

    expect(screen.getByText("UNSPECIFIED")).toBeInTheDocument();
  });
});
