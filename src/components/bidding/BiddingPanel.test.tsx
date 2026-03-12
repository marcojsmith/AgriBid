/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import type { Doc, Id } from "convex/_generated/dataModel";
import * as convexReact from "convex/react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";

import { BiddingPanel } from "./BiddingPanel";

// Mock the CountdownTimer
vi.mock("../CountdownTimer", () => ({
  CountdownTimer: ({ endTime }: { endTime: number }) => (
    <div data-testid="mock-timer">{endTime}</div>
  ),
}));

// Mock BidConfirmation directly to avoid Radix issues in tests
vi.mock("@/components/BidConfirmation", () => ({
  BidConfirmation: ({ isOpen, onConfirm, onCancel, amount }: any) =>
    isOpen ? (
      <div data-testid="alert-dialog">
        <p>Confirm Bid {amount}</p>
        <button onClick={onConfirm}>Confirm Bid</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

// Mock auth client
vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Convex hooks
vi.mock("convex/react", () => {
  const mockMutation = Object.assign(vi.fn(), {
    withOptimisticUpdate: vi.fn(),
  });
  mockMutation.withOptimisticUpdate.mockReturnValue(mockMutation);
  return {
    useMutation: vi.fn(() => mockMutation),
    useQuery: vi.fn(),
  };
});

describe("BiddingPanel", () => {
  const mockAuctionBase = {
    _id: "auction123" as Id<"auctions">,
    currentPrice: 50000,
    minIncrement: 500,
    startingPrice: 50000,
    status: "active",
  };

  const mockSession = { user: { id: "test-user-id", name: "Test User" } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    const mockMut = Object.assign(vi.fn(), {
      withOptimisticUpdate: vi.fn().mockReturnThis(),
    });
    vi.mocked(convexReact.useMutation).mockReturnValue(mockMut);
    const sessionData = { data: mockSession, isPending: false };
    vi.mocked(useSession).mockReturnValue(
      sessionData as unknown as ReturnType<typeof useSession>
    );

    // Default mock for queries: getMyProfile has no args
    vi.mocked(convexReact.useQuery).mockImplementation((...args: any[]) => {
      const queryArgs = args[1];
      if (queryArgs === undefined) {
        return { profile: { isVerified: true, kycStatus: "verified" } };
      }
      return null;
    });
  });

  const getActiveAuction = () =>
    ({
      ...mockAuctionBase,
      endTime: Date.now() + 100000,
      status: "active",
    }) as unknown as Doc<"auctions">;

  it("renders current price and minimum bid correctly", () => {
    const auction = getActiveAuction();
    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    expect(screen.getByText(/R.*50.000/)).toBeInTheDocument();
    expect(screen.getByText(/Next minimum bid/i)).toBeInTheDocument();
  });

  it("shows ended state when auction is not active", () => {
    const endedAuction = {
      ...mockAuctionBase,
      status: "sold",
      endTime: Date.now() - 1000,
    } as unknown as Doc<"auctions">;
    render(
      <BrowserRouter>
        <BiddingPanel auction={endedAuction} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Auction SOLD/i)).toBeInTheDocument();
  });

  it("gates bidding UI when user is unverified", async () => {
    const auction = getActiveAuction();
    vi.mocked(convexReact.useQuery).mockImplementation((...args: any[]) => {
      const queryArgs = args[1];
      if (queryArgs === undefined) {
        return { profile: { isVerified: false, kycStatus: "none" } };
      }
      return null;
    });

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Verification Required/i)).toBeInTheDocument();
    });
  });

  it("shows congratulations message when user is the winner", () => {
    const wonAuction = {
      ...mockAuctionBase,
      status: "sold",
      winnerId: "test-user-id",
      endTime: Date.now() - 1000,
    } as unknown as Doc<"auctions">;

    render(
      <BrowserRouter>
        <BiddingPanel auction={wonAuction} />
      </BrowserRouter>
    );

    expect(
      screen.getByText(/Congratulations, you are the buyer!/i)
    ).toBeInTheDocument();
  });

  it("handles bid confirmation successfully", async () => {
    const auction = getActiveAuction();
    const mockPlaceBid = Object.assign(
      vi.fn().mockResolvedValue({ success: true }),
      {
        withOptimisticUpdate: vi.fn().mockReturnThis(),
      }
    );
    vi.mocked(convexReact.useMutation).mockReturnValue(
      mockPlaceBid as unknown as ReturnType<typeof convexReact.useMutation>
    );

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    await waitFor(() => {
      expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", { name: "Confirm Bid" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockPlaceBid).toHaveBeenCalled();
    });
  });

  it("handles bid failure correctly", async () => {
    const auction = getActiveAuction();
    const mockPlaceBid = Object.assign(
      vi.fn().mockRejectedValue(new Error("Insufficient funds")),
      {
        withOptimisticUpdate: vi.fn().mockReturnThis(),
      }
    );
    vi.mocked(convexReact.useMutation).mockReturnValue(
      mockPlaceBid as unknown as ReturnType<typeof convexReact.useMutation>
    );

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    await waitFor(() => {
      expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", { name: "Confirm Bid" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Insufficient funds");
    });
  });

  it("shows proxy bid active message on success", async () => {
    const auction = getActiveAuction();
    const mockPlaceBid = Object.assign(
      vi.fn().mockResolvedValue({
        success: true,
        proxyBidActive: true,
        confirmedMaxBid: 70000,
      }),
      {
        withOptimisticUpdate: vi.fn().mockReturnThis(),
      }
    );
    vi.mocked(convexReact.useMutation).mockReturnValue(
      mockPlaceBid as unknown as ReturnType<typeof convexReact.useMutation>
    );

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    await waitFor(() => {
      expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", { name: "Confirm Bid" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("Your proxy bid is active")
      );
    });
  });

  it("prevents bidding when session is pending", () => {
    const auction = getActiveAuction();
    const sessionData = { data: null, isPending: true };
    vi.mocked(useSession).mockReturnValue(
      sessionData as unknown as ReturnType<typeof useSession>
    );

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    expect(toast.info).toHaveBeenCalledWith("Checking sign-in status...");
  });

  it("prevents bidding when profile is loading", async () => {
    const auction = getActiveAuction();
    vi.mocked(convexReact.useQuery).mockImplementation((...args: any[]) => {
      const queryArgs = args[1];
      if (queryArgs === undefined) {
        return undefined; // Loading
      }
      return null;
    });

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith("Verifying account status...");
    });
  });

  it("redirects to kyc if not verified", async () => {
    const auction = getActiveAuction();
    vi.mocked(convexReact.useQuery).mockImplementation((...args: any[]) => {
      const queryArgs = args[1];
      if (queryArgs === undefined) {
        return { profile: { isVerified: false, kycStatus: "none" } };
      }
      return null;
    });

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Account verification required to place bids"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/kyc");
    });
  });

  it("prevents bidding if auction ends during confirmation", async () => {
    const now = 1000000000000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const auction = {
      ...mockAuctionBase,
      endTime: now + 5000,
      status: "active",
    } as unknown as Doc<"auctions">;

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    await waitFor(() => {
      expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();
    });

    // Fast forward time
    vi.spyOn(Date, "now").mockReturnValue(now + 10000);

    const confirmButton = screen.getByRole("button", { name: "Confirm Bid" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("This auction has ended");
    });
  });

  it("shows soft close extended alert", () => {
    const auction = getActiveAuction();
    const extendedAuction = {
      ...auction,
      isExtended: true,
    } as unknown as Doc<"auctions">;

    render(
      <BrowserRouter>
        <BiddingPanel auction={extendedAuction} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Soft Close Extended/i)).toBeInTheDocument();
  });

  it("shows reserve not met message when ended and no bids met reserve", () => {
    const endedAuction = {
      ...mockAuctionBase,
      status: "passed",
      startingPrice: 50000,
      currentPrice: 60000,
      reservePrice: 100000,
      endTime: Date.now() - 1000,
    } as unknown as Doc<"auctions">;

    render(
      <BrowserRouter>
        <BiddingPanel auction={endedAuction} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Reserve price was not met/i)).toBeInTheDocument();
  });

  it("shows no bids message when ended and price is starting price", () => {
    const endedAuction = {
      ...mockAuctionBase,
      status: "passed",
      startingPrice: 50000,
      currentPrice: 50000,
      endTime: Date.now() - 1000,
    } as unknown as Doc<"auctions">;

    render(
      <BrowserRouter>
        <BiddingPanel auction={endedAuction} />
      </BrowserRouter>
    );

    expect(screen.getByText(/No bids were placed/i)).toBeInTheDocument();
  });

  it("handles bid cancellation", async () => {
    const auction = getActiveAuction();

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    await waitFor(() => {
      expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("alert-dialog")).not.toBeInTheDocument();
    });
  });

  it("prompts for sign in when unauthenticated", async () => {
    const auction = getActiveAuction();
    const sessionData = { data: null, isPending: false };
    vi.mocked(useSession).mockReturnValue(
      sessionData as unknown as ReturnType<typeof useSession>
    );
    vi.mocked(convexReact.useQuery).mockImplementation(() => null);

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("Please sign in")
    );
  });
});
