import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { toast } from "sonner";

import { UserDropdown } from "../header/UserDropdown";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

interface DropdownMenuProps {
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

// Mock Radix UI DropdownMenu to avoid Portal issues in tests
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: DropdownMenuProps) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: DropdownMenuProps) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: DropdownMenuProps) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick, className }: DropdownMenuProps) => (
    <div onClick={onClick} className={className}>
      {children}
    </div>
  ),
  DropdownMenuLabel: ({ children }: DropdownMenuProps) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

describe("UserDropdown", () => {
  const defaultProps = {
    userData: { name: "John Doe", email: "john@example.com", id: "1" },
    isLoadingProfile: false,
    isVerified: true,
    kycStatus: "approved",
    profileId: "profile-123",
    role: "user",
    onSignOut: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (props = defaultProps) => {
    return render(
      <BrowserRouter>
        <UserDropdown {...props} />
      </BrowserRouter>
    );
  };

  it("renders user name and verified badge", () => {
    renderWithRouter();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    renderWithRouter({ ...defaultProps, isLoadingProfile: true });
    expect(screen.getAllByText("Loading...").length).toBeGreaterThan(0);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders unverified badge when not verified", () => {
    renderWithRouter({
      ...defaultProps,
      isVerified: false,
      kycStatus: "unverified",
    });
    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("renders pending review badge when kyc is pending", () => {
    renderWithRouter({
      ...defaultProps,
      isVerified: false,
      kycStatus: "pending",
    });
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
  });

  it("shows menu content (mocked directly)", () => {
    renderWithRouter();
    expect(screen.getByText("Account Terminal")).toBeInTheDocument();
    expect(screen.getByText("My Bids")).toBeInTheDocument();
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("shows Admin Dashboard link for admin role", () => {
    renderWithRouter({ ...defaultProps, role: "admin" });
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });

  it("shows KYC prompt when unverified", () => {
    renderWithRouter({
      ...defaultProps,
      isVerified: false,
      kycStatus: "unverified",
    });
    expect(screen.getByText("Identity Required")).toBeInTheDocument();
  });

  it("calls onSignOut when Sign Out is clicked", async () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    renderWithRouter({ ...defaultProps, onSignOut });

    const signOutButton = screen.getByText("Sign Out");
    fireEvent.click(signOutButton);

    expect(onSignOut).toHaveBeenCalled();
  });

  it("shows error toast if sign out fails", async () => {
    const onSignOut = vi.fn().mockRejectedValue(new Error("Failed"));
    renderWithRouter({ ...defaultProps, onSignOut });

    const signOutButton = screen.getByText("Sign Out");
    fireEvent.click(signOutButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Sign out failed")
      );
    });
  });
});
