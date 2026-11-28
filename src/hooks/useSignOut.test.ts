import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const clerk = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@clerk/clerk-react", () => ({ useClerk: () => clerk }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useSignOut } from "./useSignOut";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSignOut", () => {
  it("signs out to the home page and says so", async () => {
    clerk.signOut.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSignOut());
    await act(async () => {
      await result.current();
    });
    expect(clerk.signOut).toHaveBeenCalledWith({ redirectUrl: "/" });
    expect(toast.success).toHaveBeenCalledWith("Signed out successfully");
  });

  it("shows an error when Clerk fails", async () => {
    clerk.signOut.mockRejectedValue(new Error("no"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useSignOut());
    await act(async () => {
      await result.current();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Failed to sign out. Please try again."
    );
  });
});
