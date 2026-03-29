import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const { mockUseQuery } = vi.hoisted(() => ({ mockUseQuery: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: mockUseQuery }));
vi.mock("convex/_generated/api", () => ({
  api: { admin: { getFeeStats: "admin:getFeeStats" } },
}));
vi.mock("@/components/admin/FeeManager", () => ({
  FeeManager: () => <div data-testid="fee-manager" />,
}));
vi.mock("lucide-react", () => ({
  DollarSign: () => <span />,
  Users: () => <span />,
  Building2: () => <span />,
  LayoutDashboard: () => <span />,
  ShieldCheck: () => <span />,
  Hammer: () => <span />,
  Gavel: () => <span />,
  TrendingUp: () => <span />,
  Search: () => <span />,
  HelpCircle: () => <span />,
  FileText: () => <span />,
  Settings: () => <span />,
  MessageSquare: () => <span />,
  Bug: () => <span />,
  Megaphone: () => <span />,
  LayoutGrid: () => <span />,
  Clock: () => <span />,
  Activity: () => <span />,
}));

import AdminFees from "./AdminFees";

describe("AdminFees Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () => {
    return render(
      <MemoryRouter>
        <AdminFees />
      </MemoryRouter>
    );
  };

  it("shows loading state when feeStats is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderPage();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders all three stat cards when loaded", () => {
    mockUseQuery.mockReturnValue({
      totalFeesCollected: 50000,
      buyerFeesTotal: 30000,
      sellerFeesTotal: 20000,
      feeBreakdown: [],
    });
    renderPage();
    expect(screen.getByText("Total Fees Collected")).toBeInTheDocument();
    expect(screen.getByText("Buyer Fees")).toBeInTheDocument();
    expect(screen.getByText("Seller Fees")).toBeInTheDocument();
  });

  it("renders FeeManager component", () => {
    mockUseQuery.mockReturnValue({
      totalFeesCollected: 50000,
      buyerFeesTotal: 30000,
      sellerFeesTotal: 20000,
      feeBreakdown: [],
    });
    renderPage();
    expect(screen.getByTestId("fee-manager")).toBeInTheDocument();
  });

  it("formats currency values with thousand separators and two decimal places", () => {
    mockUseQuery.mockReturnValue({
      totalFeesCollected: 50000,
      buyerFeesTotal: 30000,
      sellerFeesTotal: 20000,
      feeBreakdown: [],
    });
    renderPage();
    expect(screen.getByText("R 50 000,00")).toBeInTheDocument();
    expect(screen.getByText("R 30 000,00")).toBeInTheDocument();
    expect(screen.getByText("R 20 000,00")).toBeInTheDocument();
  });

  it("displays zero values correctly as R 0,00", () => {
    mockUseQuery.mockReturnValue({
      totalFeesCollected: 0,
      buyerFeesTotal: 0,
      sellerFeesTotal: 0,
      feeBreakdown: [],
    });
    renderPage();
    expect(screen.getAllByText("R 0,00")).toHaveLength(3);
  });

  it("formats large numbers with proper thousand separators", () => {
    mockUseQuery.mockReturnValue({
      totalFeesCollected: 1234567.89,
      buyerFeesTotal: 800000,
      sellerFeesTotal: 434567.89,
      feeBreakdown: [],
    });
    renderPage();
    expect(screen.getByText("R 1 234 567,89")).toBeInTheDocument();
    expect(screen.getByText("R 800 000,00")).toBeInTheDocument();
    expect(screen.getByText("R 434 567,89")).toBeInTheDocument();
  });
});
