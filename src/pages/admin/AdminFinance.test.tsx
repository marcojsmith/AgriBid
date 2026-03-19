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
    commissionRate: 0.05,
    estimatedCommission: 25000,
    auctionCount: 42,
    recentSales: {
      page: [
        {
          id: "1",
          date: 1742000000000,
          title: "Tractor X1000",
          amount: 100000,
          estimatedCommission: 5000,
        },
        {
          id: "2",
          date: 1741900000000,
          title: "Combine Harvester",
          amount: 200000,
          estimatedCommission: 10000,
        },
      ],
      isDone: true,
      continueCursor: "",
      totalCount: 2,
      pageStatus: null,
      splitCursor: null,
    },
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
    expect(screen.getByText("Live Users")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getAllByText("100")).toHaveLength(1); // One in header "Users" card

    // Verify Finance Metrics (from FinanceTab)
    expect(screen.getByText("Total Sales Volume")).toBeInTheDocument();
    expect(screen.getByText("R 500,000")).toBeInTheDocument();

    expect(screen.getByText("Est. Commission (5%)")).toBeInTheDocument();
    expect(screen.getByText("R 25,000")).toBeInTheDocument();

    expect(screen.getByText("Auctions Settled")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();

    // Verify Recent Transactions Table
    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
    expect(screen.getByText("Tractor X1000")).toBeInTheDocument();
    expect(screen.getByText("R 100,000")).toBeInTheDocument();
    expect(screen.getByText("R 5,000")).toBeInTheDocument();

    expect(screen.getByText("Combine Harvester")).toBeInTheDocument();
    expect(screen.getByText("R 200,000")).toBeInTheDocument();
    expect(screen.getByText("R 10,000")).toBeInTheDocument();
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
});
