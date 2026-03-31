import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import React from "react";

import { useSession } from "@/lib/auth-client";

import Settings from "./Settings";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(() => ({ data: { user: { id: "u1" } } })),
}));

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    userPreferences: {
      getMyPreferences: { name: "userPreferences:getMyPreferences" },
      updateMyPreferences: { name: "userPreferences:updateMyPreferences" },
    },
    users: {
      getMyProfile: { name: "users:getMyProfile" },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({ api: mockApi }));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <label className={className}>{children}</label>,
}));

vi.mock("@/components/ui/select", () => {
  interface MockProps {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }
  return {
    Select: ({ children, onValueChange }: MockProps) => (
      <div>
        {Array.isArray(children)
          ? children.map((child) =>
              child?.props?.children
                ? { ...child, props: { ...child.props, onValueChange } }
                : child
            )
          : children}
      </div>
    ),
    SelectTrigger: ({ children }: MockProps) => <div>{children}</div>,
    SelectValue: () => <span />,
    SelectContent: ({
      children,
      onValueChange,
    }: MockProps & { onValueChange?: (v: string) => void }) => (
      <div>
        {Array.isArray(children)
          ? children.map(
              (
                child: React.ReactElement<{
                  value: string;
                  onClick?: () => void;
                }>
              ) =>
                React.isValidElement(child)
                  ? React.cloneElement(child, {
                      onClick: () => onValueChange?.(child.props.value),
                    })
                  : child
            )
          : children}
      </div>
    ),
    SelectItem: ({
      children,
      value,
      onClick,
    }: {
      children: React.ReactNode;
      value: string;
      onClick?: () => void;
    }) => (
      <button data-testid={`select-item-${value}`} onClick={onClick}>
        {children}
      </button>
    ),
  };
});

vi.mock("@/components/LoadingIndicator", () => ({
  LoadingPage: ({ message }: { message: string }) => <div>{message}</div>,
}));

