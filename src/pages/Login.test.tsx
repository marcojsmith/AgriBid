import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useAuth, SignIn } from "@clerk/clerk-react";

import { useBranding } from "@/hooks/useBranding";

import Login from "./Login";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(),
  SignIn: vi.fn(() => <div data-testid="clerk-sign-in" />),
}));

vi.mock("@/hooks/useBranding", () => ({
  useBranding: vi.fn(),
}));

describe("Login Page", () => {
  const mockUseAuth = useAuth as Mock;
  const mockUseBranding = useBranding as Mock;
  const mockSignIn = SignIn as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true });
    mockUseBranding.mockReturnValue({ appName: "AgriBid" });
  });

  const renderComponent = (initialEntries = ["/login"]) =>
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

  it("renders the heading and Clerk SignIn component when signed out", () => {
    renderComponent();
    expect(screen.getByText("AgriBid Access")).toBeInTheDocument();
    expect(
      screen.getByText("Real-Time Bidding for Serious Farmers")
    ).toBeInTheDocument();
    expect(screen.getByTestId("clerk-sign-in")).toBeInTheDocument();
  });

  it("shows loading state while auth is loading", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: false });
    renderComponent();
    expect(screen.getByText("Authenticating...")).toBeInTheDocument();
    expect(screen.queryByTestId("clerk-sign-in")).not.toBeInTheDocument();
  });

  it("redirects to root when signed in without callbackUrl", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    renderComponent();
    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("redirects to callbackUrl when signed in with a valid callbackUrl", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    renderComponent(["/login?callbackUrl=/dashboard"]);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("redirects to root when callbackUrl is invalid", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    renderComponent(["/login?callbackUrl=http://evil.com"]);
    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("passes hash routing and callback URLs to the Clerk SignIn component", () => {
    renderComponent(["/login?callbackUrl=/dashboard"]);

    const signInProps = mockSignIn.mock.calls[0][0] as {
      routing: string;
      afterSignInUrl: string;
      afterSignUpUrl: string;
    };
    expect(signInProps).toMatchObject({
      routing: "hash",
      afterSignInUrl: "/dashboard",
      afterSignUpUrl: "/dashboard",
    });
  });

  it("falls back to the AgriBid app name when branding is absent", () => {
    mockUseBranding.mockReturnValue(undefined);
    renderComponent();
    expect(screen.getByText("AgriBid Access")).toBeInTheDocument();
  });
});
