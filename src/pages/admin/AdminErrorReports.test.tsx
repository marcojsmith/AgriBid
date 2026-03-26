import { render, screen, fireEvent } from "@testing-library/react";
import { useQuery } from "convex/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AdminErrorReports from "./AdminErrorReports";

const mockReports = {
  reports: [
    {
      _id: "report_1",
      _creationTime: Date.now() - 10000,
      fingerprint: "test_print",
      status: "pending",
      errorType: "TypeError",
      errorMessage: "Test error 1",
      instanceCount: 1,
      lastOccurredAt: Date.now(),
      githubIssueUrl: undefined,
    },
  ],
};

const mockStats = {
  pending: 1,
  processing: 0,
  completed: 5,
  failed: 0,
  total: 6,
};

let mockQueryDataStats: unknown = undefined;
let mockQueryDataReports: unknown = undefined;

vi.mock("convex/react", () => ({
  useQuery: vi.fn((queryInfo) => {
    if (queryInfo === "mockStats") return mockQueryDataStats;
    if (queryInfo === "mockReports") return mockQueryDataReports;
    return undefined;
  }),
}));

vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-layout">{children}</div>
  ),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getErrorReportStats: "mockStats",
      getErrorReports: "mockReports",
    },
  },
}));

describe("AdminErrorReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryDataStats = undefined;
    mockQueryDataReports = undefined;
  });

  it("renders loading state initially", () => {
    render(<AdminErrorReports />);
    expect(screen.getByTestId("admin-layout")).toBeInTheDocument();
    expect(
      document.querySelector(".animate-spin") || screen.getByRole("status")
    ).toBeInTheDocument();
  });

  it("renders reports and stats when data is loaded", () => {
    mockQueryDataStats = mockStats;
    mockQueryDataReports = mockReports;
    render(<AdminErrorReports />);

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument(); // total count
    expect(screen.getByText("TypeError")).toBeInTheDocument();
    expect(screen.getByText("Test error 1")).toBeInTheDocument();

    // Check for the "Pending" stat card text specifically
    const pendingStat = screen
      .getByText("1")
      .closest("div")
      ?.querySelector(".text-xs");
    expect(pendingStat?.textContent).toBe("Pending");
  });

  it("filters reports by status when a filter button is clicked", () => {
    mockQueryDataStats = mockStats;
    mockQueryDataReports = mockReports;
    render(<AdminErrorReports />);

    const completedFilter = screen.getByRole("button", { name: /Completed/i });
    fireEvent.click(completedFilter);

    // useQuery should have been called with status filter
    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      "mockReports",
      expect.objectContaining({ status: "completed" })
    );
  });

  it("resets filter when 'All' is clicked", () => {
    mockQueryDataStats = mockStats;
    mockQueryDataReports = mockReports;
    render(<AdminErrorReports />);

    const allFilter = screen.getByRole("button", { name: "All" });
    fireEvent.click(allFilter);

    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      "mockReports",
      expect.objectContaining({ status: undefined })
    );
  });

  it("renders reports with GitHub links correctly", () => {
    mockQueryDataStats = mockStats;
    mockQueryDataReports = {
      reports: [
        {
          ...mockReports.reports[0],
          status: "completed",
          githubIssueUrl: "https://github.com/issue/1",
          githubIssueNumber: 1,
        },
      ],
    };
    render(<AdminErrorReports />);

    const link = screen.getByRole("link", { name: /#1/i });
    expect(link).toHaveAttribute("href", "https://github.com/issue/1");
  });

  it("renders multiple instances count badge", () => {
    mockQueryDataStats = mockStats;
    mockQueryDataReports = {
      reports: [
        {
          ...mockReports.reports[0],
          instanceCount: 42,
        },
      ],
    };
    render(<AdminErrorReports />);

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    mockQueryDataStats = mockStats;
    mockQueryDataReports = { reports: [] };
    render(<AdminErrorReports />);

    expect(screen.getByText("No error reports found")).toBeInTheDocument();
  });
});
