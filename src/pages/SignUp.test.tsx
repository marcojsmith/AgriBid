import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useAuth, SignUp as ClerkSignUp } from "@clerk/clerk-react";

import { useCallbackLot } from "@/hooks/useCallbackLot";

import SignUp from "./SignUp";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(),
  SignUp: vi.fn(() => <div data-testid="clerk-sign-up" />),
}));

vi.mock("@/hooks/useCallbackLot", () => ({
  useCallbackLot: vi.fn(),
}));

describe("SignUp Page", () => {
  const mockUseAuth = useAuth as Mock;
  const mockClerkSignUp = ClerkSignUp as unknown as Mock;
  const mockUseCallbackLot = useCallbackLot as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true });
    mockUseCallbackLot.mockReturnValue(null);
  });

  const renderComponent = (initialEntries = ["/sign-up"]) =>
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/register" element={<div>Register Page</div>} />
        </Routes>
      </MemoryRouter>
    );

  it("renders the Clerk SignUp component", () => {
    renderComponent();
    expect(screen.getByTestId("clerk-sign-up")).toBeInTheDocument();
  });

  it("shows 'Continuing to' the lot when the callback is a lot", () => {
    mockUseCallbackLot.mockReturnValue({
      href: "/auction/l1",
      label: "Lot 3 · New Holland T6070",
      lot: { lotNumber: 3, title: "New Holland T6070" },
    });
    renderComponent(["/sign-up?callbackUrl=%2Fauction%2Fl1"]);
    expect(screen.getByText(/Continuing to/)).toHaveTextContent(
      "Continuing to Lot 3 · New Holland T6070"
    );
  });

  it("hides the line when the callback is invalid", () => {
    renderComponent(["/sign-up?callbackUrl=//evil.com"]);
    expect(mockUseCallbackLot).toHaveBeenCalledWith(null);
    expect(screen.queryByText(/Continuing to/)).toBeNull();
  });

  it("sends a new account to /register, keeping the callback", () => {
    renderComponent(["/sign-up?callbackUrl=%2Fauction%2Fl1"]);
    const props = mockClerkSignUp.mock.calls[0][0] as Record<string, unknown>;
    expect(props).toMatchObject({
      routing: "hash",
      forceRedirectUrl: "/register?callbackUrl=%2Fauction%2Fl1",
      signInUrl: "/login?callbackUrl=%2Fauction%2Fl1",
      signInFallbackRedirectUrl: "/auction/l1",
    });
  });

  it("sends a new account to /register when there is no callback", () => {
    renderComponent();
    const props = mockClerkSignUp.mock.calls[0][0] as Record<string, unknown>;
    expect(props).toMatchObject({
      forceRedirectUrl: "/register",
      signInUrl: "/login",
      signInFallbackRedirectUrl: "/",
    });
  });

  it("shows loading state while auth is loading", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: false });
    renderComponent();
    expect(screen.getByText("Authenticating...")).toBeInTheDocument();
  });

  it("sends a signed-in user to registration", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    renderComponent();
    expect(screen.getByText("Register Page")).toBeInTheDocument();
  });
});
