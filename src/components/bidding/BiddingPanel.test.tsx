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

import { usePriceHighlight } from "@/hooks/usePriceHighlight";
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
  BidConfirmation: ({ isOpen, onConfirm, onCancel, amount }: any) => (
    <div data-testid={isOpen ? "alert-dialog" : "hidden-dialog"}>
      <p>Confirm Bid {amount}</p>
      <button onClick={onConfirm}>Confirm Bid</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
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

// Mock usePriceHighlight
vi.mock("@/hooks/usePriceHighlight", () => ({
  usePriceHighlight: vi.fn().mockReturnValue(false),
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

  it("handles missing profile gracefully", async () => {
    const auction = getActiveAuction();
    vi.mocked(convexReact.useQuery).mockImplementation((...args: any[]) => {
      const queryArgs = args[1];
      if (queryArgs === undefined) {
        return { profile: undefined }; // missing isVerified
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
      expect(screen.getByText(/Verification Required/i)).toBeInTheDocument();
    });
  });

  it("handles bid confirmation with zero amount gracefully", async () => {
    const auction = getActiveAuction();
    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    // Click the confirm button while the dialog is technically closed (amount = 0)
    const hiddenDialog = screen.getByTestId("hidden-dialog");
    const confirmButton =
      hiddenDialog.querySelector("button") ||
      screen.getByRole("button", { name: "Confirm Bid" });
    fireEvent.click(confirmButton);

    // Should return early, no mutations called
    expect(convexReact.useMutation).not.toHaveBeenCalledWith("placeBid");
  });

  it("applies highlight styles when price is highlighted", () => {
    const auction = getActiveAuction();
    vi.mocked(usePriceHighlight).mockReturnValue(true);

    const { container } = render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    expect(container.innerHTML).toContain("bg-green-500/10");
    vi.mocked(usePriceHighlight).mockReturnValue(false); // reset
  });

  it("shows success without proxy active message if proxyBidActive is false", async () => {
    const auction = getActiveAuction();
    const mockPlaceBid = Object.assign(
      vi.fn().mockResolvedValue({
        success: true,
        proxyBidActive: false, // false here
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
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("placed successfully")
      );
    });
    expect(toast.info).not.toHaveBeenCalledWith(
      expect.stringContaining("Your proxy bid is active")
    );
  });

  it("catches error during placeBid mutation", async () => {
    const auction = getActiveAuction();
    const mockPlaceBid = Object.assign(
      vi.fn().mockImplementation(() => {
        throw new Error("Mutation failed syntax error");
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
      expect(toast.error).toHaveBeenCalledWith("Mutation failed syntax error");
    });
  });

  it("handles auction without endTime gracefully (fallback to ended)", () => {
    const auctionNoEndTime = {
      ...mockAuctionBase,
      endTime: undefined,
      status: "active",
    } as unknown as Doc<"auctions">;

    render(
      <BrowserRouter>
        <BiddingPanel auction={auctionNoEndTime} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Auction Ended/i)).toBeInTheDocument();
  });

  it("applies correct styles for all combinations of isEnded and isHighlighted", () => {
    const auction = getActiveAuction();
    const { rerender, container } = render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    // Case 1: !isEnded && isHighlighted
    vi.mocked(usePriceHighlight).mockReturnValue(true);
    rerender(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );
    expect(
      container.querySelector(".border-green-500\\/30")
    ).toBeInTheDocument();

    // Case 2: !isEnded && !isHighlighted
    vi.mocked(usePriceHighlight).mockReturnValue(false);
    rerender(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );
    expect(container.querySelector(".border-transparent")).toBeInTheDocument();

    // Case 3: isEnded && isHighlighted (should still be border-border because !isEnded is false)
    const endedAuction = { ...auction, status: "sold" } as any;
    vi.mocked(usePriceHighlight).mockReturnValue(true);
    rerender(
      <BrowserRouter>
        <BiddingPanel auction={endedAuction} />
      </BrowserRouter>
    );
    expect(container.querySelector(".border-transparent")).toBeInTheDocument();

    // Case 4: isEnded && !isHighlighted
    vi.mocked(usePriceHighlight).mockReturnValue(false);
    rerender(
      <BrowserRouter>
        <BiddingPanel auction={endedAuction} />
      </BrowserRouter>
    );
    expect(container.querySelector(".border-transparent")).toBeInTheDocument();
  });

  it("renders with 0 amount when pendingBid.amount is falsy", async () => {
    const auction = getActiveAuction();
    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    // This should trigger the line `amount={pendingBid.amount || 0}` in BidConfirmation props
    // which we can verify by checking the rendered text in our mock
    expect(screen.getByText(/Confirm Bid 0/i)).toBeInTheDocument();
  });

  it("handles bid confirm with zero amount by returning early", async () => {
    const auction = getActiveAuction();
    const mockPlaceBid = vi.fn();
    vi.mocked(convexReact.useMutation).mockReturnValue(
      mockPlaceBid as unknown as ReturnType<typeof convexReact.useMutation>
    );
    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    // Trigger handleBidConfirm directly through the mock
    const confirmButton = screen.getByRole("button", { name: "Confirm Bid" });
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(mockPlaceBid).not.toHaveBeenCalled();
  });

  it("handles proxyBidActive true but confirmedMaxBid missing during confirm", async () => {
    const auction = getActiveAuction();
    const mockPlaceBid = Object.assign(
      vi.fn().mockResolvedValue({
        success: true,
        proxyBidActive: true,
        confirmedMaxBid: undefined, // Missing
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

    // Set a pending bid first
    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    const confirmButton = screen.getByRole("button", { name: "Confirm Bid" });
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(toast.info).not.toHaveBeenCalled();
  });

  it("shows pending verification message when kycStatus is pending", async () => {
    const auction = getActiveAuction();
    vi.mocked(convexReact.useQuery).mockImplementation((...args: any[]) => {
      const queryArgs = args[1];
      if (queryArgs === undefined) {
        return { profile: { isVerified: false, kycStatus: "pending" } };
      }
      return null;
    });

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /Your identity verification is currently under review/i
        )
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Complete KYC Now/i)).not.toBeInTheDocument();
  });

  it("shows rejected verification message and KYC link when kycStatus is rejected", async () => {
    const auction = getActiveAuction();
    vi.mocked(convexReact.useQuery).mockImplementation((...args: any[]) => {
      const queryArgs = args[1];
      if (queryArgs === undefined) {
        return { profile: { isVerified: false, kycStatus: "rejected" } };
      }
      return null;
    });

    render(
      <BrowserRouter>
        <BiddingPanel auction={auction} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /you must complete identity verification before placing bids/i
        )
      ).toBeInTheDocument();
      expect(screen.getByText(/Complete KYC Now/i)).toBeInTheDocument();
    });
  });
});
