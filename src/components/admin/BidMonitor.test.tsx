import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Id } from "convex/_generated/dataModel";

import { BidMonitor } from "./BidMonitor";

const mockBids = [
  {
    _id: "bid-1" as Id<"bids">,
    timestamp: "2024-01-15T10:30:00Z",
    auctionTitle: "John Deere 8R",
    auctionLookupStatus: "FOUND" as const,
    bidderId: "bidder-123456789",
    amount: 150000,
    status: "active" as const,
  },
  {
    _id: "bid-2" as Id<"bids">,
    timestamp: "2024-01-15T10:25:00Z",
    auctionTitle: "Case IH Combine",
    auctionLookupStatus: "FOUND" as const,
    bidderId: "bidder-987654321",
    amount: 200000,
    status: "voided" as const,
  },
];

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
    mockUseQuery.mockReturnValue([]);
    render(<BidMonitor />);
    expect(screen.getByText("No bids yet")).toBeInTheDocument();
  });

  it("renders bids table with data", () => {
    mockUseQuery.mockReturnValue(mockBids);
    render(<BidMonitor />);
    expect(screen.getByText("John Deere 8R")).toBeInTheDocument();
    expect(screen.getByText("Case IH Combine")).toBeInTheDocument();
  });

  it("displays bid amounts formatted", () => {
    mockUseQuery.mockReturnValue(mockBids);
    render(<BidMonitor />);
    expect(screen.getByText("R 150,000")).toBeInTheDocument();
    expect(screen.getByText("R 200,000")).toBeInTheDocument();
  });

  it("displays live indicator", () => {
    mockUseQuery.mockReturnValue(mockBids);
    render(<BidMonitor />);
    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
  });

  it("shows line-through for voided bids", () => {
    mockUseQuery.mockReturnValue([mockBids[1]]);
    render(<BidMonitor />);
    const amount = screen.getByText("R 200,000");
    expect(amount.closest("span")).toHaveClass("line-through");
  });

  it("displays auction unavailable when lookup status is ERROR", () => {
    const errorBid = {
      ...mockBids[0],
      auctionLookupStatus: "ERROR" as const,
    };
    mockUseQuery.mockReturnValue([errorBid]);
    render(<BidMonitor />);
    expect(screen.getByText("Auction Data Unavailable")).toBeInTheDocument();
  });

  it("displays deleted auction when lookup status is NOT_FOUND", () => {
    const deletedBid = {
      ...mockBids[0],
      auctionLookupStatus: "NOT_FOUND" as const,
    };
    mockUseQuery.mockReturnValue([deletedBid]);
    render(<BidMonitor />);
    expect(screen.getByText("Unknown Auction (Deleted)")).toBeInTheDocument();
  });

  it("shows green color for active bids", () => {
    mockUseQuery.mockReturnValue([mockBids[0]]);
    render(<BidMonitor />);
    const amount = screen.getByText("R 150,000");
    expect(amount.closest("span")).toHaveClass("text-green-600");
  });
});
