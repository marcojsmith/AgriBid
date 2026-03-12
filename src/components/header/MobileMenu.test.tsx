import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { MobileMenu } from "./MobileMenu";

// Mock convex/react
vi.mock("convex/react", () => ({
  Authenticated: ({ children }: React.PropsWithChildren) => (
    <div data-testid="authenticated">{children}</div>
  ),
  Unauthenticated: ({ children }: React.PropsWithChildren) => (
    <div data-testid="unauthenticated">{children}</div>
  ),
}));

// Mock SearchBar to simplify
vi.mock("./SearchBar", () => ({
  SearchBar: ({ id, onSearch }: { id: string; onSearch?: () => void }) => (
    <div data-testid={`search-${id}`}>
      <input aria-label={`Search input ${id}`} />
      <button onClick={onSearch}>Search Action</button>
    </div>
  ),
}));

describe("MobileMenu", () => {
  let defaultProps: React.ComponentProps<typeof MobileMenu>;

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps = {
      isOpen: true,
      onClose: vi.fn(),
      navLinks: [
        { name: "Home", href: "/" },
        { name: "Auctions", href: "/auctions" },
      ],
      userData: {
        name: "Test User",
        email: "test@example.com",
        _id: "user123",
        userId: "user123",
        _creationTime: 123456789,
        profile: {
          _id: "profile123",
          _creationTime: 123456789,
          userId: "user123",
          role: "buyer",
          isVerified: true,
          onboardingStep: "completed",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      isVerified: true,
      kycStatus: "approved",
      role: "buyer",
      profileId: "profile123",
      onSignOut: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("should return null when closed", () => {
    const { container } = render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} isOpen={false} />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render navigation links when open", () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Auctions")).toBeInTheDocument();
  });

  it("should show user info and common actions for authenticated users", () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("Verified Member")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("My Bids")).toBeInTheDocument();
    expect(screen.getByText("My Listings")).toBeInTheDocument();
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("should show Admin button for admins", () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} role="admin" />
      </MemoryRouter>
    );

    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("should show verification CTA for unverified users", () => {
    render(
      <MemoryRouter>
        <MobileMenu
          {...defaultProps}
          isVerified={false}
          kycStatus="not_started"
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Complete Verification")).toBeInTheDocument();
  });

  it("should call onSignOut when sign out button is clicked", async () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    const signOutButton = screen.getByText("Sign Out");
    await act(async () => {
      fireEvent.click(signOutButton);
    });

    expect(defaultProps.onSignOut).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call onClose when a link is clicked", () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Home"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should handle Escape key to close", () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should trap focus and wrap around on Tab", () => {
    // Mock offsetParent for visibility check in focus trap
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      get() {
        return this.parentNode;
      },
    });

    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    const firstElement = screen.getByLabelText("Search input search-mobile");
    const lastElement = screen.getByText("Login / Register");

    firstElement.focus();
    expect(document.activeElement).toBe(firstElement);

    // Tab back from first should go to last
    fireEvent.keyDown(firstElement, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastElement);

    // Tab forward from last should go to first
    fireEvent.keyDown(lastElement, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(firstElement);
  });

  it("should restore focus when closed", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();

    const { rerender } = render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    expect(document.activeElement).not.toBe(button);

    rerender(
      <MemoryRouter>
        <MobileMenu {...defaultProps} isOpen={false} />
      </MemoryRouter>
    );

    expect(document.activeElement).toBe(button);
    document.body.removeChild(button);
  });

  it("should show syncing profile state when profileId is missing", () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} profileId={undefined} />
      </MemoryRouter>
    );

    expect(screen.getByText("Profile (Syncing...)")).toBeInTheDocument();
    expect(screen.getByLabelText("Profile syncing")).toBeDisabled();
  });

  it("should handle onSignOut failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failOnSignOut = vi
      .fn()
      .mockRejectedValue(new Error("Sign out failed"));

    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} onSignOut={failOnSignOut} />
      </MemoryRouter>
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Sign Out"));
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Sign out failed in MobileMenu:",
        expect.any(Error)
      );
    });
    consoleSpy.mockRestore();
  });

  it("should show loading state for userData", () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} userData={undefined} />
      </MemoryRouter>
    );

    // Pulse divs are rendered when userData is missing
    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
  });
});
