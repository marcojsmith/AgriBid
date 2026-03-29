import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import AdminFinance from "./AdminFinance";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    admin: {
      getAdminStats: "admin:getAdminStats",
      getFinancialStats: "admin:getFinancialStats",
    },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  DollarSign: () => <div data-testid="dollar-sign-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  LayoutDashboard: () => <div data-testid="dashboard-icon" />,
  Megaphone: () => <div data-testid="megaphone-icon" />,
  Gavel: () => <div data-testid="gavel-icon" />,
  Users: () => <div data-testid="users-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  ShieldCheck: () => <div data-testid="shield-check-icon" />,
  Hammer: () => <div data-testid="hammer-icon" />,
  LayoutGrid: () => <div data-testid="layout-grid-icon" />,
  MessageSquare: () => <div data-testid="message-square-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  Activity: () => <div data-testid="activity-icon" />,
  Bug: () => <div data-testid="bug-icon" />,
  Building2: () => <div data-testid="building2-icon" />,
}));

describe("AdminFinance Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdminStats = {
    totalUsers: 100,
    liveUsers: 10,
    pendingReview: 5,
  };

  const mockFinancialStats = {
    totalSalesVolume: 500000,
    auctionCount: 42,
    totalFeesCollected: 10000,
    buyerFeesTotal: 6000,
    sellerFeesTotal: 4000,
    recentSales: {
      page: [
        {
          id: "1",
          date: 1742000000000,
          title: "Tractor X1000",
          amount: 100000,
          fees: [],
        },
        {
          id: "2",
          date: 1741900000000,
          title: "Combine Harvester",
          amount: 200000,
          fees: [],
        },
      ],
      isDone: true,
      continueCursor: "",
      totalCount: 2,
      pageStatus: null,
      splitCursor: null,
    },
    partialResults: false,
  };

  const renderPage = () => {
    return render(
      <BrowserRouter>
        <AdminFinance />
      </BrowserRouter>
    );
  };

  it("renders loading state when initial stats are fetching", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderPage();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Financial Oversight")).toBeInTheDocument();
  });

  it("renders layout and finance content when data is loaded", () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (queryApi === api.admin.getAdminStats) return mockAdminStats;
      if (queryApi === api.admin.getFinancialStats) return mockFinancialStats;
      return undefined;
    });

    renderPage();

    // Verify Title & Subtitle (from AdminFinance and AdminLayout)
    expect(screen.getByText("Financial Oversight")).toBeInTheDocument();
    expect(
      screen.getByText("Revenue, Commissions & Transaction History")
    ).toBeInTheDocument();

    // Verify Header Stats (from AdminLayout context usage)
    expect(screen.getByText("Online Users")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getAllByText("100")).toHaveLength(1); // One in header "Users" card

    // Verify Finance Metrics (from FinanceTab)
    expect(screen.getByText("Total Sales Volume")).toBeInTheDocument();
    expect(screen.getByText(/R\s*500\s*000/)).toBeInTheDocument();

    expect(screen.getByText("Total Fees Collected")).toBeInTheDocument();
    expect(screen.getByText(/R\s*10\s*000/)).toBeInTheDocument();

    expect(screen.getByText("Buyer Fees")).toBeInTheDocument();
    expect(screen.getByText("Seller Fees")).toBeInTheDocument();

    expect(screen.getByText("Auctions Settled")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();

    // Verify Recent Transactions Table
    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
    expect(screen.getByText("Tractor X1000")).toBeInTheDocument();
    expect(screen.getByText(/R\s*100\s*000/)).toBeInTheDocument();

    expect(screen.getByText("Combine Harvester")).toBeInTheDocument();
    expect(screen.getByText(/R\s*200\s*000/)).toBeInTheDocument();
  });

  it("renders empty state in transactions table when no sales exist", () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (queryApi === api.admin.getAdminStats) return mockAdminStats;
      if (queryApi === api.admin.getFinancialStats) {
        return {
          ...mockFinancialStats,
          recentSales: {
            page: [],
            isDone: true,
            continueCursor: "",
            totalCount: 0,
            pageStatus: null,
            splitCursor: null,
          },
        };
      }
      return undefined;
    });

    renderPage();

    expect(screen.getByText("No recent transactions")).toBeInTheDocument();
  });

  it("shows loading indicator inside FinanceTab when financial stats are fetching but admin stats are loaded", () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (queryApi === api.admin.getAdminStats) return mockAdminStats;
      if (queryApi === api.admin.getFinancialStats) return undefined;
      return undefined;
    });

    renderPage();

    // Header should be visible
    expect(screen.getByText("Financial Oversight")).toBeInTheDocument();
    // FinanceTab should be loading
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders partial results warning banner when partialResults is true", () => {
    (useQuery as Mock).mockImplementation((queryApi) => {
      if (queryApi === api.admin.getAdminStats) return mockAdminStats;
      if (queryApi === api.admin.getFinancialStats) {
        return {
          ...mockFinancialStats,
          partialResults: true,
        };
      }
      return undefined;
    });

    renderPage();

    expect(
      screen.getByText(
        /Sales volume figures are calculated from live data and may be incomplete/i
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
