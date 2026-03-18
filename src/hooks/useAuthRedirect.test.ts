import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";
import { isValidCallbackUrl } from "@/lib/utils";

import { useAuthRedirect } from "./useAuthRedirect";

vi.mock("react-router-dom", () => ({
  useLocation: vi.fn(),
  useNavigate: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
  },
}));

vi.mock("@/lib/utils", () => ({
  isValidCallbackUrl: vi.fn(),
}));

describe("useAuthRedirect", () => {
  const mockNavigate = vi.fn();
  const mockLocation = { pathname: "/test", search: "?query=1" };

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    (useLocation as Mock).mockReturnValue(mockLocation);
    (isValidCallbackUrl as unknown as Mock).mockReturnValue(true);
  });

  it("should return false and not navigate when session is pending", () => {
    (useSession as Mock).mockReturnValue({ data: null, isPending: true });

    const { result } = renderHook(() => useAuthRedirect());
    const isAuthenticated = result.current.ensureAuthenticated();

    expect(isAuthenticated).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should return true when session exists", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "1" } },
      isPending: false,
    });

    const { result } = renderHook(() => useAuthRedirect());
    const isAuthenticated = result.current.ensureAuthenticated();

    expect(isAuthenticated).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should redirect to login when no session", () => {
    (useSession as Mock).mockReturnValue({ data: null, isPending: false });

    const { result } = renderHook(() => useAuthRedirect());
    const isAuthenticated = result.current.ensureAuthenticated("Please login");

    expect(isAuthenticated).toBe(false);
    expect(toast.info).toHaveBeenCalledWith("Please login");
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("/login?callbackUrl=")
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("/test?query=1"))
    );
  });

  it("should fallback to root if callback URL is invalid", () => {
    (useSession as Mock).mockReturnValue({ data: null, isPending: false });
    (isValidCallbackUrl as unknown as Mock).mockReturnValue(false);

    const { result } = renderHook(() => useAuthRedirect());
    result.current.ensureAuthenticated();

    expect(mockNavigate).toHaveBeenCalledWith("/login?callbackUrl=/");
  });
});
