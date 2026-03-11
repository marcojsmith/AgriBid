import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useQuery, usePaginatedQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";

import { BidHistory } from "../bidding/BidHistory";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      getAuctionById: { _path: "auctions:getAuctionById" },
      getAuctionBidCount: { _path: "auctions:getAuctionBidCount" },
      getAuctionBids: { _path: "auctions:getAuctionBids" },
    },
  },
}));

describe("BidHistory", () => {
  const mockAuctionId = "auction123" as Id<"auctions">;
  const mockBids = [
    {
      _id: "bid1",
      amount: 2000,
      bidderName: "John Doe",
      timestamp: Date.now(),
    },
    {
      _id: "bid2",
      amount: 1000,
      bidderName: "Jane Smith",
      timestamp: Date.now() - 10000,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockImplementation((apiRef: { _path: string }) => {
      if (apiRef._path === "auctions:getAuctionById")
        return { currentPrice: 2000 };
      if (apiRef._path === "auctions:getAuctionBidCount") return 2;
      return null;
    });
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockBids,
      status: "Exhausted",
      loadMore: vi.fn(),
    });
  });

  it("renders empty state", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    render(<BidHistory auctionId={mockAuctionId} />);
    // Open accordion
    fireEvent.click(screen.getByText(/Bid History/i));

    expect(
      screen.getByText(/No bids have been placed yet/i)
    ).toBeInTheDocument();
  });

  it("renders bid list", () => {
    render(<BidHistory auctionId={mockAuctionId} />);
    fireEvent.click(screen.getByText(/Bid History/i));

    expect(screen.getByText("J*** D**")).toBeInTheDocument();
    expect(screen.getByText("J*** S***")).toBeInTheDocument();
    expect(screen.getByText(/Highest/i)).toBeInTheDocument();
    expect(screen.getByText(/R 2\s*000/)).toBeInTheDocument();
  });

  it("anonymizes names correctly", () => {
    render(<BidHistory auctionId={mockAuctionId} />);
    fireEvent.click(screen.getByText(/Bid History/i));

    expect(screen.getByText("J*** D**")).toBeInTheDocument();
  });

  it("shows load more button when more bids are available", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockBids,
      status: "CanLoadMore",
      loadMore: vi.fn(),
    });

    render(<BidHistory auctionId={mockAuctionId} />);
    fireEvent.click(screen.getByText(/Bid History/i));

    expect(screen.getByText(/Load More Bids/i)).toBeInTheDocument();
  });
});
