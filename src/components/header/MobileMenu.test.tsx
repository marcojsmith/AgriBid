import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { MobileMenu } from "./MobileMenu";

// Mock convex/react
vi.mock("convex/react", () => ({
  Authenticated: ({ children }: React.PropsWithChildren) => <div data-testid="authenticated">{children}</div>,
  Unauthenticated: ({ children }: React.PropsWithChildren) => <div data-testid="unauthenticated">{children}</div>,
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
      } as unknown as React.ComponentProps<typeof MobileMenu>["userData"],
      isVerified: true,
      kycStatus: "approved",
      role: "buyer",
      profileId: "profile123",
      onSignOut: vi.fn(),
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
        <MobileMenu {...defaultProps} isVerified={false} kycStatus="not_started" />
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
    fireEvent.click(signOutButton);

    expect(defaultProps.onSignOut).toHaveBeenCalled();
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
});
