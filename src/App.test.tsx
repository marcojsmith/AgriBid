import { render, screen } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockInstance,
} from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

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
vi.mock("./pages/admin/AdminLots", () => mockPage("admin-lots"));
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
vi.mock("./pages/admin/AdminAuctionDetail", () =>
  mockPage("admin-auction-detail")
);
vi.mock("./pages/admin/AdminUsers", () => mockPage("admin-users"));
vi.mock("./pages/admin/AdminSEOSettings", () => mockPage("admin-seo"));
vi.mock("./pages/admin/AdminBusinessInfo", () =>
  mockPage("admin-business-info")
);
vi.mock("./pages/admin/AdminFAQ", () => mockPage("admin-faq"));
vi.mock("./pages/admin/AdminPerformance", () => mockPage("admin-performance"));
vi.mock("./pages/AuctionGallery", () => mockPage("auction-gallery"));
vi.mock("./pages/AuctionContainerDetail", () =>
  mockPage("auction-container-detail")
);
vi.mock("./pages/FAQ", () => mockPage("faq"));
vi.mock("./pages/SellerListings", () => mockPage("seller-listings"));
vi.mock("./pages/Messages", () => mockPage("messages"));
vi.mock("./pages/Settings", () => mockPage("settings"));
vi.mock("./pages/NotFound", () => mockPage("not-found"));

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

// Mock error reporter
vi.mock("./lib/error-reporter", () => ({
  reportErrorAsync: vi.fn(),
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

  it("renders AdminLots for /admin/lots", async () => {
    renderApp("/admin/lots");
    expect(await screen.findByTestId("admin-lots-page")).toBeInTheDocument();
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

  it("renders NotFound page for unknown routes", async () => {
    renderApp("/nonexistent-route");
    expect(await screen.findByTestId("not-found-page")).toBeInTheDocument();
  });

  it("renders NotFound page for deeply nested unknown routes", async () => {
    renderApp("/some/deeply/nested/unknown/path");
    expect(await screen.findByTestId("not-found-page")).toBeInTheDocument();
  });

  it("renders AdminAuctionDetail for /admin/auctions/:id", async () => {
    renderApp("/admin/auctions/abc123");
    expect(
      await screen.findByTestId("admin-auction-detail-page")
    ).toBeInTheDocument();
  });

  it("renders AdminUsers for /admin/users", async () => {
    renderApp("/admin/users");
    expect(await screen.findByTestId("admin-users-page")).toBeInTheDocument();
  });

  it("renders AdminSEOSettings for /admin/seo", async () => {
    renderApp("/admin/seo");
    expect(await screen.findByTestId("admin-seo-page")).toBeInTheDocument();
  });

  it("renders AdminBusinessInfo for /admin/business-info", async () => {
    renderApp("/admin/business-info");
    expect(
      await screen.findByTestId("admin-business-info-page")
    ).toBeInTheDocument();
  });

  it("renders AdminFAQ for /admin/faq", async () => {
    renderApp("/admin/faq");
    expect(await screen.findByTestId("admin-faq-page")).toBeInTheDocument();
  });

  it("renders AdminPerformance for /admin/performance", async () => {
    renderApp("/admin/performance");
    expect(
      await screen.findByTestId("admin-performance-page")
    ).toBeInTheDocument();
  });

  it("renders AdminDashboard for /admin/dashboard", async () => {
    renderApp("/admin/dashboard");
    expect(
      await screen.findByTestId("admin-dashboard-page")
    ).toBeInTheDocument();
  });

  it("renders AuctionGallery for /auctions", async () => {
    renderApp("/auctions");
    expect(
      await screen.findByTestId("auction-gallery-page")
    ).toBeInTheDocument();
  });

  it("renders AuctionContainerDetail for /auctions/:id", async () => {
    renderApp("/auctions/abc123");
    expect(
      await screen.findByTestId("auction-container-detail-page")
    ).toBeInTheDocument();
  });

  it("renders the public FAQ page for /faq", async () => {
    renderApp("/faq");
    expect(await screen.findByTestId("faq-page")).toBeInTheDocument();
  });

  it("renders Profile for /profile/:userId", async () => {
    renderApp("/profile/user123");
    expect(await screen.findByTestId("profile-page")).toBeInTheDocument();
  });

  it("renders SellerListings for /sellers/:userId/listings", async () => {
    renderApp("/sellers/user123/listings");
    expect(
      await screen.findByTestId("seller-listings-page")
    ).toBeInTheDocument();
  });

  it("renders SellerListings for /sellers/:userId/listings/sold", async () => {
    renderApp("/sellers/user123/listings/sold");
    expect(
      await screen.findByTestId("seller-listings-page")
    ).toBeInTheDocument();
  });

  it("renders the Messages inbox for /messages", async () => {
    renderApp("/messages");
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
    expect(await screen.findByTestId("messages-page")).toBeInTheDocument();
  });

  it("renders the Messages thread view for /messages/:conversationId", async () => {
    renderApp("/messages/conv123");
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
    expect(await screen.findByTestId("messages-page")).toBeInTheDocument();
  });

  it("renders Settings for /settings", async () => {
    renderApp("/settings");
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
    expect(await screen.findByTestId("settings-page")).toBeInTheDocument();
  });
});

describe("RouteErrorBoundary Integration", () => {
  let consoleErrorSpy: MockInstance<typeof console.error> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      return undefined;
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("keeps Layout visible when a wrapped route throws during render", () => {
    function ThrowingPage(): never {
      throw new Error("Page crashed");
    }

    function TestLayout({ children }: { children: ReactNode }) {
      return <div data-testid="test-layout">{children}</div>;
    }

    render(
      <MemoryRouter initialEntries={["/crash"]}>
        <TestLayout>
          <Routes>
            <Route
              path="/crash"
              element={
                <RouteErrorBoundary>
                  <ThrowingPage />
                </RouteErrorBoundary>
              }
            />
          </Routes>
        </TestLayout>
      </MemoryRouter>
    );

    expect(screen.getByTestId("test-layout")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /something went wrong/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });
});
