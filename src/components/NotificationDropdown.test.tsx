import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import { handleNotificationClick } from "@/lib/notifications";

import { NotificationDropdown } from "./NotificationDropdown";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/notifications", () => ({
  getNotificationIcon: vi.fn(() => <span>icon</span>),
  handleNotificationClick: vi.fn(),
}));

interface DropdownMenuProps {
  children?: React.ReactNode;
  onSelect?: () => void;
}

// Mock DropdownMenu components to render inline
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: DropdownMenuProps) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: DropdownMenuProps) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: DropdownMenuProps) => (
    <div data-testid="notifications-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
  }: DropdownMenuProps & { onSelect?: () => void }) => (
    <div onClick={onSelect}>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: DropdownMenuProps) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

describe("NotificationDropdown", () => {
  const mockNavigate = vi.fn();
  const mockNotificationsResult = {
    page: [
      {
        _id: "n1",
        type: "info",
        title: "New Bid",
        message: "You got a bid",
        createdAt: Date.now(),
        isRead: false,
      },
      {
        _id: "n2",
        type: "success",
        title: "Sold",
        message: "Item sold",
        createdAt: Date.now(),
        isRead: true,
      },
    ],
    isDone: true,
    continueCursor: "",
    totalCount: 2,
    pageStatus: null,
    splitCursor: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    (useQuery as Mock).mockReturnValue(mockNotificationsResult);
    (useMutation as Mock).mockReturnValue(vi.fn());
  });

  const renderDropdown = () => {
    return render(
      <BrowserRouter>
        <NotificationDropdown />
      </BrowserRouter>
    );
  };

  it("renders trigger with unread count", () => {
    renderDropdown();
    expect(
      screen.getByLabelText(/Notifications, 1 unread/i)
    ).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders notifications list", () => {
    renderDropdown();
    expect(screen.getByText("New Bid")).toBeInTheDocument();
    expect(screen.getByText("Sold")).toBeInTheDocument();
    expect(screen.getByText("You got a bid")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    (useQuery as Mock).mockReturnValue({
      page: [],
      isDone: true,
      continueCursor: "",
      totalCount: 0,
      pageStatus: null,
      splitCursor: null,
    });
    renderDropdown();
    expect(screen.getByText(/All caught up/i)).toBeInTheDocument();
  });

  it("calls markAllRead when button is clicked", async () => {
    const mockMarkAllRead = vi.fn().mockResolvedValue({});
    (useMutation as Mock).mockImplementation((apiRef: { _path: string }) => {
      if (apiRef?._path === "notifications:markAllRead") return mockMarkAllRead;
      return vi.fn();
    });

    // We need to mock the api path for the component to identify the mutation
    vi.mock("convex/_generated/api", () => ({
      api: {
        notifications: {
          getMyNotifications: { _path: "notifications:getMyNotifications" },
          markAsRead: { _path: "notifications:markAsRead" },
          markAllRead: { _path: "notifications:markAllRead" },
        },
      },
    }));

    renderDropdown();
    const btn = screen.getByText(/Mark all read/i);
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockMarkAllRead).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("marked as read")
      );
    });
  });

  it("handles error when markAllRead fails", async () => {
    const mockMarkAllRead = vi.fn().mockRejectedValue(new Error("Fail"));
    (useMutation as Mock).mockImplementation((apiRef: { _path: string }) => {
      if (apiRef?._path === "notifications:markAllRead") return mockMarkAllRead;
      return vi.fn();
    });

    renderDropdown();
    const btn = screen.getByText(/Mark all read/i);
    fireEvent.click(btn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Action failed");
    });
  });

  it("navigates to archive when 'View Archive' is clicked", () => {
    renderDropdown();
    const btn = screen.getByText(/View Archive/i);
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith("/notifications");
  });

  it("marks notification as read and navigates when clicked", async () => {
    const mockMarkAsRead = vi.fn().mockResolvedValue({});
    (useMutation as Mock).mockImplementation((apiRef: { _path: string }) => {
      if (apiRef?._path === "notifications:markAsRead") return mockMarkAsRead;
      return vi.fn();
    });

    renderDropdown();
    const notification = screen.getByText("New Bid");
    fireEvent.click(notification);

    await waitFor(() => {
      expect(handleNotificationClick).toHaveBeenCalled();
    });
  });

  it("handles error when notification action fails", async () => {
    (handleNotificationClick as Mock).mockRejectedValue(
      new Error("Click fail")
    );

    renderDropdown();
    const item = screen.getByText("New Bid");
    fireEvent.click(item);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to process notification"
      );
    });
  });

  it("renders loading state when notifications are undefined", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderDropdown();
    expect(screen.getByText(/Syncing\.\.\./i)).toBeInTheDocument();
  });
});
