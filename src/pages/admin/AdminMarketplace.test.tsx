import { BrowserRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";

import AdminMarketplace from "./AdminMarketplace";

interface PaginatedBidsPage {
  page: Array<{
    _id: string;
    _creationTime?: number;
    auctionId?: string;
    timestamp: number;
    auctionTitle?: string;
    auctionLookupStatus: string;
    bidderId: string;
    amount: number;
    status: string;
  }>;
  isDone: boolean;
  continueCursor: string;
  totalCount: number;
  pageStatus: null;
  splitCursor: null;
}

function createPaginatedBids(
  pageItems: PaginatedBidsPage["page"],
  overrides?: Partial<PaginatedBidsPage>
): PaginatedBidsPage {
  return {
    page: pageItems,
    isDone: true,
    continueCursor: "",
    totalCount: pageItems.length,
    pageStatus: null,
    splitCursor: null,
    ...overrides,
  };
}

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock API
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getAdminStats: "admin:getAdminStats",
      getRecentBids: "admin:getRecentBids",
      voidBid: "admin:voidBid",
    },
  },
}));

// Mock hooks
vi.mock("@/hooks/useLoadingTimeout", () => ({
  useLoadingTimeout: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock scrollIntoView as it's not implemented in JSDOM
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe("AdminMarketplace Page", () => {
  const mockStats = {
    totalUsers: 150,
    liveUsers: 12,
    pendingReview: 5,
    totalAuctions: 45,
    status: "healthy",
  };

  const mockBids = [
    {
      _id: "bid1",
      _creationTime: Date.now(),
      auctionId: "auction1",
      bidderId: "user1_long_id_here",
      amount: 5000,
      timestamp: Date.now(),
      status: "valid",
      auctionTitle: "2023 John Deere Tractor",
      auctionLookupStatus: "FOUND",
    },
    {
      _id: "bid2",
      _creationTime: Date.now() - 1000,
      auctionId: "auction2",
      bidderId: "user2_long_id_here",
      amount: 7500,
      timestamp: Date.now() - 1000,
      status: "valid",
      auctionTitle: "New Holland Combine",
      auctionLookupStatus: "FOUND",
    },
    {
      _id: "bid3",
      _creationTime: Date.now() - 2000,
      auctionId: "auction3",
      bidderId: "user3_long_id_here",
      amount: 3000,
      timestamp: Date.now() - 2000,
      status: "voided",
      auctionTitle: "Case IH Baler",
      auctionLookupStatus: "FOUND",
    },
  ];

  const mockPaginatedBids = {
    page: mockBids,
    isDone: true,
    continueCursor: "",
    totalCount: mockBids.length,
    pageStatus: null,
    splitCursor: null,
  };

  const mockVoidBid = vi.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockReturnValue(mockVoidBid);
    (useLoadingTimeout as Mock).mockReturnValue(false);
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <AdminMarketplace />
      </BrowserRouter>
    );

  it("renders loading state for stats", () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") return undefined;
      return [];
    });

    renderPage();
    expect(
      screen.getByText(/Synchronizing live auction feed/i)
    ).toBeInTheDocument();
  });

  it("renders timeout state for stats", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    (useLoadingTimeout as Mock).mockReturnValue(true);

    renderPage();
    expect(screen.getByText(/Monitor Timeout/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /We're having trouble reaching the live monitoring service/i
      )
    ).toBeInTheDocument();
  });

  it("renders partial data warning when stats status is partial", () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats")
        return { ...mockStats, status: "partial" };
      if (query === "admin:getRecentBids") return mockPaginatedBids;
      return undefined;
    });

    renderPage();
    expect(
      screen.getByText(/Warning: Background aggregates are currently partial/i)
    ).toBeInTheDocument();
  });

  it("renders loading state for bid monitor", () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") return mockStats;
      if (query === "admin:getRecentBids") return undefined;
      return undefined;
    });

    renderPage();
    expect(
      screen.getByText(/Connecting to real-time bid stream/i)
    ).toBeInTheDocument();
  });

  it("renders timeout state for bid monitor", () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") return mockStats;
      if (query === "admin:getRecentBids") return undefined;
      return undefined;
    });
    (useLoadingTimeout as Mock).mockImplementation(
      (isLoading: boolean) => isLoading
    );

    renderPage();
    expect(screen.getByText(/Feed Timeout/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Unable to establish real-time connection/i)
    ).toBeInTheDocument();
  });

  it("renders empty state when no bids are present", () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") return mockStats;
      if (query === "admin:getRecentBids") return createPaginatedBids([]);
      return undefined;
    });

    renderPage();
    expect(screen.getByText(/No bids yet/i)).toBeInTheDocument();
  });

  it("renders list of bids correctly", () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") return mockStats;
      if (query === "admin:getRecentBids") return mockPaginatedBids;
      return undefined;
    });

    renderPage();

    expect(screen.getByText("2023 John Deere Tractor")).toBeInTheDocument();
    expect(screen.getByText("New Holland Combine")).toBeInTheDocument();
    expect(screen.getByText("Case IH Baler")).toBeInTheDocument();

    // Check amounts (R 5,000 etc)
    expect(screen.getByText(/R 5,000/i)).toBeInTheDocument();
    expect(screen.getByText(/R 7,500/i)).toBeInTheDocument();

    // Voided bid should have line-through style
    expect(screen.getByText(/R 3,000/i)).toBeInTheDocument();

    // Check bidder IDs (truncated)
    expect(screen.getAllByText(/user1_lo.../i)).toHaveLength(1);
  });

  it("handles auction lookup errors gracefully", () => {
    const errorBids = [
      {
        _id: "bid_err",
        _creationTime: Date.now(),
        auctionId: "auction_err",
        bidderId: "user_err",
        amount: 1000,
        timestamp: Date.now(),
        status: "valid",
        auctionLookupStatus: "ERROR",
      },
      {
        _id: "bid_miss",
        _creationTime: Date.now(),
        auctionId: "auction_miss",
        bidderId: "user_miss",
        amount: 2000,
        timestamp: Date.now(),
        status: "valid",
        auctionLookupStatus: "NOT_FOUND",
      },
    ];

    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") return mockStats;
      if (query === "admin:getRecentBids")
        return createPaginatedBids(errorBids);
      return undefined;
    });

    renderPage();

    expect(screen.getByText("Auction Data Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Unknown Auction (Deleted)")).toBeInTheDocument();
  });

  it("opens void confirmation dialog and cancels", async () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") return mockStats;
      if (query === "admin:getRecentBids") return mockPaginatedBids;
      return undefined;
    });

    renderPage();

    // Click void button for first bid
    const voidButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector(".lucide-ban"));
    fireEvent.click(voidButtons[0]);

    // Check dialog
    expect(screen.getByText(/Void Bid Transaction\?/i)).toBeInTheDocument();

    // Click cancel
    const cancelBtn = screen.getByText(/Cancel/i);
    fireEvent.click(cancelBtn);

    // Dialog should close
    await waitFor(() => {
      expect(
        screen.queryByText(/Void Bid Transaction\?/i)
      ).not.toBeInTheDocument();
    });

    expect(mockVoidBid).not.toHaveBeenCalled();
  });

  it("performs void bid successfully", async () => {
    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") return mockStats;
      if (query === "admin:getRecentBids") return mockPaginatedBids;
      return undefined;
    });

    renderPage();

    // Click void button
    const voidButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector(".lucide-ban"));
    fireEvent.click(voidButtons[0]);

    // Click confirm
    const confirmBtn = screen.getByText(/Confirm Void/i);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockVoidBid).toHaveBeenCalledWith({
        bidId: "bid1",
        reason: "Admin Action via Monitor",
      });
    });

    expect(toast.success).toHaveBeenCalledWith("Bid voided");

    // Dialog should close
    await waitFor(() => {
      expect(
        screen.queryByText(/Void Bid Transaction\?/i)
      ).not.toBeInTheDocument();
    });
  });

  it("handles void bid error", async () => {
    mockVoidBid.mockRejectedValueOnce(new Error("Network Error"));

    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") return mockStats;
      if (query === "admin:getRecentBids") return mockPaginatedBids;
      return undefined;
    });

    renderPage();

    const voidButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector(".lucide-ban"));
    fireEvent.click(voidButtons[0]);

    const confirmBtn = screen.getByText(/Confirm Void/i);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network Error");
    });
  });

  it("handles void bid generic error", async () => {
    mockVoidBid.mockRejectedValueOnce("Something went wrong");

    (useQuery as Mock).mockImplementation((query) => {
      if (query === "admin:getAdminStats") return mockStats;
      if (query === "admin:getRecentBids") return mockPaginatedBids;
      return undefined;
    });

    renderPage();

    const voidButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector(".lucide-ban"));
    fireEvent.click(voidButtons[0]);

    const confirmBtn = screen.getByText(/Confirm Void/i);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to void bid");
    });
  });
});
