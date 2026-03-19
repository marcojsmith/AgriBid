import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useQuery } from "convex/react";

import AdminAudit from "./AdminAudit";

// Mock convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

// Mock api
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getAdminStats: "admin:getAdminStats",
      getAuditLogs: "admin:getAuditLogs",
    },
  },
}));

const mockLogs = Array.from({ length: 60 }, (_, i) => ({
  _id: `log${String(i)}`,
  adminId: `admin${String(i % 3)}`,
  action: i % 2 === 0 ? "UPDATE_USER" : "DELETE_AUCTION",
  targetId: `target${String(i)}`,
  targetType: i % 2 === 0 ? "user" : "auction",
  timestamp: Date.now() - i * 1000 * 60,
  details:
    i === 0 ? JSON.stringify({ old: "val", new: "newVal" }) : "Regular details",
}));

const mockPaginatedLogs = {
  page: mockLogs,
  isDone: true,
  continueCursor: "",
  totalCount: mockLogs.length,
  pageStatus: null,
  splitCursor: null,
};

describe("AdminAudit Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () => {
    return render(
      <MemoryRouter>
        <AdminAudit />
      </MemoryRouter>
    );
  };

  it("renders loading state initially", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderPage();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("renders audit logs when loaded", async () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") {
        return { totalUsers: 100 };
      }
      if (query === "admin:getAuditLogs") {
        return mockPaginatedLogs;
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("UPDATE_USER").length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/showing 60 of 60 entries/i)).toBeInTheDocument();
    // Header + 60 rows
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThanOrEqual(61);
  });

  it("handles pagination (Reset)", async () => {
    const partialLogs = mockLogs.slice(0, 50);
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") {
        return { totalUsers: 100 };
      }
      if (query === "admin:getAuditLogs") {
        return {
          page: partialLogs,
          isDone: false,
          continueCursor: "cursor_after_50",
          totalCount: mockLogs.length,
          pageStatus: null,
          splitCursor: null,
        };
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/showing 50 of 60 entries/i)).toBeInTheDocument();
    });

    const nextButton = screen.getByRole("button", { name: /next/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/showing 50 of 60 entries/i)).toBeInTheDocument();
    });

    const resetButton = screen.getByRole("button", { name: /reset/i });
    fireEvent.click(resetButton);
  });

  it("renders empty state when no logs exist", async () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") {
        return { totalUsers: 100 };
      }
      if (query === "admin:getAuditLogs") {
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          totalCount: 0,
          pageStatus: null,
          splitCursor: null,
        };
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no audit logs found/i)).toBeInTheDocument();
    });
  });

  it("expands JSON payload details correctly", async () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") {
        return { totalUsers: 100 };
      }
      if (query === "admin:getAuditLogs") {
        return {
          page: [mockLogs[0]],
          isDone: true,
          continueCursor: "",
          totalCount: 1,
          pageStatus: null,
          splitCursor: null,
        };
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("View Payload")).toBeInTheDocument();
    });

    const summary = screen.getByText("View Payload");
    fireEvent.click(summary);

    expect(screen.getByText(/"new": "newVal"/i)).toBeInTheDocument();
  });

  it("renders raw string details when not JSON", async () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") {
        return { totalUsers: 100 };
      }
      if (query === "admin:getAuditLogs") {
        return {
          page: [mockLogs[1]],
          isDone: true,
          continueCursor: "",
          totalCount: 1,
          pageStatus: null,
          splitCursor: null,
        };
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Regular details")).toBeInTheDocument();
    });
  });

  it("renders loading indicator for AuditTab if stats are loaded but logs are not", async () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") {
        return { totalUsers: 100 };
      }
      // Return undefined for getAuditLogs to simulate loading state for the tab
      return undefined;
    });

    renderPage();

    // The first loading state (AdminAudit) will be bypassed since stats are returned.
    // The second loading state (AuditTab) will be shown.
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });
});
