import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery } from "convex/react";
import { toast } from "sonner";

import { UserDropdown } from "./UserDropdown";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    messages: {
      getUnreadConversationCount: "messages:getUnreadConversationCount",
    },
    lotPayments: { getMyPaymentSummary: "lotPayments:getMyPaymentSummary" },
    registration: { getMyBidEligibility: "registration:getMyBidEligibility" },
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
    role: "user",
    onSignOut: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockReturnValue(0);
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
    expect(screen.getByText("My bids")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("renders the Messages link to /messages", () => {
    renderWithRouter();
    const messagesLink = screen.getByRole("link", { name: "Messages" });
    expect(messagesLink).toHaveAttribute("href", "/messages");
  });

  it("shows the unread-conversations badge when the count is above zero", () => {
    (useQuery as Mock).mockReturnValue(3);
    renderWithRouter();
    expect(
      screen.getByRole("link", { name: "Messages, 3 unread" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("hides the unread-conversations badge when there is nothing unread", () => {
    (useQuery as Mock).mockReturnValue(0);
    renderWithRouter();
    expect(screen.getByRole("link", { name: "Messages" })).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Messages, 0 unread")
    ).not.toBeInTheDocument();
  });

  it("shows Admin link for admin role", () => {
    renderWithRouter({ ...defaultProps, role: "admin" });
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin"
    );
  });

  it("shows KYC prompt when unverified", () => {
    renderWithRouter({
      ...defaultProps,
      isVerified: false,
      kycStatus: "unverified",
    });
    expect(screen.getByText("Finish registration")).toBeInTheDocument();
  });

  it("keeps Finish registration while review is pending, linking to /register", () => {
    renderWithRouter({
      ...defaultProps,
      isVerified: false,
      kycStatus: "pending",
    });
    expect(
      screen.getByRole("link", { name: /Finish registration/ })
    ).toHaveAttribute("href", "/register");
    expect(screen.queryByText(/Complete KYC/i)).toBeNull();
  });

  it("hides Finish registration once verified", () => {
    renderWithRouter();
    expect(screen.queryByText("Finish registration")).toBeNull();
  });

  it("shows the user's initials on the avatar", () => {
    renderWithRouter({
      ...defaultProps,
      userData: { ...defaultProps.userData, name: "Thandi Naidoo" },
    });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveTextContent("TN");
    expect(avatar).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("falls back to the email's first letter, then to the icon", () => {
    const { unmount } = renderWithRouter({
      ...defaultProps,
      userData: { ...defaultProps.userData, name: "" },
    });
    expect(document.querySelector('[data-slot="avatar"]')).toHaveTextContent(
      "J"
    );
    unmount();
    renderWithRouter({
      ...defaultProps,
      userData: { id: "1", name: "", email: "" },
    });
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveTextContent("");
    expect(avatar?.querySelector("svg")).not.toBeNull();
  });

  it("calls onSignOut when Sign Out is clicked", () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    renderWithRouter({ ...defaultProps, onSignOut });

    const signOutButton = screen.getByText("Sign out");
    fireEvent.click(signOutButton);

    expect(onSignOut).toHaveBeenCalled();
  });

  it("renders default name when user name is missing", () => {
    renderWithRouter({
      ...defaultProps,
      userData: { ...defaultProps.userData, name: "" },
    });
    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("shows error toast if sign out fails", async () => {
    const onSignOut = vi.fn().mockRejectedValue(new Error("Failed"));
    renderWithRouter({ ...defaultProps, onSignOut });

    const signOutButton = screen.getByText("Sign out");
    fireEvent.click(signOutButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Sign out failed")
      );
    });
  });
});

describe("UserDropdown links", () => {
  const props = {
    userData: { name: "John Doe", email: "john@example.com", id: "1" },
    isLoadingProfile: false,
    isVerified: true,
    kycStatus: "approved",
    role: "buyer",
    onSignOut: vi.fn().mockResolvedValue(undefined),
  };
  const renderIt = (over: Partial<typeof props> = {}) =>
    render(
      <BrowserRouter>
        <UserDropdown {...props} {...over} />
      </BrowserRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockReturnValue(0);
  });

  it("follows the menu frame and drops Public Profile and Settings", () => {
    renderIt();
    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/auctions",
      "/dashboard/bids",
      "/dashboard/bids?tab=watching",
      "/messages",
      "/account",
      "/support",
    ]);
    expect(screen.queryByText(/Public Profile/)).toBeNull();
    expect(screen.queryByText(/Settings/)).toBeNull();
  });

  it("shows My listings for sellers", () => {
    renderIt({ role: "seller" });
    expect(screen.getByRole("link", { name: "My listings" })).toHaveAttribute(
      "href",
      "/dashboard/listings"
    );
  });

  it("badges My bids with the number of lots to pay", () => {
    (useQuery as Mock).mockImplementation((ref: string) =>
      ref === "lotPayments:getMyPaymentSummary" ? { awaitingCount: 2 } : 0
    );
    renderIt();
    expect(
      screen.getByRole("link", { name: "My bids, 2 to pay" })
    ).toBeInTheDocument();
  });
});

describe("UserDropdown on a phone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockImplementation((ref: string) =>
      ref === "registration:getMyBidEligibility" ? { kind: "ok" } : 0
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a sheet from the avatar with the links and Sign out", async () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    render(
      <BrowserRouter>
        <UserDropdown
          userData={{ name: "Thandi Naidoo", email: "t@x.za", _id: "1" }}
          isLoadingProfile={false}
          isVerified={false}
          kycStatus="unverified"
          role="buyer"
          onSignOut={onSignOut}
        />
      </BrowserRouter>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("You can bid")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Finish registration/ })
    ).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/account"
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
