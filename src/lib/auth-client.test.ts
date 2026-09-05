import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useAuth, useUser } from "@clerk/clerk-react";

import { useSession } from "./auth-client";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(),
  useUser: vi.fn(),
}));

describe("useSession (Clerk compatibility shim)", () => {
  const mockUseAuth = useAuth as Mock;
  const mockUseUser = useUser as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps a fully-populated Clerk user to the session shape", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    mockUseUser.mockReturnValue({
      user: {
        id: "user_2abc",
        primaryEmailAddress: { emailAddress: "farm@example.com" },
        fullName: "Farm Er",
      },
    });

    const { result } = renderHook(() => useSession());

    expect(result.current).toEqual({
      data: {
        user: {
          id: "user_2abc",
          email: "farm@example.com",
          name: "Farm Er",
        },
      },
      isPending: false,
    });
  });

  it("maps missing optional Clerk fields to null", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    mockUseUser.mockReturnValue({ user: { id: "user_2abc" } });

    const { result } = renderHook(() => useSession());

    expect(result.current).toEqual({
      data: { user: { id: "user_2abc", email: null, name: null } },
      isPending: false,
    });
  });

  it("returns null data when signed out even if a user object exists", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true });
    mockUseUser.mockReturnValue({
      user: {
        id: "user_2abc",
        primaryEmailAddress: { emailAddress: "farm@example.com" },
        fullName: "Farm Er",
      },
    });

    const { result } = renderHook(() => useSession());

    expect(result.current.data).toBeNull();
    expect(result.current.isPending).toBe(false);
  });

  it("returns null data when Clerk has no user object", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    mockUseUser.mockReturnValue({ user: undefined });

    const { result } = renderHook(() => useSession());

    expect(result.current.data).toBeNull();
  });

  it("is pending while Clerk auth is loading", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: false });
    mockUseUser.mockReturnValue({ user: undefined });

    const { result } = renderHook(() => useSession());

    expect(result.current.data).toBeNull();
    expect(result.current.isPending).toBe(true);
  });
});
