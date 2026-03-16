import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useQuery, usePaginatedQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";

import { BidHistory } from "./BidHistory";

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

  it("anonymizes empty names correctly", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [
        {
          _id: "b1",
          amount: 100,
          bidderId: "u1",
          bidderName: "",
          timestamp: Date.now(),
        },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    render(<BidHistory auctionId={mockAuctionId} />);
    fireEvent.click(screen.getByText(/Bid History/i));

    expect(screen.getByText("Anonymous")).toBeInTheDocument();
  });

  it("anonymizes single character names correctly", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [
        {
          _id: "b1",
          amount: 100,
          bidderId: "u1",
          bidderName: "A B",
          timestamp: Date.now(),
        },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    render(<BidHistory auctionId={mockAuctionId} />);
    fireEvent.click(screen.getByText(/Bid History/i));

    expect(screen.getByText("A B")).toBeInTheDocument();
  });

  it("shows loading indicator for first page", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    });

    render(<BidHistory auctionId={mockAuctionId} />);
    fireEvent.click(screen.getByText(/Bid History/i));

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows loading more indicator", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockBids,
      status: "LoadingMore",
      loadMore: vi.fn(),
    });

    render(<BidHistory auctionId={mockAuctionId} />);
    fireEvent.click(screen.getByText(/Bid History/i));

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("handles auction fallback for highest bid amount", () => {
    (useQuery as Mock).mockImplementation((apiRef: { _path: string }) => {
      if (apiRef._path === "auctions:getAuctionById") return null;
      return null;
    });

    render(<BidHistory auctionId={mockAuctionId} />);
    fireEvent.click(screen.getByText(/Bid History/i));

    // Should render without crashing, highestBidAmount should be -1
    expect(screen.getByText(/Bid History/i)).toBeInTheDocument();
  });

  it("handles missing totalBids", () => {
    (useQuery as Mock).mockImplementation((apiRef: { _path: string }) => {
      if (apiRef._path === "auctions:getAuctionBidCount") return undefined;
      return null;
    });

    render(<BidHistory auctionId={mockAuctionId} />);
    fireEvent.click(screen.getByText(/Bid History/i));

    expect(screen.queryByText(/Showing/i)).not.toBeInTheDocument();
  });

  it("triggers loadMore on button click", () => {
    const loadMore = vi.fn();
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockBids,
      status: "CanLoadMore",
      loadMore,
    });

    render(<BidHistory auctionId={mockAuctionId} />);
    fireEvent.click(screen.getByText(/Bid History/i));

    fireEvent.click(screen.getByText(/Load More Bids/i));
    expect(loadMore).toHaveBeenCalledWith(20);
  });
});
