import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("lucide-react", () => ({
  DollarSign: () => <div data-testid="dollar-sign" />,
  AlertCircle: () => <div data-testid="alert-circle" />,
  Users: () => <div data-testid="users" />,
  Building2: () => <div data-testid="building2" />,
  Calendar: () => <div data-testid="calendar" />,
}));

import { FinanceTab } from "./FinanceTab";

const mockStats = {
  totalSalesVolume: 1500000,
  estimatedCommission: 75000,
  commissionRate: 0.05,
  auctionCount: 150,
  totalFeesCollected: 50000,
  buyerFeesTotal: 30000,
  sellerFeesTotal: 20000,
  partialResults: false,
  recentSales: {
    page: [
      {
        id: "sale-1",
        date: 1705312800000,
        title: "John Deere 8R Tractor",
        amount: 250000,
        estimatedCommission: 12500,
        fees: [],
      },
      {
        id: "sale-2",
        date: 1705226400000,
        title: "Case IH Combine",
        amount: 180000,
        estimatedCommission: 9000,
        fees: [],
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
    expect(screen.getByText("Total Fees Collected")).toBeInTheDocument();
    expect(screen.getByText("Auctions Settled")).toBeInTheDocument();
  });

  it("displays sales volume formatted", () => {
    mockUseQuery.mockReturnValue(mockStats);
    render(<FinanceTab />);
    expect(
      screen.getByText(/R[,\s\u00A0]*1[,\s\u00A0]*500[,\s\u00A0]*000/)
    ).toBeInTheDocument();
  });

  it("displays fees collected formatted", () => {
    mockUseQuery.mockReturnValue(mockStats);
    render(<FinanceTab />);
    expect(
      screen.getByText(/R[,\s\u00A0]*50[,\s\u00A0]*000/)
    ).toBeInTheDocument();
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
    expect(
      screen.getByText(/R[,\s\u00A0]*250[,\s\u00A0]*000/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/R[,\s\u00A0]*180[,\s\u00A0]*000/)
    ).toBeInTheDocument();
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
    expect(screen.getByText("Fees")).toBeInTheDocument();
  });

  it("shows partial results warning when partialResults is true", () => {
    mockUseQuery.mockReturnValue({ ...mockStats, partialResults: true });
    render(<FinanceTab />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/Sales volume figures are calculated/)
    ).toBeInTheDocument();
  });

  it("renders Buyer Fees and Seller Fees stat cards", () => {
    mockUseQuery.mockReturnValue(mockStats);
    render(<FinanceTab />);
    expect(screen.getByText("Buyer Fees")).toBeInTheDocument();
    expect(screen.getByText("Seller Fees")).toBeInTheDocument();
  });

  it("displays fee breakdown inline when sale has fees", () => {
    const statsWithFees = {
      ...mockStats,
      recentSales: {
        ...mockStats.recentSales,
        page: [
          {
            id: "sale-3",
            date: Date.now(),
            title: "Test Tractor",
            amount: 100000,
            estimatedCommission: 5000,
            fees: [
              {
                feeName: "Seller Commission",
                appliedTo: "seller" as const,
                amount: 5000,
              },
            ],
          },
        ],
      },
    };
    mockUseQuery.mockReturnValue(statsWithFees);
    render(<FinanceTab />);
    expect(screen.getByText(/Seller Commission/)).toBeInTheDocument();
  });
});
