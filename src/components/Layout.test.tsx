import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import * as convexReact from "convex/react";
import { useAuth, useUser } from "@clerk/clerk-react";

import { Layout } from "./Layout";

function typedMutationMock<T>(_val: unknown): T {
  return _val as T;
}

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
  useBranding: () => ({ appName: "AgriBid" }),
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true });
    mockUseUser.mockReturnValue({ user: undefined });
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
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    mockUseUser.mockReturnValue({ user: { id: "user1" } });
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
});
