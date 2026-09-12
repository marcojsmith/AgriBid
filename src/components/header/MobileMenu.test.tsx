import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useQuery } from "convex/react";

import type { UserDataWithProfile } from "@/types/auth";

import { MobileMenu } from "./MobileMenu";

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

vi.mock("convex/_generated/api", () => ({
  api: {
    messages: {
      getUnreadConversationCount: "messages:getUnreadConversationCount",
    },
  },
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
    (useQuery as Mock).mockReturnValue(0);

    // Mock offsetParent for visibility check in focus trap
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      get(this: HTMLElement) {
        return this.parentNode;
      },
      configurable: true,
    });

    const mockUserData: UserDataWithProfile = {
      name: "Test User",
      email: "test@example.com",
      _id: "user123",
      userId: "user123",
      profile: {
        _id: "profile123",
        userId: "user123",
        role: "buyer",
        isVerified: true,
        kycStatus: "verified",
        createdAt: 123456789,
        updatedAt: 123456789,
      },
    };

    defaultProps = {
      isOpen: true,
      onClose: vi.fn(),
      navLinks: [
        { name: "Home", href: "/" },
        { name: "Auctions", href: "/auctions" },
      ],
      userData: mockUserData,
      isVerified: true,
      kycStatus: "verified",
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

  it("should show the Messages tile linking to /messages", () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    const messagesLink = screen.getByRole("link", { name: "Messages" });
    expect(messagesLink).toHaveAttribute("href", "/messages");
  });

  it("should show the unread-conversations badge on the Messages tile when the count is above zero", () => {
    (useQuery as Mock).mockReturnValue(2);
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: "Messages, 2 unread" })
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("should hide the unread-conversations badge when there is nothing unread", () => {
    (useQuery as Mock).mockReturnValue(0);
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Messages" })).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Messages, 0 unread")
    ).not.toBeInTheDocument();
  });

  it("should call onClose when the Messages tile is clicked", () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("link", { name: "Messages" }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should show Watchlist link for authenticated users", () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    const watchlistLink = screen.getByText("Watchlist").closest("a");
    expect(watchlistLink).toHaveAttribute("href", "/watchlist");
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
    await act(() => {
      fireEvent.click(signOutButton);
      return Promise.resolve();
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

  it("should not trap focus when tabbing on middle elements", () => {
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} />
      </MemoryRouter>
    );

    const middleElement = screen.getByText("Home");

    middleElement.focus();
    expect(document.activeElement).toBe(middleElement);

    // Tab from middle should NOT be prevented/trapped (let browser handle it)
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    const spy = vi.spyOn(event, "preventDefault");
    middleElement.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
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
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // intentional no-op: suppress expected sign-out failure logging
    });
    const failOnSignOut = vi
      .fn()
      .mockRejectedValue(new Error("Sign out failed"));

    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} onSignOut={failOnSignOut} />
      </MemoryRouter>
    );

    await act(() => {
      fireEvent.click(screen.getByText("Sign Out"));
      return Promise.resolve();
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

  it("should handle focus trap with no focusable elements", () => {
    // We need to render something with no links/buttons except the close button maybe?
    // But the current implementation always has a close button.
    // Let's try to mock querySelectorAll to return empty
    render(
      <MemoryRouter>
        <MobileMenu {...defaultProps} isOpen={true} />
      </MemoryRouter>
    );

    const menuRoot =
      screen.getByRole("navigation").parentElement?.parentElement;
    if (!menuRoot) {
      throw new Error("Expected MobileMenu container to be rendered");
    }
    vi.spyOn(menuRoot, "querySelectorAll").mockReturnValue({
      length: 0,
      item: () => null,
      forEach: () => {
        // intentional no-op: mocked NodeList is empty, nothing to iterate
      },
      [Symbol.iterator]: function* () {
        yield* [];
      },
    } as unknown as NodeListOf<HTMLElement>);

    const event = new KeyboardEvent("keydown", { key: "Tab" });
    menuRoot.dispatchEvent(event);

    // Should not throw and just return
    expect(menuRoot).toBeInTheDocument();
  });
});
