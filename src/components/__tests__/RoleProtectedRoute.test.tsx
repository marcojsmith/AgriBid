import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";

import { useSession } from "@/lib/auth-client";

import { RoleProtectedRoute } from "../RoleProtectedRoute";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: vi.fn(() => <div data-testid="navigate">Navigate</div>),
    useLocation: vi.fn(),
  };
});

describe("RoleProtectedRoute", () => {
  const mockSyncUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockReturnValue(mockSyncUser);
    (useLocation as Mock).mockReturnValue({ pathname: "/admin", search: "" });
  });

  const renderWithRouter = (allowedRole: string) => {
    return render(
      <BrowserRouter>
        <RoleProtectedRoute allowedRole={allowedRole}>
          <div data-testid="protected-content">Secret Content</div>
        </RoleProtectedRoute>
      </BrowserRouter>
    );
  };

  it("renders loading state when session is pending", () => {
    (useSession as Mock).mockReturnValue({ data: null, isPending: true });
    renderWithRouter("admin");
    expect(screen.getByText(/Verifying permissions/i)).toBeInTheDocument();
  });

  it("redirects to login when no session", () => {
    (useSession as Mock).mockReturnValue({ data: null, isPending: false });
    renderWithRouter("admin");
    expect(screen.getByTestId("navigate")).toBeInTheDocument();
  });

  it("renders children when role matches", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue({ profile: { role: "admin" } });

    renderWithRouter("admin");
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("renders children when allowedRole is 'any' and session exists", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue({ profile: { role: "user" } });

    renderWithRouter("any");
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("renders access denied when role mismatch", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue({ profile: { role: "user" } });

    renderWithRouter("admin");
    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
  });

  it("shows error state after timeout", async () => {
    vi.useFakeTimers();
    // To trigger the timeout effect, session must be present, userData undefined, and isAuthPending false
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(undefined); // Stuck loading profile

    renderWithRouter("admin");

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(16000);
    });

    expect(screen.getByText(/Profile Loading Error/i)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
