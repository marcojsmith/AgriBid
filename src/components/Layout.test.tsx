import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import * as convexReact from "convex/react";

import { useSession } from "@/lib/auth-client";
import { useBranding } from "@/hooks/useBranding";
import { SITE_NAME } from "@/lib/seo";

import { Layout } from "./Layout";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    admin: {
      getBusinessInfo: { name: "admin:getBusinessInfo" },
      getSeoSettings: { name: "admin:getSeoSettings" },
    },
    users: {
      syncUser: { name: "users:syncUser" },
    },
    auctions: {
      getMyBids: { name: "auctions:getMyBids" },
    },
    watchlist: {
      getWatchedAuctions: { name: "watchlist:getWatchedAuctions" },
    },
    presence: {
      getUserPresence: { name: "presence:getUserPresence" },
      updatePresence: { name: "presence:updatePresence" },
      heartbeat: { name: "presence:heartbeat" },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({ api: mockApi }));

function typedMutationMock<T>(_val: unknown): T {
  return _val as T;
}

vi.mock("./header/Header", () => ({
  Header: () => <header data-testid="mock-header">Header</header>,
}));

vi.mock("./Footer", () => ({
  Footer: () => <footer data-testid="mock-footer">Footer</footer>,
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => {
    // Default return; individual tests override via mockUseQuery
    return undefined;
  }),
  useMutation: vi.fn(),
  Authenticated: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Unauthenticated: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/hooks/useBranding", () => ({
  useBranding: vi.fn(() => ({ appName: "AgriBid" })),
}));

vi.mock("@/contexts/BrandingProvider", () => ({
  BrandingProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe("Layout", () => {
  const mockUseQuery = convexReact.useQuery as ReturnType<typeof vi.fn>;
  const mockUseMutation = convexReact.useMutation as ReturnType<typeof vi.fn>;
  const mockUseSession = useSession as ReturnType<typeof vi.fn>;
  const mockUseBranding = useBranding as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof useSession>);
    mockUseMutation.mockReturnValue(
      typedMutationMock<ReturnType<typeof convexReact.useMutation>>(
        vi.fn().mockResolvedValue({})
      )
    );
  });

  it("renders children and includes Header and Footer", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(
      <BrowserRouter>
        <Layout>
          <div data-testid="child-content">Child Content</div>
        </Layout>
      </BrowserRouter>
    );

    expect(screen.getByTestId("mock-header")).toBeInTheDocument();
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("handles syncUser failure", async () => {
    const mockSyncUser = vi.fn().mockRejectedValue(new Error("Sync Fail"));
    mockUseSession.mockReturnValue(
      typedMutationMock<ReturnType<typeof useSession>>({
        data: { user: { id: "user1" } },
        isPending: false,
      })
    );
    mockUseMutation.mockReturnValue(
      typedMutationMock<ReturnType<typeof convexReact.useMutation>>(
        mockSyncUser
      )
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockUseQuery.mockReturnValue(undefined);
    render(
      <BrowserRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockSyncUser).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to sync user:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it("renders JSON-LD schema when businessInfo has businessName", () => {
    mockUseQuery.mockImplementation((query) => {
      if (query === mockApi.admin.getBusinessInfo) {
        return {
          businessName: "AgriBid Test Farm",
          website: null,
          logoUrl: null,
          businessDescription: null,
          streetAddress: null,
          addressLocality: null,
          addressCountry: null,
          postalCode: null,
          telephone: null,
          email: null,
          sameAs: null,
        };
      }
      return undefined;
    });
    render(
      <BrowserRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </BrowserRouter>
    );
    expect(
      document.querySelector('script[type="application/ld+json"]')
    ).toBeTruthy();
  });

  it("renders SEO verification meta tags when seoSettings are provided", () => {
    mockUseQuery.mockImplementation((query) => {
      if (query === mockApi.admin.getSeoSettings) {
        return {
          searchConsoleVerification: "abc123verify",
          bingVerification: "bing456verify",
          ga4MeasurementId: "G-ABCDEF1234",
        };
      }
      return undefined;
    });
    render(
      <BrowserRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </BrowserRouter>
    );
    expect(
      document.querySelector('meta[name="google-site-verification"]')
    ).toBeTruthy();
    expect(document.querySelector('meta[name="msvalidate.01"]')).toBeTruthy();
  });

  it("uses SITE_NAME when appName is null", () => {
    mockUseBranding.mockReturnValue({ appName: null });
    mockUseQuery.mockReturnValue(undefined);
    render(
      <BrowserRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </BrowserRouter>
    );
    expect(
      document.querySelector('meta[property="og:site_name"]')
    ).toHaveAttribute("content", SITE_NAME);
  });
});
