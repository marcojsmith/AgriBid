import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

// Mock RegisterSW to avoid virtual:pwa-register/react resolution in tests
vi.mock("./components/RegisterSW", () => ({
  RegisterSW: () => null,
}));

// Mock Layout to avoid sidebar/header complexity
vi.mock("./components/Layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

// Mock Protected Route to just render children for route testing
vi.mock("./components/RoleProtectedRoute", () => ({
  RoleProtectedRoute: ({ children }: { children: ReactNode }) => (
    <div data-testid="protected">{children}</div>
  ),
}));

// Mock the pages
const mockPage = (name: string) => ({
  default: () => <div data-testid={`${name}-page`}>{name} Page</div>,
});

vi.mock("./pages/Home", () => mockPage("home"));
vi.mock("./pages/AuctionDetail", () => mockPage("detail"));
vi.mock("./pages/Sell", () => mockPage("sell"));
vi.mock("./pages/Login", () => mockPage("login"));
vi.mock("./pages/Watchlist", () => mockPage("watchlist"));
vi.mock("./pages/admin/AdminDashboard", () => mockPage("admin-dashboard"));
vi.mock("./pages/admin/AdminModeration", () => mockPage("admin-moderation"));
vi.mock("./pages/admin/AdminAuctions", () => mockPage("admin-auctions"));
vi.mock("./pages/admin/AdminUsers", () => mockPage("admin-users"));
vi.mock("./pages/admin/AdminFinance", () => mockPage("admin-finance"));
vi.mock("./pages/admin/AdminAnnouncements", () =>
  mockPage("admin-announcements")
);
vi.mock("./pages/admin/AdminSupport", () => mockPage("admin-support"));
vi.mock("./pages/admin/AdminAudit", () => mockPage("admin-audit"));
vi.mock("./pages/admin/AdminEquipmentCatalog", () => mockPage("admin-catalog"));
vi.mock("./pages/admin/AdminSettings", () => mockPage("admin-settings"));
vi.mock("./pages/admin/AdminErrorReports", () =>
  mockPage("admin-error-reports")
);
vi.mock("./pages/admin/AdminErrorReportingSettings", () =>
  mockPage("admin-error-reporting-settings")
);
vi.mock("./pages/Profile", () => mockPage("profile"));
vi.mock("./pages/dashboard/MyBids", () => mockPage("my-bids"));
vi.mock("./pages/dashboard/MyListings", () => mockPage("my-listings"));
vi.mock("./pages/KYC", () => mockPage("kyc"));
vi.mock("./pages/Support", () => mockPage("support"));
vi.mock("./pages/Notifications", () => mockPage("notifications"));
vi.mock("./pages/admin/AdminMarketplace", () => mockPage("admin-marketplace"));
vi.mock("./pages/admin/AdminFees", () => mockPage("admin-fees"));

// Mock App without its own BrowserRouter so we can control it with MemoryRouter
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  usePaginatedQuery: vi.fn(() => ({ results: [], status: "Exhausted" })),
  useMutation: () => vi.fn(),
}));

import App from "./App";

describe("App Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderApp = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    );

  it("renders Home page for /", async () => {
    renderApp("/");
    expect(await screen.findByTestId("home-page")).toBeInTheDocument();
  });

  it("renders Login page for /login", async () => {
    renderApp("/login");
    expect(await screen.findByTestId("login-page")).toBeInTheDocument();
  });

  it("renders AuctionDetail page for /auction/:id", async () => {
    renderApp("/auction/123");
    expect(await screen.findByTestId("detail-page")).toBeInTheDocument();
  });

  it("renders Sell page for /sell", async () => {
    renderApp("/sell");
    expect(await screen.findByTestId("sell-page")).toBeInTheDocument();
  });

  it("renders Watchlist page for /watchlist", async () => {
    renderApp("/watchlist");
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
    expect(await screen.findByTestId("watchlist-page")).toBeInTheDocument();
  });

  it("renders MyBids page for /dashboard/bids", async () => {
    renderApp("/dashboard/bids");
    expect(await screen.findByTestId("my-bids-page")).toBeInTheDocument();
  });

  it("renders AdminDashboard for /admin", async () => {
    renderApp("/admin");
    expect(
      await screen.findByTestId("admin-dashboard-page")
    ).toBeInTheDocument();
  });

  it("renders AdminModeration for /admin/moderation", async () => {
    renderApp("/admin/moderation");
    expect(
      await screen.findByTestId("admin-moderation-page")
    ).toBeInTheDocument();
  });

  it("renders AdminAuctions for /admin/auctions", async () => {
    renderApp("/admin/auctions");
    expect(
      await screen.findByTestId("admin-auctions-page")
    ).toBeInTheDocument();
  });

  it("renders KYC page for /kyc", async () => {
    renderApp("/kyc");
    expect(await screen.findByTestId("kyc-page")).toBeInTheDocument();
  });

  it("renders Support page for /support", async () => {
    renderApp("/support");
    expect(await screen.findByTestId("support-page")).toBeInTheDocument();
  });

  it("renders Notifications page for /notifications", async () => {
    renderApp("/notifications");
    expect(await screen.findByTestId("notifications-page")).toBeInTheDocument();
  });

  it("renders AdminFinance for /admin/finance", async () => {
    renderApp("/admin/finance");
    expect(await screen.findByTestId("admin-finance-page")).toBeInTheDocument();
  });

  it("renders AdminAnnouncements for /admin/announcements", async () => {
    renderApp("/admin/announcements");
    expect(
      await screen.findByTestId("admin-announcements-page")
    ).toBeInTheDocument();
  });

  it("renders AdminSupport for /admin/support", async () => {
    renderApp("/admin/support");
    expect(await screen.findByTestId("admin-support-page")).toBeInTheDocument();
  });

  it("renders AdminAudit for /admin/audit", async () => {
    renderApp("/admin/audit");
    expect(await screen.findByTestId("admin-audit-page")).toBeInTheDocument();
  });

  it("renders AdminEquipmentCatalog for /admin/equipment-catalog", async () => {
    renderApp("/admin/equipment-catalog");
    expect(await screen.findByTestId("admin-catalog-page")).toBeInTheDocument();
  });

  it("renders AdminSettings for /admin/settings", async () => {
    renderApp("/admin/settings");
    expect(
      await screen.findByTestId("admin-settings-page")
    ).toBeInTheDocument();
  });

  it("renders AdminErrorReports for /admin/error-reports", async () => {
    renderApp("/admin/error-reports");
    expect(
      await screen.findByTestId("admin-error-reports-page")
    ).toBeInTheDocument();
  });

  it("renders AdminErrorReportingSettings for /admin/error-reporting", async () => {
    renderApp("/admin/error-reporting");
    expect(
      await screen.findByTestId("admin-error-reporting-settings-page")
    ).toBeInTheDocument();
  });

  it("renders MyListings for /dashboard/listings", async () => {
    renderApp("/dashboard/listings");
    expect(await screen.findByTestId("my-listings-page")).toBeInTheDocument();
  });

  it("renders AdminMarketplace for /admin/marketplace", async () => {
    renderApp("/admin/marketplace");
    expect(
      await screen.findByTestId("admin-marketplace-page")
    ).toBeInTheDocument();
  });

  it("renders AdminFees for /admin/fees", async () => {
    renderApp("/admin/fees");
    expect(await screen.findByTestId("admin-fees-page")).toBeInTheDocument();
  });
});
