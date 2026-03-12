import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AuditTab } from "./AuditTab";

const mockLogs = [
  {
    _id: "log-1",
    timestamp: "2024-01-15T10:30:00Z",
    adminId: "admin-123",
    action: "DELETE_USER",
    targetType: "user",
    targetId: "user-456",
    details: '{"reason": "spam"}',
  },
  {
    _id: "log-2",
    timestamp: "2024-01-15T09:00:00Z",
    adminId: "admin-789",
    action: "UPDATE_LISTING",
    targetType: "auction",
    targetId: "auction-101",
    details: null,
  },
];

const mockResult = {
  logs: mockLogs,
  totalCount: 2,
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
    mockUseQuery.mockReturnValue({ logs: [], totalCount: 0 });
    render(<AuditTab />);
    expect(screen.getByText("No audit logs found")).toBeInTheDocument();
  });

  it("renders audit logs table with data", () => {
    mockUseQuery.mockReturnValue(mockResult);
    render(<AuditTab />);
    expect(screen.getByText("DELETE_USER")).toBeInTheDocument();
    expect(screen.getByText("UPDATE_LISTING")).toBeInTheDocument();
  });

  it("displays admin ID with truncation", () => {
    const longIdLog = {
      _id: "log-3",
      timestamp: "2024-01-15T10:30:00Z",
      adminId: "admin-123456789",
      action: "TEST",
      targetType: "user",
      targetId: "user-1",
      details: null,
    };
    mockUseQuery.mockReturnValue({ logs: [longIdLog], totalCount: 1 });
    render(<AuditTab />);
    expect(screen.getByText("admin-1234...")).toBeInTheDocument();
  });

  it("displays target info", () => {
    mockUseQuery.mockReturnValue(mockResult);
    render(<AuditTab />);
    expect(screen.getByText(/user: user-456/)).toBeInTheDocument();
  });

  it("renders pagination controls when logs exist", () => {
    mockUseQuery.mockReturnValue(mockResult);
    render(<AuditTab />);
    expect(screen.getByText("Less")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });

  it("disables Less button when limit is at minimum", () => {
    mockUseQuery.mockReturnValue(mockResult);
    render(<AuditTab />);
    const lessButton = screen.getByText("Less").closest("button");
    expect(lessButton).toBeDisabled();
  });

  it("shows entry count", () => {
    mockUseQuery.mockReturnValue(mockResult);
    render(<AuditTab />);
    expect(screen.getByText(/Showing 2 of 2 entries/)).toBeInTheDocument();
  });

  it("renders JSON details in expandable format", () => {
    const resultWithJson = {
      logs: [mockLogs[0]],
      totalCount: 1,
    };
    mockUseQuery.mockReturnValue(resultWithJson);
    render(<AuditTab />);
    expect(screen.getByText("View Payload")).toBeInTheDocument();
  });

  it("shows dash for null details", () => {
    mockUseQuery.mockReturnValue(mockResult);
    render(<AuditTab />);
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("formats invalid json details directly", () => {
    const invalidJsonLog = {
      ...mockLogs[0],
      details: "Invalid JSON string",
    };
    mockUseQuery.mockReturnValue({ logs: [invalidJsonLog], totalCount: 1 });
    render(<AuditTab />);
    expect(screen.getByText("Invalid JSON string")).toBeInTheDocument();
  });

  it("handles pagination clicks", () => {
    mockUseQuery.mockReturnValue({ logs: mockLogs, totalCount: 100 });
    render(<AuditTab />);

    const moreButton = screen.getByText("More");
    fireEvent.click(moreButton);

    // Limit increases to 100
    expect(mockUseQuery).toHaveBeenCalledWith(expect.anything(), {
      limit: 100,
    });

    const lessButton = screen.getByText("Less");
    expect(lessButton).not.toBeDisabled();

    fireEvent.click(lessButton);
    // Limit goes back to 50
    expect(mockUseQuery).toHaveBeenCalledWith(expect.anything(), { limit: 50 });
  });
});
