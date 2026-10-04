import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import * as convexReact from "convex/react";
import { useAuth, useUser } from "@clerk/clerk-react";

import { useBranding } from "@/hooks/useBranding";

import { Layout } from "./Layout";

vi.mock("./header/Header", () => ({
  Header: () => <header data-testid="mock-header">Header</header>,
}));

vi.mock("./Footer", () => ({
  Footer: () => <footer data-testid="mock-footer">Footer</footer>,
}));

vi.mock("./NotificationListener", () => ({
  NotificationListener: () => <div data-testid="mock-notification-listener" />,
}));

vi.mock("./PresenceListener", () => ({
  PresenceListener: () => <div data-testid="mock-presence-listener" />,
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

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(),
  useUser: vi.fn(),
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
  const mockUseAuth = useAuth as Mock;
  const mockUseUser = useUser as Mock;
  const mockUseBranding = useBranding as Mock;

  /**
   * Layout queries the SEO settings first and the business info second; the
   * user profile provider issues a third (unused) query for the profile.
   *
   * @param seoSettings - Value returned for `admin.getSeoSettings`
   * @param businessInfo - Value returned for `admin.getBusinessInfo`
   */
  const mockSeoQueries = (seoSettings: unknown, businessInfo: unknown) => {
    const responses = [seoSettings, businessInfo];
    mockUseQuery.mockImplementation(() => responses.shift());
  };

  /**
   * Renders the layout inside the providers the app supplies at runtime.
   *
   * @param path - Route to render (decides admin chrome)
   * @returns Nothing
   */
  const renderLayout = (path: string) => {
    window.history.pushState({}, "", path);
    return render(
      <HelmetProvider>
        <BrowserRouter>
          <Layout>
            <div data-testid="child-content">Child Content</div>
          </Layout>
        </BrowserRouter>
      </HelmetProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
    // Helmet writes into the shared document head; clear it so assertions only
    // see the tags produced by the current render.
    document.head.innerHTML = "";
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true });
    mockUseUser.mockReturnValue({ user: undefined });
    mockUseBranding.mockReturnValue({ appName: "AgriBid" });
    mockUseQuery.mockReturnValue(undefined);
    mockUseMutation.mockReturnValue(
      vi.fn().mockResolvedValue({}) as unknown as ReturnType<
        typeof convexReact.useMutation
      >
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
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    mockUseUser.mockReturnValue({ user: { id: "user1" } });
    mockUseMutation.mockReturnValue(
      mockSyncUser as unknown as ReturnType<typeof convexReact.useMutation>
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // intentional no-op: silence console.error while asserting the sync failure
    });

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

  it("renders the organization JSON-LD and verification tags from admin settings", async () => {
    mockSeoQueries(
      {
        searchConsoleVerification: "google-token",
        bingVerification: "bing-token",
        ga4MeasurementId: "G-ABC123",
      },
      {
        businessName: "AgriBid",
        website: "https://agribid.example",
        logoUrl: "https://agribid.example/logo.png",
        businessDescription: "Auction platform",
        streetAddress: "1 Main Road",
        addressLocality: "Centurion",
        addressCountry: "ZA",
        postalCode: "0157",
        telephone: "+27-11-000-0000",
        email: "hello@agribid.example",
        sameAs: ["https://agribid.example/social"],
      }
    );

    const { container } = renderLayout("/");

    await waitFor(() => {
      expect(document.head.innerHTML).toContain("google-token");
    });
    expect(document.head.innerHTML).toContain("bing-token");
    expect(document.head.innerHTML).toContain("G-ABC123");
    expect(container.innerHTML).toContain("PostalAddress");
    expect(container.innerHTML).toContain("agribid.example");
    expect(container.innerHTML).toContain("hello@agribid.example");
  });

  it("falls back to default organization data when admin settings are empty", async () => {
    mockSeoQueries({}, { businessName: "AgriBid" });

    const { container } = renderLayout("/");

    await waitFor(() => {
      expect(container.innerHTML).toContain("PostalAddress");
    });
    expect(container.innerHTML).toContain("123 Harvest Road");
    expect(container.innerHTML).toContain("Agricultural Hub");
    expect(container.innerHTML).toContain("+27-11-555-0123");
  });

  it("omits the analytics scripts for a malformed GA4 measurement id", async () => {
    mockSeoQueries({ ga4MeasurementId: "UA-12345-1" }, undefined);

    const { container } = renderLayout("/");

    await waitFor(() => {
      expect(screen.getByTestId("mock-header")).toBeInTheDocument();
    });
    expect(document.head.innerHTML).not.toContain("UA-12345-1");
    expect(container.innerHTML).not.toContain("UA-12345-1");
  });

  it("omits organization tags when no business info is available", () => {
    mockSeoQueries(undefined, undefined);

    const { container } = renderLayout("/");

    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("PostalAddress");
  });

  it("uses the site name when branding has not loaded", () => {
    mockUseBranding.mockReturnValue(undefined);
    mockSeoQueries(undefined, undefined);

    renderLayout("/");

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("renders signed-in listeners and hides the footer on admin routes", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    mockUseUser.mockReturnValue({ user: { id: "user1" } });
    mockSeoQueries(undefined, undefined);

    renderLayout("/admin/fees");

    expect(
      screen.getByTestId("mock-notification-listener")
    ).toBeInTheDocument();
    expect(screen.getByTestId("mock-presence-listener")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-footer")).not.toBeInTheDocument();
  });
});
