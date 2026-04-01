import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import React from "react";

import { useSession } from "@/lib/auth-client";

import Settings from "./Settings";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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
    disabled?: boolean;
  }
  return {
    Select: ({ children, onValueChange, disabled }: MockProps) => (
      <div>
        {Array.isArray(children)
          ? children.map((child) =>
              child?.props?.children
                ? {
                    ...child,
                    props: {
                      ...child.props,
                      onValueChange,
                      disabled,
                    },
                  }
                : child
            )
          : children}
      </div>
    ),
    SelectTrigger: ({ children, disabled }: MockProps) => (
      <button disabled={disabled} data-disabled={disabled}>
        {children}
      </button>
    ),
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
    mockMutate.mockResolvedValue(undefined);
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
    fireEvent.click(
      screen.getByRole("switch", { name: "Outbid Alerts in-app" })
    );
    expect(mockMutate).toHaveBeenCalledWith({
      notificationsOutbid: {
        inApp: false,
        push: false,
        email: false,
        whatsapp: false,
      },
    });
  });

  it("toggles auction won switch and calls mutation", () => {
    renderSettings();
    fireEvent.click(
      screen.getByRole("switch", { name: "Auction Won Notifications in-app" })
    );
    expect(mockMutate).toHaveBeenCalledWith({
      notificationsAuctionWon: {
        inApp: false,
        push: false,
        email: false,
        whatsapp: false,
      },
    });
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
      screen.getByRole("switch", {
        name: "Auction Approval Notifications in-app",
      })
    );
    expect(mockMutate).toHaveBeenCalledWith({
      notificationsListingApproved: {
        inApp: false,
        push: false,
        email: false,
        whatsapp: false,
      },
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

  it("toggles switch on Enter key press", () => {
    renderSettings();
    const switchEl = screen.getByRole("switch", {
      name: "Show Filter Sidebar by Default",
    });
    fireEvent.keyDown(switchEl, { key: "Enter" });
    expect(mockMutate).toHaveBeenCalledWith({ sidebarOpen: true });
  });

  it("toggles switch on Space key press", () => {
    renderSettings();
    const switchEl = screen.getByRole("switch", {
      name: "Require Bid Confirmation",
    });
    fireEvent.keyDown(switchEl, { key: " " });
    expect(mockMutate).toHaveBeenCalledWith({
      biddingRequireConfirmation: true,
    });
  });

  it("shows error toast when mutation fails", async () => {
    mockMutate.mockRejectedValueOnce(new Error("Network error"));
    renderSettings();
    fireEvent.click(
      screen.getByRole("switch", { name: "Show Filter Sidebar by Default" })
    );
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save setting");
    });
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

  it("toggles watchlist ending alerts switch and calls mutation", () => {
    renderSettings();
    fireEvent.click(
      screen.getByRole("switch", { name: "Watchlist Ending Alerts in-app" })
    );
    expect(mockMutate).toHaveBeenCalledWith({
      notificationsWatchlistEnding: {
        inApp: false,
        push: false,
        email: false,
        whatsapp: false,
        window: "1h",
      },
    });
  });

  it("handles watchlist ending time window change through select", () => {
    renderSettings();
    const selectItems = screen.getAllByTestId("select-item-24h");
    fireEvent.click(selectItems[0]);
    expect(mockMutate).toHaveBeenCalledWith({
      notificationsWatchlistEnding: {
        inApp: true,
        push: false,
        email: false,
        whatsapp: false,
        window: "24h",
      },
    });
  });

  it("renders all toggles in their non-default CSS state", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.userPreferences.getMyPreferences)
        return {
          biddingProxyBidDefault: true,
          notificationsOutbid: {
            inApp: false,
            push: false,
            email: false,
            whatsapp: false,
          },
          notificationsAuctionWon: {
            inApp: false,
            push: false,
            email: false,
            whatsapp: false,
          },
          notificationsWatchlistEnding: {
            inApp: false,
            push: false,
            email: false,
            whatsapp: false,
            window: "1h",
          },
          notificationsListingApproved: {
            inApp: false,
            push: false,
            email: false,
            whatsapp: false,
          },
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
      screen.getByRole("switch", { name: "Outbid Alerts in-app" })
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: "Auction Won Notifications in-app" })
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: "Watchlist Ending Alerts in-app" })
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", {
        name: "Auction Approval Notifications in-app",
      })
    ).toHaveAttribute("aria-checked", "false");
  });

  it("disables watchlist time window select when alerts are disabled", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.userPreferences.getMyPreferences)
        return {
          notificationsWatchlistEnding: {
            inApp: false,
            push: false,
            email: false,
            whatsapp: false,
            window: "1h",
          },
        };
      if (apiPath === mockApi.users.getMyProfile)
        return { profile: { role: "buyer" } };
      return null;
    });
    renderSettings();
    const label = screen.getByText("Alert Before Auction Ends");
    const selectWrapper = label.nextElementSibling;
    const trigger = selectWrapper?.querySelector("button");
    expect(trigger).toHaveAttribute("disabled");
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
