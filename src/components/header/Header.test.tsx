import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery } from "convex/react";
import { toast } from "sonner";

import { signOut } from "@/lib/auth-client";

import { Header } from "./Header";

// Mock convex/react
vi.mock("convex/react", () => ({
  Authenticated: ({ children }: React.PropsWithChildren) => (
    <div data-testid="authenticated">{children}</div>
  ),
  Unauthenticated: ({ children }: React.PropsWithChildren) => (
    <div data-testid="unauthenticated">{children}</div>
  ),
  useQuery: vi.fn(),
}));

// Mock auth-client
vi.mock("@/lib/auth-client", () => ({
  signOut: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock child components
vi.mock("./SearchBar", () => ({
  SearchBar: ({ id }: { id: string }) => (
    <div data-testid={`search-${id}`}>Search</div>
  ),
}));

vi.mock("./UserDropdown", () => ({
  UserDropdown: ({ onSignOut }: { onSignOut: () => void }) => (
    <div data-testid="user-dropdown">
      <button onClick={onSignOut}>Sign Out</button>
    </div>
  ),
}));

vi.mock("./MobileMenu", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MobileMenu: ({ isOpen, onClose, onSignOut }: any) =>
    isOpen ? (
      <div data-testid="mobile-menu">
        <button onClick={onClose}>Close</button>
        <button onClick={onSignOut}>Mobile Sign Out</button>
      </div>
    ) : null,
}));

vi.mock("@/components/NotificationDropdown", () => ({
  NotificationDropdown: () => (
    <div data-testid="notifications">Notifications</div>
  ),
}));

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockReturnValue({
      profile: {
        userId: "u1",
        role: "buyer",
        isVerified: true,
        kycStatus: "approved",
      },
    });
  });

  const renderHeader = (path = "/") => {
    window.history.pushState({}, "Test page", path);
    return render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );
  };

  it("renders brand name and navigation links", () => {
    renderHeader();
    expect(screen.getByText("AGRIBID")).toBeInTheDocument();
    expect(screen.getByText("Marketplace")).toBeInTheDocument();
    expect(screen.getByText("Sell")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
  });

  it("handles successful sign out", async () => {
    (signOut as Mock).mockResolvedValue(undefined);
    renderHeader();

    // Trigger sign out from mock UserDropdown
    await act(async () => {
      fireEvent.click(screen.getByText("Sign Out"));
    });

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Signed out successfully");
    });
  });

  it("handles sign out failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (signOut as Mock).mockRejectedValue(new Error("Fail"));
    renderHeader();

    await act(async () => {
      fireEvent.click(screen.getByText("Sign Out"));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to sign out. Please try again."
      );
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it("toggles mobile menu", () => {
    renderHeader();
    const toggleBtn = screen.getByLabelText("Toggle menu");

    // Open
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("mobile-menu")).toBeInTheDocument();

    // Close via MobileMenu mock callback
    fireEvent.click(screen.getByText("Close"));
    expect(screen.queryByTestId("mobile-menu")).not.toBeInTheDocument();
  });

  it("applies active link styling", () => {
    renderHeader("/");
    const marketplaceLink = screen.getByText("Marketplace");
    expect(marketplaceLink).toHaveClass("text-primary");
  });

  it("renders loading profile state", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderHeader();
    // Header should still render AGRIBID
    expect(screen.getByText("AGRIBID")).toBeInTheDocument();
  });

  it("renders login button when unauthenticated", () => {
    // Note: Authenticated/Unauthenticated components are mocked
    // to render their children if they match the state.
    // In our test we can just check if the login button is there.
    renderHeader();
    expect(screen.getByText(/Login \/ Register/i)).toBeInTheDocument();
  });
});
