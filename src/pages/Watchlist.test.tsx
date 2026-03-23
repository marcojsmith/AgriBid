import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { usePaginatedQuery } from "convex/react";

import Watchlist from "./Watchlist";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  usePaginatedQuery: vi.fn(),
}));

// Mock AuctionCard
vi.mock("@/components/auction/AuctionCard", () => ({
  AuctionCard: ({
    auction,
    isWatched,
  }: {
    auction: { title: string };
    isWatched: boolean;
  }) => (
    <div data-testid="auction-card">
      {auction.title} {isWatched ? "(Watched)" : ""}
    </div>
  ),
}));

describe("Watchlist Page", () => {
  const mockWatchedAuctions = [
    { _id: "auction1", title: "Watched Tractor" },
    { _id: "auction2", title: "Watched Baler" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWatchlist = () => {
    return render(
      <BrowserRouter>
        <Watchlist />
      </BrowserRouter>
    );
  };

  it("renders loading state", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    });

    renderWatchlist();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders watchlist items", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockWatchedAuctions,
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderWatchlist();
    expect(screen.getByText("My Watchlist")).toBeInTheDocument();

    const cards = screen.getAllByTestId("auction-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText(/Watched Tractor/i)).toBeInTheDocument();
    expect(screen.getByText(/Watched Baler/i)).toBeInTheDocument();
  });

  it("renders empty state", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderWatchlist();
    expect(
      screen.getByText(/You are not watching any auctions yet/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Explore Marketplace")).toBeInTheDocument();
  });

  it("calls loadMore when pagination button is clicked", () => {
    const loadMore = vi.fn();
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockWatchedAuctions,
      status: "CanLoadMore",
      loadMore,
    });

    renderWatchlist();
    const loadMoreBtn = screen.getByText("Load More");
    fireEvent.click(loadMoreBtn);

    expect(loadMore).toHaveBeenCalledWith(10);
  });

  it("renders loading more state", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockWatchedAuctions,
      status: "LoadingMore",
      loadMore: vi.fn(),
    });

    renderWatchlist();
    expect(screen.getByText(/Loading\.\.\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
  });
});
