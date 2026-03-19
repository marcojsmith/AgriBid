import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AuditTab } from "./AuditTab";

const mockLogs = [
  {
    _id: "log-1",
    timestamp: Date.now(),
    adminId: "admin-123",
    action: "DELETE_USER",
    targetType: "user",
    targetId: "user-456",
    details: '{"reason": "spam"}',
  },
  {
    _id: "log-2",
    timestamp: Date.now(),
    adminId: "admin-789",
    action: "UPDATE_LISTING",
    targetType: "auction",
    targetId: "auction-101",
    details: null,
  },
];

const mockPaginatedResult = {
  page: mockLogs,
  isDone: true,
  continueCursor: "",
  totalCount: 2,
  pageStatus: null,
  splitCursor: null,
};

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
}));

describe("AuditTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<AuditTab />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders empty state when no logs", () => {
    mockUseQuery.mockReturnValue({
      page: [],
      isDone: true,
      continueCursor: "",
      totalCount: 0,
      pageStatus: null,
      splitCursor: null,
    });
    render(<AuditTab />);
    expect(screen.getByText("No audit logs found")).toBeInTheDocument();
  });

  it("renders audit logs table with data", () => {
    mockUseQuery.mockReturnValue(mockPaginatedResult);
    render(<AuditTab />);
    expect(screen.getByText("DELETE_USER")).toBeInTheDocument();
    expect(screen.getByText("UPDATE_LISTING")).toBeInTheDocument();
  });

  it("displays admin ID with truncation", () => {
    const longIdLog = {
      _id: "log-3",
      timestamp: Date.now(),
      adminId: "admin-123456789",
      action: "TEST",
      targetType: "user",
      targetId: "user-1",
      details: null,
    };
    mockUseQuery.mockReturnValue({
      page: [longIdLog],
      isDone: true,
      continueCursor: "",
      totalCount: 1,
      pageStatus: null,
      splitCursor: null,
    });
    render(<AuditTab />);
    expect(screen.getByText("admin-1234...")).toBeInTheDocument();
  });

  it("displays target info", () => {
    mockUseQuery.mockReturnValue(mockPaginatedResult);
    render(<AuditTab />);
    expect(screen.getByText(/user: user-456/)).toBeInTheDocument();
  });

  it("renders pagination controls when logs exist", () => {
    mockUseQuery.mockReturnValue(mockPaginatedResult);
    render(<AuditTab />);
    expect(screen.getByText("Reset")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("disables Reset button when on last page (isDone)", () => {
    mockUseQuery.mockReturnValue(mockPaginatedResult);
    render(<AuditTab />);
    const resetButton = screen.getByText("Reset").closest("button");
    expect(resetButton).toBeDisabled();
  });

  it("shows entry count", () => {
    mockUseQuery.mockReturnValue(mockPaginatedResult);
    render(<AuditTab />);
    expect(screen.getByText(/Showing 2 of 2 entries/)).toBeInTheDocument();
  });

  it("renders JSON details in expandable format", () => {
    const resultWithJson = {
      page: [mockLogs[0]],
      isDone: true,
      continueCursor: "",
      totalCount: 1,
      pageStatus: null,
      splitCursor: null,
    };
    mockUseQuery.mockReturnValue(resultWithJson);
    render(<AuditTab />);
    expect(screen.getByText("View Payload")).toBeInTheDocument();
  });

  it("shows dash for null details", () => {
    mockUseQuery.mockReturnValue(mockPaginatedResult);
    render(<AuditTab />);
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("formats invalid json details directly", () => {
    const invalidJsonLog = {
      ...mockLogs[0],
      details: "Invalid JSON string",
    };
    mockUseQuery.mockReturnValue({
      page: [invalidJsonLog],
      isDone: true,
      continueCursor: "",
      totalCount: 1,
      pageStatus: null,
      splitCursor: null,
    });
    render(<AuditTab />);
    expect(screen.getByText("Invalid JSON string")).toBeInTheDocument();
  });

  it("handles pagination clicks", () => {
    mockUseQuery.mockReturnValue({
      page: mockLogs,
      isDone: false,
      continueCursor: "next_cursor",
      totalCount: 100,
      pageStatus: null,
      splitCursor: null,
    });
    render(<AuditTab />);

    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    // Reset button should now be enabled since cursor is not null
    const resetButton = screen.getByText("Reset").closest("button");
    expect(resetButton).not.toBeDisabled();
  });
});