describe("Settings Page", () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockReturnValue(mockMutate);
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.userPreferences.getMyPreferences) return null;
      if (apiPath === mockApi.users.getMyProfile)
        return { profile: { role: "buyer" } };
      return null;
    });
  });

  const renderSettings = () =>
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    );

  it("renders loading state when preferences are undefined", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderSettings();
    expect(screen.getByText("Loading settings...")).toBeInTheDocument();
  });

  it("renders all sections", () => {
    renderSettings();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Display")).toBeInTheDocument();
    expect(screen.getByText("Bidding")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("does not render seller-only section for non-sellers", () => {
    renderSettings();
    expect(
      screen.queryByText("Auction Approval Notifications")
    ).not.toBeInTheDocument();
  });

  it("renders seller-only section for sellers", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.userPreferences.getMyPreferences) return null;
      if (apiPath === mockApi.users.getMyProfile)
        return { profile: { role: "seller" } };
      return null;
    });
    renderSettings();
    expect(
      screen.getByText("Auction Approval Notifications")
    ).toBeInTheDocument();
  });

  it("toggles sidebar switch and calls mutation", () => {
    renderSettings();
    fireEvent.click(
      screen.getByRole("switch", { name: "Show Filter Sidebar by Default" })
    );
    expect(mockMutate).toHaveBeenCalledWith({ sidebarOpen: true });
  });

  it("toggles bid confirmation switch and calls mutation", () => {
    renderSettings();
    fireEvent.click(
      screen.getByRole("switch", { name: "Require Bid Confirmation" })
    );
    expect(mockMutate).toHaveBeenCalledWith({
      biddingRequireConfirmation: true,
    });
  });

  it("toggles proxy bid switch and calls mutation", () => {
    renderSettings();
    fireEvent.click(
      screen.getByRole("switch", { name: "Enable Proxy Bidding by Default" })
    );
    expect(mockMutate).toHaveBeenCalledWith({ biddingProxyBidDefault: true });
  });

  it("toggles outbid alert switch and calls mutation", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("switch", { name: "Outbid Alerts" }));
    expect(mockMutate).toHaveBeenCalledWith({ notificationsBidOutbid: false });
  });

  it("toggles auction won switch and calls mutation", () => {
    renderSettings();
    fireEvent.click(
      screen.getByRole("switch", { name: "Auction Won Notifications" })
    );
    expect(mockMutate).toHaveBeenCalledWith({ notificationsAuctionWon: false });
  });

  it("toggles email notifications switch and calls mutation", () => {
    renderSettings();
    fireEvent.click(
      screen.getByRole("switch", { name: "Email Notifications" })
    );
    expect(mockMutate).toHaveBeenCalledWith({
      notificationsEmailEnabled: true,
    });
  });

  it("does not call mutation when session is null", () => {
    (useSession as Mock).mockReturnValue({ data: null });
    renderSettings();
    fireEvent.click(
      screen.getByRole("switch", { name: "Show Filter Sidebar by Default" })
    );
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("reflects saved preferences in switch aria-checked", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.userPreferences.getMyPreferences)
        return { sidebarOpen: true, biddingRequireConfirmation: true };
      if (apiPath === mockApi.users.getMyProfile)
        return { profile: { role: "buyer" } };
      return null;
    });
    renderSettings();
    expect(
      screen.getByRole("switch", { name: "Show Filter Sidebar by Default" })
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Require Bid Confirmation" })
    ).toHaveAttribute("aria-checked", "true");
  });

  it("toggles seller auction approval switch for sellers", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.userPreferences.getMyPreferences) return null;
      if (apiPath === mockApi.users.getMyProfile)
        return { profile: { role: "seller" } };
      return null;
    });
    renderSettings();
    fireEvent.click(
      screen.getByRole("switch", { name: "Auction Approval Notifications" })
    );
    expect(mockMutate).toHaveBeenCalledWith({
      notificationsSellerAuctionApproved: false,
    });
  });

  it("handles view mode change through select", () => {
    renderSettings();
    const selectItems = screen.getAllByTestId("select-item-detailed");
    fireEvent.click(selectItems[0]);
    expect(mockMutate).toHaveBeenCalledWith({ viewMode: "detailed" });
  });

  it("handles default status filter change through select", () => {
    renderSettings();
    const selectItems = screen.getAllByTestId("select-item-all");
    fireEvent.click(selectItems[0]);
    expect(mockMutate).toHaveBeenCalledWith({ defaultStatusFilter: "all" });
  });

  it("handles watchlist ending alerts change through select", () => {
    renderSettings();
    const selectItems = screen.getAllByTestId("select-item-24h");
    fireEvent.click(selectItems[0]);
    expect(mockMutate).toHaveBeenCalledWith({
      notificationsWatchlistEnding: "24h",
    });
  });

  it("renders all toggles in their non-default CSS state", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.userPreferences.getMyPreferences)
        return {
          biddingProxyBidDefault: true,
          notificationsBidOutbid: false,
          notificationsAuctionWon: false,
          notificationsSellerAuctionApproved: false,
          notificationsEmailEnabled: true,
        };
      if (apiPath === mockApi.users.getMyProfile)
        return { profile: { role: "seller" } };
      return null;
    });
    renderSettings();
    expect(
      screen.getByRole("switch", { name: "Enable Proxy Bidding by Default" })
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Outbid Alerts" })
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: "Auction Won Notifications" })
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: "Auction Approval Notifications" })
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: "Email Notifications" })
    ).toHaveAttribute("aria-checked", "true");
  });

  it("renders with preferences set to null values", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.userPreferences.getMyPreferences)
        return {
          viewMode: null,
          sidebarOpen: null,
          notificationsWatchlistEnding: null,
        };
      if (apiPath === mockApi.users.getMyProfile)
        return { profile: { role: "buyer" } };
      return null;
    });
    renderSettings();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
