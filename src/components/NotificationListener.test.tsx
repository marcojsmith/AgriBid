import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "convex/react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";

import { NotificationListener } from "./NotificationListener";

// Mock dependencies
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

// Mock api
vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: { getMyBids: "getMyBids" },
    watchlist: { getWatchedAuctions: "getWatchedAuctions" },
  },
}));

describe("NotificationListener", () => {
  const mockUserId = "user123";
  const mockSession = { user: { id: mockUserId } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
    } as unknown as ReturnType<typeof useSession>);
  });

  it("should not trigger toasts if data is loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<NotificationListener />);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("should trigger win notification if user is the winner", () => {
    const auction = {
      _id: "a1",
      title: "Tractor",
      status: "sold",
      winnerId: mockUserId,
      currentPrice: 50000,
    };

    vi.mocked(useQuery).mockImplementation((...args: unknown[]) => {
      const apiPath = args[0];
      if (apiPath === "getMyBids") return { page: [auction] };
      return { page: [] };
    });

    render(<NotificationListener />);

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("You won the auction"),
      expect.any(Object)
    );
  });

  it("should trigger sale notification if user is the seller", () => {
    const auction = {
      _id: "a2",
      title: "Plow",
      status: "sold",
      sellerId: mockUserId,
      winnerId: "otherUser",
      currentPrice: 10000,
    };

    vi.mocked(useQuery).mockImplementation((...args: unknown[]) => {
      const apiPath = args[0];
      if (apiPath === "getMyBids") return { page: [auction] };
      return { page: [] };
    });

    render(<NotificationListener />);

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Your equipment Plow has been sold"),
      expect.any(Object)
    );
  });

  it("should trigger unsold notification for seller", () => {
    const auction = {
      _id: "a3",
      title: "Broken Tool",
      status: "unsold",
      sellerId: mockUserId,
    };

    vi.mocked(useQuery).mockImplementation((...args: unknown[]) => {
      const apiPath = args[0];
      if (apiPath === "getMyBids") return { page: [auction] };
      return { page: [] };
    });

    render(<NotificationListener />);

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("did not meet reserve"),
      expect.any(Object)
    );
  });

  it("should not trigger same notification twice", () => {
    const auction = {
      _id: "a1",
      title: "Tractor",
      status: "sold",
      winnerId: mockUserId,
      currentPrice: 50000,
    };

    vi.mocked(useQuery).mockImplementation((...args: unknown[]) => {
      const apiPath = args[0];
      if (apiPath === "getMyBids") return { page: [auction] };
      return { page: [] };
    });

    const { rerender } = render(<NotificationListener />);
    expect(toast.success).toHaveBeenCalledTimes(1);

    // Rerender with same data
    rerender(<NotificationListener />);
    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});
