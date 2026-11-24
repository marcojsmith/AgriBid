import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useAuth, SignIn } from "@clerk/clerk-react";

import { useCallbackLot } from "@/hooks/useCallbackLot";

import Login from "./Login";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(),
  SignIn: vi.fn(() => <div data-testid="clerk-sign-in" />),
}));

vi.mock("@/hooks/useCallbackLot", () => ({
  useCallbackLot: vi.fn(),
}));

const LOT_CALLBACK = {
  href: "/auction/l1",
  label: "Lot 3 · New Holland T6070",
  lot: { lotNumber: 3, title: "New Holland T6070" },
};

describe("Login Page", () => {
  const mockUseAuth = useAuth as Mock;
  const mockSignIn = SignIn as unknown as Mock;
  const mockUseCallbackLot = useCallbackLot as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true });
    mockUseCallbackLot.mockReturnValue(null);
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

  it("renders the Clerk SignIn component and none of the old tagline", () => {
    renderComponent();
    expect(screen.getByTestId("clerk-sign-in")).toBeInTheDocument();
    expect(screen.queryByText(/Access/)).toBeNull();
    expect(screen.queryByText(/Serious Farmers/)).toBeNull();
  });

  it("shows 'Continuing to' the lot when the callback is a lot", () => {
    mockUseCallbackLot.mockReturnValue(LOT_CALLBACK);
    renderComponent(["/login?callbackUrl=%2Fauction%2Fl1"]);
    expect(mockUseCallbackLot).toHaveBeenCalledWith("/auction/l1");
    expect(screen.getByText(/Continuing to/)).toHaveTextContent(
      "Continuing to Lot 3 · New Holland T6070"
    );
    expect(screen.getByText("Lot 3 · New Holland T6070").tagName).toBe("B");
  });

  it("hides the line when the callback is invalid", () => {
    renderComponent(["/login?callbackUrl=http://evil.com"]);
    expect(mockUseCallbackLot).toHaveBeenCalledWith(null);
    expect(screen.queryByText(/Continuing to/)).toBeNull();
  });

  it("hides the line before the lot has loaded", () => {
    mockUseCallbackLot.mockReturnValue({ href: "/auction/l1", label: "Back" });
    renderComponent(["/login?callbackUrl=%2Fauction%2Fl1"]);
    expect(screen.queryByText(/Continuing to/)).toBeNull();
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

  it("passes hash routing, the callback and the sign-up links to Clerk", () => {
    renderComponent(["/login?callbackUrl=/dashboard"]);

    const signInProps = mockSignIn.mock.calls[0][0] as Record<string, unknown>;
    expect(signInProps).toMatchObject({
      routing: "hash",
      fallbackRedirectUrl: "/dashboard",
      signUpUrl: "/sign-up?callbackUrl=%2Fdashboard",
      signUpForceRedirectUrl: "/register?callbackUrl=%2Fdashboard",
    });
  });

  it("sends a new account to /register when there is no callback", () => {
    renderComponent();
    const signInProps = mockSignIn.mock.calls[0][0] as Record<string, unknown>;
    expect(signInProps).toMatchObject({
      fallbackRedirectUrl: "/",
      signUpUrl: "/sign-up",
      signUpForceRedirectUrl: "/register",
    });
  });
});
