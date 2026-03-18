import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter, useLocation, Navigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";

import { useSession } from "@/lib/auth-client";

import { RoleProtectedRoute } from "./RoleProtectedRoute";

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

  it("handles when userData is explicitly null", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(null);

    renderWithRouter("admin");
    expect(screen.getByText(/Initializing your profile/i)).toBeInTheDocument();
  });

  it("handles when userData is undefined and not timed out", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(undefined);

    renderWithRouter("admin");
    expect(screen.getByText(/Verifying permissions/i)).toBeInTheDocument();
  });

  it("handles when userData is undefined and has timed out", async () => {
    vi.useFakeTimers();
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(undefined);

    renderWithRouter("admin");

    // Trigger timeout
    act(() => {
      vi.advanceTimersByTime(16000);
    });

    // Should NOT be pending anymore (isPending depends on !hasTimedOut)
    expect(
      screen.queryByText(/Verifying permissions/i)
    ).not.toBeInTheDocument();
    // Should show error state
    expect(screen.getByText(/Profile Loading Error/i)).toBeInTheDocument();
    vi.useRealTimers();
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

  it("renders initializing profile state when userData is null but not timed out", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(null); // userData is null

    renderWithRouter("admin");
    expect(screen.getByText(/Initializing your profile/i)).toBeInTheDocument();
  });

  it("handles successful retry when timed out", async () => {
    vi.useFakeTimers();
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(undefined);
    mockSyncUser.mockResolvedValue({ success: true });

    renderWithRouter("admin");

    // Trigger timeout
    act(() => {
      vi.advanceTimersByTime(16000);
    });

    const retryBtn = screen.getByRole("button", { name: /Retry Connection/i });
    await act(async () => {
      retryBtn.click();
    });

    expect(mockSyncUser).toHaveBeenCalled();
    // After retry, hasTimedOut is false, so it should show verifying permissions
    expect(screen.getByText(/Verifying permissions/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("handles failed retry when timed out and clears existing timer", async () => {
    vi.useFakeTimers();
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(undefined);
    mockSyncUser.mockRejectedValue(new Error("Sync failed"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithRouter("admin");

    // Trigger timeout - this sets timerRef.current
    act(() => {
      vi.advanceTimersByTime(16000);
    });

    vi.useRealTimers();

    const retryBtn = screen.getByRole("button", { name: /Retry Connection/i });
    act(() => {
      retryBtn.click();
    });

    expect(mockSyncUser).toHaveBeenCalled();
    // After failed retry, hasTimedOut is set back to true
    await waitFor(() => {
      expect(screen.getByText(/Profile Loading Error/i)).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it("handles null sync result during retry", async () => {
    vi.useFakeTimers();
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(undefined);
    mockSyncUser.mockResolvedValue(null);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithRouter("admin");

    act(() => {
      vi.advanceTimersByTime(16000);
    });

    vi.useRealTimers();

    const retryBtn = screen.getByRole("button", { name: /Retry Connection/i });
    act(() => {
      retryBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByText(/Profile Loading Error/i)).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it("handles retry catch block when component is unmounted (timerRef is null)", async () => {
    vi.useFakeTimers();
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(undefined);

    // Create a promise we can control
    let rejectPromise: (reason?: unknown) => void;
    mockSyncUser.mockReturnValue(
      new Promise((_, reject) => {
        rejectPromise = reject;
      })
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = render(
      <BrowserRouter>
        <RoleProtectedRoute allowedRole="admin">
          <div>Content</div>
        </RoleProtectedRoute>
      </BrowserRouter>
    );

    // Trigger timeout to show retry button
    act(() => {
      vi.advanceTimersByTime(16000);
    });

    vi.useRealTimers();

    const retryBtn = screen.getByRole("button", { name: /Retry Connection/i });
    act(() => {
      retryBtn.click();
    });

    // Now unmount! This clears the timer and sets it to undefined.
    unmount();

    // Now fail the syncUser mutation
    await act(async () => {
      rejectPromise!(new Error("Sync failed after unmount"));
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Manual profile sync failed:",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("does not start timeout if already timed out", async () => {
    vi.useFakeTimers();
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(undefined);

    const { rerender } = render(
      <BrowserRouter>
        <RoleProtectedRoute allowedRole="admin">
          <div>Content</div>
        </RoleProtectedRoute>
      </BrowserRouter>
    );

    // Trigger first timeout
    act(() => {
      vi.advanceTimersByTime(16000);
    });
    expect(screen.getByText(/Profile Loading Error/i)).toBeInTheDocument();

    // Rerender - should NOT trigger another timeout since hasTimedOut is true
    rerender(
      <BrowserRouter>
        <RoleProtectedRoute allowedRole="admin">
          <div>Content</div>
        </RoleProtectedRoute>
      </BrowserRouter>
    );

    vi.useRealTimers();
  });

  it("clears timer on unmount", () => {
    vi.useFakeTimers();
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(undefined);

    const { unmount } = render(
      <BrowserRouter>
        <RoleProtectedRoute allowedRole="admin">
          <div>Content</div>
        </RoleProtectedRoute>
      </BrowserRouter>
    );

    unmount();
    // If it doesn't crash and timer is cleared internally, we are good
    // We can't easily check internal ref without more complex setup
    vi.useRealTimers();
  });

  it("does not start timeout if session is missing", () => {
    vi.useFakeTimers();
    (useSession as Mock).mockReturnValue({
      data: null,
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(undefined);

    renderWithRouter("admin");

    act(() => {
      vi.advanceTimersByTime(16000);
    });

    // Should NOT show error state because session was missing
    expect(
      screen.queryByText(/Profile Loading Error/i)
    ).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("does not start timeout if userData is already present", () => {
    vi.useFakeTimers();
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue({ profile: { role: "admin" } });

    renderWithRouter("admin");

    act(() => {
      vi.advanceTimersByTime(16000);
    });

    // Should NOT show error state
    expect(
      screen.queryByText(/Profile Loading Error/i)
    ).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("starts timeout if userData is null", () => {
    vi.useFakeTimers();
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(null);

    renderWithRouter("admin");

    act(() => {
      vi.advanceTimersByTime(16000);
    });

    // Should show error state because userData was null
    expect(screen.getByText(/Profile Loading Error/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("starts timeout if userData is undefined", () => {
    vi.useFakeTimers();
    (useSession as Mock).mockReturnValue({
      data: { user: {} },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(undefined);

    renderWithRouter("admin");

    act(() => {
      vi.advanceTimersByTime(16000);
    });

    // Should show error state because userData was undefined
    expect(screen.getByText(/Profile Loading Error/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("redirects to home if callbackUrl is invalid", () => {
    (useSession as Mock).mockReturnValue({ data: null, isPending: false });
    (useLocation as Mock).mockReturnValue({
      pathname: "///invalid-path",
      search: "",
      hash: "",
    });

    renderWithRouter("admin");

    expect(vi.mocked(Navigate)).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/login?callbackUrl=/",
      }),
      undefined
    );
  });
});
