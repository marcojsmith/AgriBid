import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { PromoteAdminDialog } from "./PromoteAdminDialog";
import type { AdminProfile } from "../hooks/useUserManagement";
import type { Id } from "../../../../convex/_generated/dataModel";

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
});
