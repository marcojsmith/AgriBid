import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { BidConfirmation } from "../BidConfirmation";

interface AlertDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClick?: () => void;
}

// Mock AlertDialog
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open, onOpenChange }: AlertDialogProps) => {
    return open ? (
      <div data-testid="alert-dialog-root">
        {React.Children.map(children, (child) =>
          React.isValidElement(child)
            ? React.cloneElement(
                child as React.ReactElement<AlertDialogProps>,
                { onOpenChange }
              )
            : child
        )}
      </div>
    ) : null;
  },
  AlertDialogContent: ({ children, onOpenChange }: AlertDialogProps) => (
    <div>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<AlertDialogProps>, {
              onOpenChange,
            })
          : child
      )}
    </div>
  ),
  AlertDialogHeader: ({ children }: AlertDialogProps) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: AlertDialogProps) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: AlertDialogProps) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children, onOpenChange }: AlertDialogProps) => (
    <div>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<AlertDialogProps>, {
              onOpenChange,
            })
          : child
      )}
    </div>
  ),
  AlertDialogAction: ({ children, onClick }: AlertDialogProps) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
    onOpenChange,
  }: AlertDialogProps) => (
    <button
      onClick={() => {
        onClick?.();
        onOpenChange?.(false);
      }}
    >
      {children}
    </button>
  ),
}));

describe("BidConfirmation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    amount: 1000,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders correct amount", () => {
    render(<BidConfirmation {...defaultProps} />);
    expect(screen.getByText(/1\s*000/)).toBeInTheDocument();
  });

  it("renders maxAmount when provided", () => {
    render(<BidConfirmation {...defaultProps} maxAmount={5000} />);
    expect(screen.getByText(/5\s*000/)).toBeInTheDocument();
    expect(screen.getByText(/Auto-bid Limit/i)).toBeInTheDocument();
  });

  it("calls onConfirm when Confirm Bid is clicked", () => {
    render(<BidConfirmation {...defaultProps} />);
    fireEvent.click(screen.getByText(/Confirm Bid/i));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel when Cancel is clicked", () => {
    render(<BidConfirmation {...defaultProps} />);
    fireEvent.click(screen.getByText(/Cancel/i));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });
});
