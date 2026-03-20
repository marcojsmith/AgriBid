/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import type { AdminProfile } from "@/hooks/admin/useUserManagement";

import { PromoteAdminDialog } from "./PromoteAdminDialog";
import type { Id } from "../../../../convex/_generated/dataModel";

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open, onOpenChange }: any) => (
    <div
      data-testid="mock-alert-dialog"
      data-open={open}
      onClick={() => onOpenChange(false)}
    >
      {children}
    </div>
  ),
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

describe("PromoteAdminDialog", () => {
  const mockUser: AdminProfile = {
    _id: "p123" as Id<"profiles">,
    userId: "user123",
    name: "John Doe",
    email: "john@example.com",
    role: "user",
    createdAt: Date.now(),
    isOnline: true,
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    isProcessing: false,
    targetUser: mockUser,
  };

  it("should render the dialog when open with a user", () => {
    render(<PromoteAdminDialog {...defaultProps} />);

    expect(screen.getByText("Elevate to Admin Role?")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("should display email when name is not available", () => {
    const userWithoutName = { ...mockUser, name: undefined };
    render(
      <PromoteAdminDialog {...defaultProps} targetUser={userWithoutName} />
    );

    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("should display 'this user' when no user data is available", () => {
    render(<PromoteAdminDialog {...defaultProps} targetUser={null} />);

    expect(screen.getByText("this user")).toBeInTheDocument();
  });

  it("should call onClose when Cancel is clicked", () => {
    render(<PromoteAdminDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Cancel"));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call onConfirm when Promote User is clicked", () => {
    render(<PromoteAdminDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Promote User"));

    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it("should disable Promote button when processing", () => {
    render(<PromoteAdminDialog {...defaultProps} isProcessing={true} />);

    const promoteButton = screen.getByText("Promote User").closest("button");
    expect(promoteButton?.disabled).toBe(true);
  });

  it("should show loading indicator when processing", () => {
    render(<PromoteAdminDialog {...defaultProps} isProcessing={true} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("should display 'this user' when user exists but has no name or email", () => {
    const mysteriousUser = { ...mockUser, name: undefined, email: undefined };
    render(
      <PromoteAdminDialog {...defaultProps} targetUser={mysteriousUser} />
    );

    expect(screen.getByText("this user")).toBeInTheDocument();
  });

  it("should call onClose when onOpenChange(false) is triggered", () => {
    render(<PromoteAdminDialog {...defaultProps} />);

    fireEvent.click(screen.getByTestId("mock-alert-dialog"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
