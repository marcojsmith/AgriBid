import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";

import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";

import { BidMonitor } from "./BidMonitor";

const FIXED_TIMESTAMP = 1704067200000;

const mockBids = [
  {
    _id: "bid-1" as Id<"bids">,
    timestamp: FIXED_TIMESTAMP,
    auctionTitle: "John Deere 8R",
    auctionLookupStatus: "FOUND" as const,
    bidderId: "bidder-123456789",
    amount: 150000,
    status: "valid" as const,
  },
  {
    _id: "bid-2" as Id<"bids">,
    timestamp: FIXED_TIMESTAMP,
    auctionTitle: "Case IH Combine",
    auctionLookupStatus: "FOUND" as const,
    bidderId: "bidder-987654321",
    amount: 200000,
    status: "voided" as const,
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

const { mockUseQuery, mockUseMutation } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(() => vi.fn()),
}));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/useLoadingTimeout", () => ({
  useLoadingTimeout: vi.fn(() => false),
}));

describe("BidMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<BidMonitor />);
    expect(
      screen.getByText("Connecting to real-time bid stream...")
    ).toBeInTheDocument();
  });

  it("renders empty state when no bids", () => {
    mockUseQuery.mockReturnValue({
      ...mockPaginatedBids,
      page: [],
      totalCount: 0,
    });
    render(<BidMonitor />);
    expect(screen.getByText("No bids yet")).toBeInTheDocument();
  });

  it("renders bids table with data", () => {
    mockUseQuery.mockReturnValue(mockPaginatedBids);
    render(<BidMonitor />);
    expect(screen.getByText("John Deere 8R")).toBeInTheDocument();
    expect(screen.getByText("Case IH Combine")).toBeInTheDocument();
  });

  it("displays bid amounts formatted", () => {
    mockUseQuery.mockReturnValue(mockPaginatedBids);
    render(<BidMonitor />);
    expect(screen.getByText(/R\s*150\s*000/)).toBeInTheDocument();
    expect(screen.getByText(/R\s*200\s*000/)).toBeInTheDocument();
  });

  it("displays live indicator", () => {
    mockUseQuery.mockReturnValue(mockPaginatedBids);
    render(<BidMonitor />);
    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
  });

  it("shows line-through for voided bids", () => {
    mockUseQuery.mockReturnValue({
      page: [mockBids[1]],
      isDone: true,
      continueCursor: "",
      totalCount: 1,
      pageStatus: null,
      splitCursor: null,
    });
    render(<BidMonitor />);
    const amount = screen.getByText(/R\s*200\s*000/);
    expect(amount.closest("span")).toHaveClass("line-through");
  });

  it("displays auction unavailable when lookup status is ERROR", () => {
    const errorBid = {
      ...mockBids[0],
      auctionLookupStatus: "ERROR" as const,
    };
    mockUseQuery.mockReturnValue({
      page: [errorBid],
      isDone: true,
      continueCursor: "",
      totalCount: 1,
      pageStatus: null,
      splitCursor: null,
    });
    render(<BidMonitor />);
    expect(screen.getByText("Auction Data Unavailable")).toBeInTheDocument();
  });

  it("displays deleted auction when lookup status is NOT_FOUND", () => {
    const deletedBid = {
      ...mockBids[0],
      auctionLookupStatus: "NOT_FOUND" as const,
    };
    mockUseQuery.mockReturnValue({
      page: [deletedBid],
      isDone: true,
      continueCursor: "",
      totalCount: 1,
      pageStatus: null,
      splitCursor: null,
    });
    render(<BidMonitor />);
    expect(screen.getByText("Unknown Auction (Deleted)")).toBeInTheDocument();
  });

  it("shows green color for active bids", () => {
    mockUseQuery.mockReturnValue({
      page: [mockBids[0]],
      isDone: true,
      continueCursor: "",
      totalCount: 1,
      pageStatus: null,
      splitCursor: null,
    });
    render(<BidMonitor />);
    const amount = screen.getByText(/R\s*150\s*000/);
    expect(amount.closest("span")).toHaveClass("text-green-600");
  });

  it("renders connection error on timeout", () => {
    mockUseQuery.mockReturnValue(undefined);
    vi.mocked(useLoadingTimeout).mockReturnValue(true);
    render(<BidMonitor />);
    expect(screen.getByText("Feed Timeout")).toBeInTheDocument();
  });

  it("handles voiding a bid successfully", async () => {
    mockUseQuery.mockReturnValue(mockPaginatedBids);
    const mockVoidBid = vi.fn().mockResolvedValue(undefined);
    mockUseMutation.mockReturnValue(mockVoidBid);

    render(<BidMonitor />);

    const voidButtons = screen.getAllByRole("button");
    fireEvent.click(voidButtons[0]);

    expect(screen.getByText("Void Bid Transaction?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Confirm Void"));

    await waitFor(() => {
      expect(mockVoidBid).toHaveBeenCalledWith({
        bidId: "bid-1",
        reason: "Admin Action via Monitor",
      });
      expect(toast.success).toHaveBeenCalledWith("Bid voided");
    });
  });

  it("handles voiding a bid with error", async () => {
    mockUseQuery.mockReturnValue(mockPaginatedBids);
    const mockVoidBid = vi.fn().mockRejectedValue(new Error("Void failed"));
    mockUseMutation.mockReturnValue(mockVoidBid);

    render(<BidMonitor />);

    const voidButtons = screen.getAllByRole("button");
    fireEvent.click(voidButtons[0]);

    fireEvent.click(screen.getByText("Confirm Void"));

    await waitFor(() => {
      expect(mockVoidBid).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Void failed");
    });
  });

  it("handles pagination: more and reset", () => {
    const mockWithPagination = {
      ...mockPaginatedBids,
      isDone: false,
      continueCursor: "cursor-2",
    };
    mockUseQuery.mockReturnValue(mockWithPagination);

    render(<BidMonitor />);

    const moreButton = screen.getByRole("button", { name: /more/i });
    expect(moreButton).not.toBeDisabled();

    fireEvent.click(moreButton);

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        paginationOpts: expect.objectContaining({ cursor: "cursor-2" }),
      })
    );

    // Test reset
    const resetButton = screen.getByRole("button", { name: /reset/i });
    expect(resetButton).not.toBeDisabled();
    fireEvent.click(resetButton);

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        paginationOpts: expect.objectContaining({ cursor: null }),
      })
    );
  });
});
