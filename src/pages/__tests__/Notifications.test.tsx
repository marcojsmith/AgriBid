import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import { handleNotificationClick } from "@/lib/notifications";

import Notifications from "../Notifications";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock Convex API
vi.mock("convex/_generated/api", () => ({
  api: {
    notifications: {
      getNotificationArchive: { name: "notifications:getNotificationArchive" },
      markAsRead: { name: "notifications:markAsRead" },
      markAllRead: { name: "notifications:markAllRead" },
    },
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock handleNotificationClick
vi.mock("@/lib/notifications", () => ({
  handleNotificationClick: vi.fn(),
  getNotificationIcon: () => <div data-testid="notification-icon">Icon</div>,
}));

describe("Notifications Page", () => {
  const mockNotifications = [
    {
      _id: "notif1",
      title: "New Bid",
      message: "You have a new bid on your tractor",
      type: "bid",
      isRead: false,
      createdAt: Date.now(),
      link: "/auction/1",
    },
    {
      _id: "notif2",
      title: "Auction Ended",
      message: "Your auction has ended",
      type: "auction_ended",
      isRead: true,
      createdAt: Date.now() - 86400000,
    },
  ];

  const mockMarkRead = vi.fn();
  const mockMarkAllRead = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockImplementation((apiPath: unknown) => {
      const apiObj = apiPath as Record<string, unknown>;
      const name = typeof apiObj?.name === "string" ? apiObj.name : undefined;
      const pathName =
        typeof name === "string"
          ? name
          : typeof apiPath === "string"
            ? apiPath
            : "";

      if (pathName.includes("getNotificationArchive")) return mockNotifications;
      return null;
    });
    (useMutation as Mock).mockImplementation((apiPath: unknown) => {
      const apiObj = apiPath as Record<string, unknown>;
      const name = typeof apiObj?.name === "string" ? apiObj.name : undefined;
      const pathName =
        typeof name === "string"
          ? name
          : typeof apiPath === "string"
            ? apiPath
            : "";
      if (pathName.includes("markAsRead")) return mockMarkRead;
      if (pathName.includes("markAllRead")) return mockMarkAllRead;
      return vi.fn();
    });
  });

  const renderNotifications = () => {
    return render(
      <BrowserRouter>
        <Notifications />
      </BrowserRouter>
    );
  };

  it("renders loading state", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderNotifications();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    (useQuery as Mock).mockImplementation((apiPath: unknown) => {
      const apiObj = apiPath as Record<string, unknown>;
      const name = typeof apiObj?.name === "string" ? apiObj.name : undefined;
      const pathName =
        typeof name === "string"
          ? name
          : typeof apiPath === "string"
            ? apiPath
            : "";
      if (pathName.includes("getNotificationArchive")) return [];
      return null;
    });
    renderNotifications();
    expect(screen.getByText(/No notifications/i)).toBeInTheDocument();
    expect(
      screen.getByText(/You're all caught up for now/i)
    ).toBeInTheDocument();
  });

  it("renders the notification list", () => {
    renderNotifications();
    expect(screen.getByText("Notification Archive")).toBeInTheDocument();
    expect(screen.getByText("New Bid")).toBeInTheDocument();
    expect(screen.getByText("Auction Ended")).toBeInTheDocument();
    expect(
      screen.getByText("You have a new bid on your tractor")
    ).toBeInTheDocument();
  });

  it("marks all as read successfully", async () => {
    mockMarkAllRead.mockResolvedValueOnce({});
    renderNotifications();

    const markAllBtn = screen.getByText("Mark all as read");
    await act(async () => {
      fireEvent.click(markAllBtn);
    });

    expect(mockMarkAllRead).toHaveBeenCalled();
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "All notifications marked as read"
      );
    });
  });

  it("handles individual notification click", async () => {
    renderNotifications();

    const notification = screen
      .getByText("New Bid")
      .closest("div[class*='group']");
    await act(async () => {
      fireEvent.click(notification!);
    });

    expect(handleNotificationClick).toHaveBeenCalledWith(
      "notif1",
      "/auction/1",
      expect.any(Function), // navigate
      mockMarkRead
    );
  });

  it("handles mark all read error", async () => {
    mockMarkAllRead.mockRejectedValueOnce(new Error("Failed"));
    renderNotifications();

    const markAllBtn = screen.getByText("Mark all as read");
    await act(async () => {
      fireEvent.click(markAllBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Action failed: Failed");
    });
  });
});
