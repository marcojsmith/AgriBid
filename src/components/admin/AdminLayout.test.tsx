import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";

import { AdminLayout } from "./AdminLayout";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

const { mockLocationRef, mockUseAdminStats } = vi.hoisted(() => {
  return {
    mockLocationRef: {
      current: { pathname: "/admin", search: "", hash: "", state: null },
    },
    mockUseAdminStats: vi.fn(),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useLocation: () => mockLocationRef.current,
  };
});

vi.mock("@/hooks/useAdminStats", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useAdminStats")>();
  return {
    ...actual,
    useAdminStats: mockUseAdminStats,
  };
});

const mockStats = {
  totalAuctions: 150,
  activeAuctions: 45,
  pendingReview: 5,
  totalUsers: 1000,
  verifiedSellers: 200,
  kycPending: 20,
  status: "healthy" as const,
  liveUsers: 25,
  activeWatch: 10,
};

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationRef.current = {
      pathname: "/admin",
      search: "",
      hash: "",
      state: null,
    };
    mockUseAdminStats.mockReturnValue(mockStats);
  });

  it("renders default title and subtitle", () => {
    renderWithRouter(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    expect(
      screen.getByText("Global Marketplace Oversight")
    ).toBeInTheDocument();
  });

  it("renders custom title and subtitle", () => {
    renderWithRouter(
      <AdminLayout title="Custom Title" subtitle="Custom Subtitle">
        <div>Test Content</div>
      </AdminLayout>
    );
    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("Custom Subtitle")).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderWithRouter(
      <AdminLayout>
        <div data-testid="children">Test Content</div>
      </AdminLayout>
    );
    expect(screen.getByTestId("children")).toBeInTheDocument();
  });

  it("renders sidebar navigation links", () => {
    renderWithRouter(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );
    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
  });

  it("renders stat cards when stats are provided", () => {
    mockUseAdminStats.mockReturnValue(mockStats);
    renderWithRouter(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );
    const statLabels = screen.getAllByText("Live Users");
    expect(statLabels.length).toBeGreaterThan(0);
  });

  it("does not render stat cards when stats are null", () => {
    mockUseAdminStats.mockReturnValue(null);
    renderWithRouter(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );
    expect(screen.queryByText("Live Users")).not.toBeInTheDocument();
  });

  it("does not render stat cards when stats are undefined", () => {
    mockUseAdminStats.mockReturnValue(undefined);
    renderWithRouter(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );
    expect(screen.queryByText("Live Users")).not.toBeInTheDocument();
  });

  it("renders Announce button when onAnnounce callback is provided", () => {
    const onAnnounce = vi.fn();
    renderWithRouter(
      <AdminLayout onAnnounce={onAnnounce}>
        <div>Test Content</div>
      </AdminLayout>
    );
    expect(screen.getByText("Announce")).toBeInTheDocument();
  });

  it("does not render Announce button when onAnnounce is not provided", () => {
    renderWithRouter(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );
    expect(screen.queryByText("Announce")).not.toBeInTheDocument();
  });

  it("highlights active navigation item based on current path", () => {
    mockLocationRef.current = {
      pathname: "/admin/users",
      search: "",
      hash: "",
      state: null,
    };
    renderWithRouter(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );
    const links = screen.getAllByRole("link");
    const usersLink = links.find(
      (link) => link.getAttribute("href") === "/admin/users"
    );
    expect(usersLink).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("highlights Dashboard when at /admin/dashboard", () => {
    mockLocationRef.current = {
      pathname: "/admin/dashboard",
      search: "",
      hash: "",
      state: null,
    };
    renderWithRouter(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );
    const links = screen.getAllByRole("link");
    const dashboardLink = links.find(
      (link) => link.getAttribute("href") === "/admin"
    );
    expect(dashboardLink).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("renders Management header in sidebar", () => {
    renderWithRouter(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );
    expect(screen.getByText("Management")).toBeInTheDocument();
  });
});
