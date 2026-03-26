import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { FinanceTab } from "./FinanceTab";

const mockStats = {
  totalSalesVolume: 1500000,
  estimatedCommission: 75000,
  commissionRate: 0.05,
  auctionCount: 150,
  recentSales: {
    page: [
      {
        id: "sale-1",
        date: 1705312800000,
        title: "John Deere 8R Tractor",
        amount: 250000,
        estimatedCommission: 12500,
      },
      {
        id: "sale-2",
        date: 1705226400000,
        title: "Case IH Combine",
        amount: 180000,
        estimatedCommission: 9000,
      },
    ],
    isDone: true,
    continueCursor: "",
    totalCount: 2,
    pageStatus: null,
    splitCursor: null,
  },
};

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
}));

describe("FinanceTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<FinanceTab />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders stat cards with data", () => {
    mockUseQuery.mockReturnValue(mockStats);
    render(<FinanceTab />);
    expect(screen.getByText("Total Sales Volume")).toBeInTheDocument();
    expect(screen.getByText("Est. Commission (5%)")).toBeInTheDocument();
    expect(screen.getByText("Auctions Settled")).toBeInTheDocument();
  });

  it("displays sales volume formatted", () => {
    mockUseQuery.mockReturnValue(mockStats);
    render(<FinanceTab />);
    expect(screen.getByText(/R[,\s\u00A0]*1[,\s\u00A0]*500[,\s\u00A0]*000/)).toBeInTheDocument();
  });

  it("displays commission formatted", () => {
    mockUseQuery.mockReturnValue(mockStats);
    render(<FinanceTab />);
    expect(screen.getByText(/R[,\s\u00A0]*75[,\s\u00A0]*000/)).toBeInTheDocument();
  });

  it("displays auction count", () => {
    mockUseQuery.mockReturnValue(mockStats);
    render(<FinanceTab />);
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("renders recent transactions table", () => {
    mockUseQuery.mockReturnValue(mockStats);
    render(<FinanceTab />);
    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
    expect(screen.getByText("John Deere 8R Tractor")).toBeInTheDocument();
    expect(screen.getByText("Case IH Combine")).toBeInTheDocument();
  });

  it("displays sale amounts formatted", () => {
    mockUseQuery.mockReturnValue(mockStats);
    render(<FinanceTab />);
    expect(screen.getByText(/R[,\s\u00A0]*250[,\s\u00A0]*000/)).toBeInTheDocument();
    expect(screen.getByText(/R[,\s\u00A0]*180[,\s\u00A0]*000/)).toBeInTheDocument();
  });

  it("renders empty state when no recent sales", () => {
    const emptyStats = {
      ...mockStats,
      recentSales: {
        page: [],
        isDone: true,
        continueCursor: "",
        totalCount: 0,
        pageStatus: null,
        splitCursor: null,
      },
    };
    mockUseQuery.mockReturnValue(emptyStats);
    render(<FinanceTab />);
    expect(screen.getByText("No recent transactions")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    mockUseQuery.mockReturnValue(mockStats);
    render(<FinanceTab />);
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Auction Title")).toBeInTheDocument();
    expect(screen.getByText("Sale Amount")).toBeInTheDocument();
    expect(screen.getByText("Commission")).toBeInTheDocument();
  });
});