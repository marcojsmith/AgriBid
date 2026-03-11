import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery } from "convex/react";

import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";

import AdminDashboard from "./AdminDashboard";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

// Mock Convex API
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    admin: {
      getAdminStats: { name: "admin:getAdminStats" },
      getFinancialStats: { name: "admin:getFinancialStats" },
      getAnnouncementStats: { name: "admin:getAnnouncementStats" },
      getSupportStats: { name: "admin:getSupportStats" },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

// Mock useLoadingTimeout
vi.mock("@/hooks/useLoadingTimeout", () => ({
  useLoadingTimeout: vi.fn(),
}));

// Mock AdminLayout to keep it simple
vi.mock("@/components/admin", () => ({
  AdminLayout: ({
    children,
    title,
    subtitle,
  }: {
    children: React.ReactNode;
    title: string;
    subtitle: string;
  }) => (
    <div data-testid="admin-layout">
      <h1>{title}</h1>
      <h2>{subtitle}</h2>
      {children}
    </div>
  ),
  AdminConnectionError: ({
    title,
    description,
  }: {
    title: string;
    description: string;
  }) => (
    <div data-testid="admin-connection-error">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

// Mock SummaryCard
vi.mock("@/components/admin/SummaryCard", () => ({
  SummaryCard: ({
    title,
    stats,
    link,
    linkLabel,
  }: {
    title: string;
    stats: { label: string; value: string | number }[];
    link: string;
    linkLabel: string;
  }) => (
    <div data-testid="summary-card">
      <h4>{title}</h4>
      <ul>
        {stats.map(
          (stat: { label: string; value: string | number }, i: number) => (
            <li key={i}>
              {stat.label}: {stat.value}
            </li>
          )
        )}
      </ul>
      <a href={link}>{linkLabel}</a>
    </div>
  ),
}));

describe("AdminDashboard Page", () => {
  const mockAdminStats = {
    status: "full",
    liveUsers: 10,
    totalUsers: 100,
    verifiedSellers: 50,
    activeAuctions: 20,
    activeWatch: 15,
    totalAuctions: 200,
    pendingReview: 5,
    kycPending: 3,
  };

  const mockFinancialStats = {
    totalSalesVolume: 1000000,
    estimatedCommission: 100000,
  };

  const mockAnnouncementStats = {
    total: 15,
    recent: 2,
  };

  const mockSupportStats = {
    open: 4,
    resolved: 120,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useLoadingTimeout as Mock).mockReturnValue(false);
  });

  const renderAdminDashboard = () => {
    return render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );
  };

  it("renders loading state", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderAdminDashboard();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders dashboard content when data is loaded", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.admin.getAdminStats) return mockAdminStats;
      if (apiPath === mockApi.admin.getFinancialStats)
        return mockFinancialStats;
      if (apiPath === mockApi.admin.getAnnouncementStats)
        return mockAnnouncementStats;
      if (apiPath === mockApi.admin.getSupportStats) return mockSupportStats;
      return null;
    });

    renderAdminDashboard();

    expect(screen.getByText("Admin Overview")).toBeInTheDocument();

    // Check for summary cards
    expect(screen.getByText("User Base")).toBeInTheDocument();
    expect(screen.getByText("Auctions")).toBeInTheDocument();
    expect(screen.getByText("Moderation")).toBeInTheDocument();
    expect(screen.getByText("Financials")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
  });

  it("renders partial data warning", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.admin.getAdminStats)
        return { ...mockAdminStats, status: "partial" };
      if (apiPath === mockApi.admin.getFinancialStats)
        return mockFinancialStats;
      if (apiPath === mockApi.admin.getAnnouncementStats)
        return mockAnnouncementStats;
      if (apiPath === mockApi.admin.getSupportStats) return mockSupportStats;
      return null;
    });

    renderAdminDashboard();
    expect(
      screen.getByText(/Some statistics are currently partial or cached/i)
    ).toBeInTheDocument();
  });

  it("renders error state when data fails to load", () => {
    (useQuery as Mock).mockImplementation(() => null);
    renderAdminDashboard();
    expect(screen.getByTestId("admin-connection-error")).toBeInTheDocument();
    expect(screen.getByText("Data Retrieval Error")).toBeInTheDocument();
  });

  it("renders timeout state when loading takes too long", () => {
    (useLoadingTimeout as Mock).mockReturnValue(true);
    (useQuery as Mock).mockReturnValue(undefined);
    renderAdminDashboard();
    expect(screen.getByText("Dashboard Timeout")).toBeInTheDocument();
  });
});
