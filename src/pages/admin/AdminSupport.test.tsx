import { BrowserRouter } from "react-router-dom";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";

import {
  AdminStatsContext,
  type AdminStats,
} from "../../contexts/admin-stats-types";
import AdminSupport from "./AdminSupport";

// Mock convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock api
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getAdminStats: "admin:getAdminStats",
      getTickets: "admin:getTickets",
      resolveTicket: "admin:resolveTicket",
    },
  },
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockTickets = [
  {
    _id: "t1",
    status: "open",
    subject: "Help with bidding",
    message: "I cannot place a bid on tractor X",
    priority: "high",
    userId: "user1",
    createdAt: Date.now(),
  },
  {
    _id: "t2",
    status: "resolved",
    subject: "Account access",
    message: "Cannot login",
    priority: "medium",
    userId: "user2",
    createdAt: Date.now() - 86400000,
  },
];

const mockPaginatedTickets = {
  page: mockTickets,
  isDone: true,
  continueCursor: "",
  totalCount: mockTickets.length,
  pageStatus: null,
  splitCursor: null,
};

const mockAdminStatsValue: AdminStats = {
  totalAuctions: 50,
  activeAuctions: 20,
  pendingReview: 5,
  totalUsers: 100,
  verifiedSellers: 10,
  kycPending: 3,
  status: "healthy",
  liveUsers: 10,
  activeWatch: 15,
};

describe("AdminSupport Page", () => {
  const mockResolveTicket = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockReturnValue(mockResolveTicket);
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats" || query === api.admin.getAdminStats)
        return mockAdminStatsValue;
      return undefined;
    });
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <AdminStatsContext.Provider value={mockAdminStatsValue}>
          <AdminSupport />
        </AdminStatsContext.Provider>
      </BrowserRouter>
    );

  it("renders loading state when initial stats are fetching", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderPage();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders loading state specifically for SupportTab when stats are loaded but tickets are undefined", () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return undefined;
      return undefined;
    });

    renderPage();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders support tickets and layout when data is loaded", () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return mockPaginatedTickets;
      return undefined;
    });

    renderPage();

    expect(screen.getByText("Support Tickets")).toBeInTheDocument();
    expect(screen.getByText("Help with bidding")).toBeInTheDocument();
    expect(screen.getByText("Account access")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("resolved")).toBeInTheDocument();
  });

  it("handles ticket resolution successfully", async () => {
    mockResolveTicket.mockResolvedValue({ success: true });
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return mockPaginatedTickets;
      return undefined;
    });

    renderPage();

    const resolveButton = screen.getByRole("button", { name: /resolve/i });
    fireEvent.click(resolveButton);

    expect(screen.getByText("Resolve Support Ticket")).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText("Describe the resolution...");
    fireEvent.change(textarea, { target: { value: "Fixed the issue" } });

    const confirmButton = screen.getByRole("button", {
      name: "Confirm Resolution",
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockResolveTicket).toHaveBeenCalledWith({
        ticketId: "t1",
        resolution: "Fixed the issue",
      });
    });

    expect(toast.success).toHaveBeenCalledWith("Ticket resolved");
  });

  it("handles ticket resolution failure", async () => {
    mockResolveTicket.mockRejectedValue(new Error("Resolution failed"));
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return mockPaginatedTickets;
      return undefined;
    });

    renderPage();

    const resolveButton = screen.getByRole("button", { name: /resolve/i });
    fireEvent.click(resolveButton);

    fireEvent.change(
      screen.getByPlaceholderText("Describe the resolution..."),
      {
        target: { value: "Fixed the issue" },
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm Resolution" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Resolution failed");
    });
  });

  it("handles ticket resolution failure with non-Error object", async () => {
    mockResolveTicket.mockRejectedValue("Generic error string");
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return mockPaginatedTickets;
      return undefined;
    });

    renderPage();

    const resolveButton = screen.getByRole("button", { name: /resolve/i });
    fireEvent.click(resolveButton);

    fireEvent.change(
      screen.getByPlaceholderText("Describe the resolution..."),
      {
        target: { value: "Fixed" },
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm Resolution" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to resolve ticket");
    });
  });

  it("prevents submission with empty resolution after trimming", () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return mockPaginatedTickets;
      return undefined;
    });

    renderPage();

    const resolveButton = screen.getByRole("button", { name: /resolve/i });
    fireEvent.click(resolveButton);

    const textarea = screen.getByPlaceholderText("Describe the resolution...");
    fireEvent.change(textarea, { target: { value: "   " } }); // Just spaces

    const confirmButton = screen.getByRole("button", {
      name: "Confirm Resolution",
    });
    expect(confirmButton).toBeDisabled();
  });

  it("validates resolution message", async () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return mockPaginatedTickets;
      return undefined;
    });

    renderPage();

    const resolveButton = screen.getByRole("button", { name: /resolve/i });
    fireEvent.click(resolveButton);

    const confirmButton = screen.getByRole("button", {
      name: "Confirm Resolution",
    });
    expect(confirmButton).toBeDisabled();
  });

  it("renders empty state when no tickets exist", () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          totalCount: 0,
          pageStatus: null,
          splitCursor: null,
        };
      return undefined;
    });

    renderPage();

    expect(screen.getByText("No support tickets")).toBeInTheDocument();
  });

  it("closes resolution dialog on cancel or backdrop click", async () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return mockPaginatedTickets;
      return undefined;
    });

    renderPage();

    const resolveButton = screen.getByRole("button", { name: /resolve/i });
    fireEvent.click(resolveButton);

    expect(screen.getByText("Resolve Support Ticket")).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(
        screen.queryByText("Resolve Support Ticket")
      ).not.toBeInTheDocument();
    });
  });

  it("handles dialog backdrop click through onOpenChange", async () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return mockPaginatedTickets;
      return undefined;
    });

    renderPage();

    const resolveButton = screen.getByRole("button", { name: /resolve/i });
    fireEvent.click(resolveButton);

    const dialog = screen.getByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(
        screen.queryByText("Resolve Support Ticket")
      ).not.toBeInTheDocument();
    });
  });

  it("handles dialog closure via onOpenChange directly", async () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return mockPaginatedTickets;
      return undefined;
    });

    renderPage();

    const resolveButton = screen.getByRole("button", { name: /resolve/i });
    fireEvent.click(resolveButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows loading state on resolve button when resolving", async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockResolveTicket.mockReturnValue(promise);

    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return mockPaginatedTickets;
      return undefined;
    });

    renderPage();

    const resolveButton = screen.getByRole("button", { name: /resolve/i });
    fireEvent.click(resolveButton);

    fireEvent.change(
      screen.getByPlaceholderText("Describe the resolution..."),
      {
        target: { value: "Fixed" },
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm Resolution" }));

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByRole("status", { hidden: true })
      ).toBeInTheDocument();
    });

    const row = screen.getByText("Help with bidding").closest("tr");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).getByRole("status", { hidden: true })
    ).toBeInTheDocument();

    await act(async () => {
      resolvePromise({ success: true });
    });
  });

  it("handles confirmResolve call when no ticket is selected", async () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (
        queryApi === api.admin.getAdminStats ||
        queryApi === "admin:getAdminStats"
      )
        return mockAdminStatsValue;
      if (queryApi === api.admin.getTickets || queryApi === "admin:getTickets")
        return mockPaginatedTickets;
      return undefined;
    });

    renderPage();
  });
});
