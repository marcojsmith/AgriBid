import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { useClerk } from "@clerk/clerk-react";

import { UserProfileProvider } from "@/contexts/UserProfileContext";

import { Header } from "./Header";

// Whether the mocked Convex auth boundary treats the visitor as signed in.
const auth = vi.hoisted(() => ({ signedIn: true }));
// The business details the mocked branding context returns.
const brand = vi.hoisted(() => ({
  businessInfo: undefined as { telephone: string | null } | undefined,
}));

// Mock convex/react
vi.mock("convex/react", () => ({
  Authenticated: ({ children }: React.PropsWithChildren) =>
    auth.signedIn ? <div data-testid="authenticated">{children}</div> : null,
  Unauthenticated: ({ children }: React.PropsWithChildren) =>
    auth.signedIn ? null : <div data-testid="unauthenticated">{children}</div>,
  useQuery: vi.fn(),
}));

// Mock Clerk
vi.mock("@clerk/clerk-react", () => ({
  useClerk: vi.fn(),
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
  SearchBar: ({ id, onSearch }: { id: string; onSearch?: () => void }) => (
    <div data-testid={`search-${id}`}>
      <button type="button" onClick={onSearch}>
        Run search
      </button>
    </div>
  ),
}));

vi.mock("./UserDropdown", () => ({
  UserDropdown: ({ onSignOut }: { onSignOut: () => void }) => (
    <div data-testid="user-dropdown">
      <button onClick={onSignOut}>Sign Out</button>
    </div>
  ),
}));

vi.mock("@/components/NotificationDropdown", () => ({
  NotificationDropdown: () => (
    <div data-testid="notifications">Notifications</div>
  ),
}));

vi.mock("@/hooks/useBranding", () => ({
  useBranding: () => ({
    appName: "AgriBid",
    businessInfo: brand.businessInfo,
  }),
}));

describe("Header", () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    auth.signedIn = true;
    brand.businessInfo = undefined;
    (useClerk as Mock).mockReturnValue({ signOut: mockSignOut });
    (useQuery as Mock).mockReturnValue({
      profile: {
        userId: "u1",
        role: "buyer",
        isVerified: true,
        kycStatus: "approved",
      },
    });
  });

  // Header reads the profile from UserProfileContext, which the layout
  // provides at runtime; the provider keeps the mocked query in charge.
  const renderHeader = (path = "/") => {
    window.history.pushState({}, "Test page", path);
    return render(
      <BrowserRouter>
        <UserProfileProvider>
          <Header />
        </UserProfileProvider>
      </BrowserRouter>
    );
  };

  it("renders brand name and navigation links", () => {
    renderHeader();
    expect(screen.getByText("AgriBid")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByRole("link", { name: "Auctions" })).toHaveAttribute(
      "href",
      "/auctions"
    );
    expect(
      within(nav).getByRole("link", { name: "Sell equipment" })
    ).toHaveAttribute("href", "/sell");
    expect(
      within(nav).getByRole("link", { name: "How it works" })
    ).toHaveAttribute("href", "/faq");
    expect(within(nav).getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "/support"
    );
    expect(within(nav).queryByText("About")).toBeNull();
  });

  it("handles successful sign out", async () => {
    mockSignOut.mockResolvedValue(undefined);
    renderHeader();

    // Trigger sign out from mock UserDropdown
    await act(() => {
      fireEvent.click(screen.getByText("Sign Out"));
      return Promise.resolve();
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ redirectUrl: "/" });
      expect(toast.success).toHaveBeenCalledWith("Signed out successfully");
    });
  });

  it("handles sign out failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // intentional no-op: suppress expected sign-out failure logging
    });
    mockSignOut.mockRejectedValue(new Error("Fail"));
    renderHeader();

    await act(() => {
      fireEvent.click(screen.getByText("Sign Out"));
      return Promise.resolve();
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to sign out. Please try again."
      );
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it("marks the current page in the navigation", () => {
    renderHeader("/auctions");
    const link = screen.getByRole("link", { name: "Auctions" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("text-foreground");
    expect(screen.getByRole("link", { name: "Support" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("renders loading profile state", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderHeader();
    // Header should still render the brand name
    expect(screen.getByText("AgriBid")).toBeInTheDocument();
  });

  it("signed in: shows the account menu and My bids, but no Sign in or Register", () => {
    renderHeader();
    expect(screen.getByTestId("user-dropdown")).toBeInTheDocument();
    expect(screen.getByTestId("notifications")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My bids" })).toHaveAttribute(
      "href",
      "/dashboard/bids"
    );
    expect(screen.queryByText(/Sign in/i)).toBeNull();
    expect(screen.queryByText(/Register/i)).toBeNull();
    expect(screen.queryByText(/Login/i)).toBeNull();
  });

  it("signed out: shows Sign in and Register to bid", () => {
    auth.signedIn = false;
    renderHeader();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(
      screen.getByRole("link", { name: "Register to bid" })
    ).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: "My bids" })).toBeNull();
    expect(screen.queryByTestId("user-dropdown")).toBeNull();
  });

  it("shows a Sell link for the phone layout", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: "Sell" })).toHaveAttribute(
      "href",
      "/sell"
    );
  });

  it("shows the call icon only when a phone number is set", () => {
    renderHeader();
    expect(screen.queryByRole("link", { name: /^Call / })).toBeNull();
  });

  it("links the call icon to the configured phone number", () => {
    brand.businessInfo = { telephone: "083 7 000 000" };
    renderHeader();
    expect(
      screen.getByRole("link", { name: "Call 083 7 000 000" })
    ).toHaveAttribute("href", "tel:0837000000");
  });

  it("keeps the desktop search field and hides the menu until the button is pressed", () => {
    renderHeader();
    expect(screen.getByTestId("search-search-desktop")).toBeInTheDocument();
    expect(screen.queryByTestId("search-search-mobile")).toBeNull();

    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);

    expect(screen.getByTestId("search-search-mobile")).toBeInTheDocument();
    const menu = screen.getByRole("navigation", { name: "Menu" });
    expect(within(menu).getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "/support"
    );
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByTestId("search-search-mobile")).toBeNull();
  });

  it("closes the menu when the route changes", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("navigation", { name: "Menu" })).toBeVisible();
    act(() => {
      window.history.pushState({}, "", "/auctions");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByRole("navigation", { name: "Menu" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  it("closes the menu after a search is submitted or a link is followed", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(
      within(screen.getByTestId("search-search-mobile")).getByText("Run search")
    );
    expect(screen.queryByTestId("search-search-mobile")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Menu" })).getByRole(
        "link",
        { name: "Support" }
      )
    );
    expect(screen.queryByRole("navigation", { name: "Menu" })).toBeNull();
  });
});
