import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "convex/_generated/api";

import AdminAnnouncements from "./AdminAnnouncements";

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock convex api
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      listAnnouncements: "admin:listAnnouncements",
      getAnnouncementStats: "admin:getAnnouncementStats",
      getAdminStats: "admin:getAdminStats",
      createAnnouncement: "admin:createAnnouncement",
    },
  },
}));

const mockAnnouncements = [
  {
    _id: "id1",
    _creationTime: 1710000000000,
    createdAt: 1710000000000,
    title: "Update 1",
    message: "Content 1",
    readCount: 10,
  },
  {
    _id: "id2",
    _creationTime: 1710100000000,
    createdAt: 1710100000000,
    title: "Update 2",
    message: "Content 2",
    readCount: 5,
  },
];

const mockPaginatedAnnouncements = {
  page: mockAnnouncements,
  isDone: true,
  continueCursor: "",
  totalCount: mockAnnouncements.length,
  pageStatus: null,
  splitCursor: null,
};

const mockAnnouncementStats = {
  total: 2,
  recent: 1,
};

const mockAdminStats = {
  liveUsers: 10,
  totalUsers: 100,
  pendingReview: 5,
};

describe("AdminAnnouncements Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation for useQuery
    (useQuery as Mock).mockImplementation((query) => {
      if (query === api.admin.listAnnouncements)
        return mockPaginatedAnnouncements;
      if (query === api.admin.getAnnouncementStats)
        return mockAnnouncementStats;
      if (query === api.admin.getAdminStats) return mockAdminStats;
      return undefined;
    });

    (useMutation as Mock).mockReturnValue(
      Object.assign(vi.fn().mockResolvedValue({}), {
        withOptimisticUpdate: vi.fn(),
      })
    );
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <AdminAnnouncements />
      </BrowserRouter>
    );

  it("renders loading state when data is undefined", () => {
    (useQuery as Mock).mockImplementation(() => undefined);
    renderPage();
    expect(
      screen.getByRole("status", { name: /loading/i })
    ).toBeInTheDocument();
  });

  it("renders empty state when no announcements exist", () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === api.admin.listAnnouncements)
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          totalCount: 0,
          pageStatus: null,
          splitCursor: null,
        };
      if (query === api.admin.getAnnouncementStats)
        return { total: 0, recent: 0 };
      if (query === api.admin.getAdminStats) return mockAdminStats;
      return undefined;
    });

    renderPage();
    expect(screen.getByText(/no announcements sent yet/i)).toBeInTheDocument();

    // Check stats are 0 (Total Sent, Last 7 Days, and Engaged Users)
    expect(screen.getAllByText("0")).toHaveLength(3);
    expect(screen.getByText("Engaged Users")).toBeInTheDocument();
  });

  it("renders stats and announcement history", () => {
    renderPage();

    // Verify stats cards
    expect(screen.getByText("Total Sent")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // total mock

    expect(screen.getByText("Last 7 Days")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // recent mock

    expect(screen.getByText("Engaged Users")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument(); // 10 + 5 readCount

    // Verify table content
    expect(screen.getByText("Update 1")).toBeInTheDocument();
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.getByText("Update 2")).toBeInTheDocument();
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });

  it("opens the new announcement dialog", () => {
    renderPage();
    const newBtn = screen.getByRole("button", { name: /new announcement/i });
    fireEvent.click(newBtn);

    expect(
      screen.getByText("New Announcement", { selector: "h2" })
    ).toBeInTheDocument();
  });

  it("successfully creates a new announcement", async () => {
    const createMutation = Object.assign(vi.fn().mockResolvedValue({}), {
      withOptimisticUpdate: vi.fn(),
    });
    (useMutation as Mock).mockReturnValue(createMutation);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /new announcement/i }));

    const titleInput = screen.getByPlaceholderText(/maintenance update/i);
    const messageInput = screen.getByPlaceholderText(/we will be offline/i);

    fireEvent.change(titleInput, { target: { value: "Test Title" } });
    fireEvent.change(messageInput, { target: { value: "Test Message" } });

    fireEvent.click(screen.getByRole("button", { name: /send broadcast/i }));

    await waitFor(() => {
      expect(createMutation).toHaveBeenCalledWith({
        title: "Test Title",
        message: "Test Message",
      });
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Announcement sent successfully"
    );
  });

  it("closes the dialog when Cancel is clicked", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /new announcement/i }));

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(
        screen.queryByText("New Announcement", { selector: "h2" })
      ).not.toBeInTheDocument();
    });
  });

  it("shows error toast when fields are empty", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /new announcement/i }));
    fireEvent.click(screen.getByRole("button", { name: /send broadcast/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "Title and message cannot be empty"
    );
  });

  it("shows error toast when title is too long", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /new announcement/i }));

    const titleInput = screen.getByPlaceholderText(/maintenance update/i);
    const messageInput = screen.getByPlaceholderText(/we will be offline/i);

    fireEvent.change(titleInput, { target: { value: "a".repeat(201) } });
    fireEvent.change(messageInput, { target: { value: "Valid Message" } });
    fireEvent.click(screen.getByRole("button", { name: /send broadcast/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "Title must be 200 characters or fewer"
    );
  });

  it("shows error toast when message is too long", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /new announcement/i }));

    const titleInput = screen.getByPlaceholderText(/maintenance update/i);
    const messageInput = screen.getByPlaceholderText(/we will be offline/i);

    fireEvent.change(titleInput, { target: { value: "Test Title" } });
    fireEvent.change(messageInput, { target: { value: "a".repeat(2001) } });
    fireEvent.click(screen.getByRole("button", { name: /send broadcast/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "Message must be 2000 characters or fewer"
    );
  });

  it("handles server error during creation", async () => {
    const createMutation = Object.assign(
      vi.fn().mockRejectedValue(new Error("Server error")),
      { withOptimisticUpdate: vi.fn() }
    );
    (useMutation as Mock).mockReturnValue(createMutation);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /new announcement/i }));

    fireEvent.change(screen.getByPlaceholderText(/maintenance update/i), {
      target: { value: "Title" },
    });
    fireEvent.change(screen.getByPlaceholderText(/we will be offline/i), {
      target: { value: "Message" },
    });

    fireEvent.click(screen.getByRole("button", { name: /send broadcast/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });
});
