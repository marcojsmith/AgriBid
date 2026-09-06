import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useQuery, usePaginatedQuery } from "convex/react";

import SellerListings from "./SellerListings";

interface AuctionCardProps {
  auction: {
    title: string;
  };
  isWatched: boolean;
}

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    auctions: {
      getSellerInfo: { name: "auctions:getSellerInfo" },
      getSellerListings: { name: "auctions:getSellerListings" },
    },
    watchlist: {
      getWatchedAuctionIds: { name: "watchlist:getWatchedAuctionIds" },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

vi.mock("@/components/auction/AuctionCard", () => ({
  AuctionCard: ({ auction, isWatched }: AuctionCardProps) => (
    <div data-testid="auction-card">
      {auction.title} {isWatched ? "(Watched)" : ""}
    </div>
  ),
}));

vi.mock("@/components/LoadingIndicator", () => ({
  LoadingIndicator: () => <div data-testid="loading-indicator">Loading...</div>,
}));

describe("SellerListings Page", () => {
  const mockSellerInfo = {
    name: "John Dippenaar",
    isVerified: true,
    role: "seller",
    itemsSold: 10,
    activeListings: 3,
    totalListings: 25,
    bidsPlaced: 24,
  };

  const mockListings = [
    { _id: "auction1", title: "Active Tractor", status: "active" },
    { _id: "auction2", title: "Active Combine", status: "active" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getSellerInfo) return mockSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds)
        return ["auction1"];
      return null;
    });

    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockListings,
      status: "Exhausted",
      loadMore: vi.fn(),
    });
  });

  const renderSellerListings = (
    status: "active" | "sold" = "active",
    userId = "user1"
  ) => {
    return render(
      <MemoryRouter
        initialEntries={[
          `/sellers/${userId}/listings${status === "sold" ? "/sold" : ""}`,
        ]}
      >
        <Routes>
          <Route
            path="/sellers/:userId/listings"
            element={<SellerListings status="active" />}
          />
          <Route
            path="/sellers/:userId/listings/sold"
            element={<SellerListings status="sold" />}
          />
        </Routes>
      </MemoryRouter>
    );
  };

  it("renders the seller's name in the title for the active page", () => {
    renderSellerListings("active");
    expect(
      screen.getByText(/Active Auctions by John Dippenaar/i)
    ).toBeInTheDocument();
  });

  it("renders the seller's name in the title for the sold page", () => {
    renderSellerListings("sold");
    expect(
      screen.getByText(/Past Sales by John Dippenaar/i)
    ).toBeInTheDocument();
  });

  it("falls back to 'this seller' when sellerInfo is unavailable", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getSellerInfo) return null;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderSellerListings("active");
    expect(
      screen.getByText(/Active Auctions by this seller/i)
    ).toBeInTheDocument();
  });

  it("renders auction cards for the fetched page", () => {
    renderSellerListings("active");
    const cards = screen.getAllByTestId("auction-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText(/Active Tractor \(Watched\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Combine/i)).toBeInTheDocument();
  });

  it("renders the empty state when there are no active results", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderSellerListings("active");
    expect(
      screen.getByText("No active auctions at this time.")
    ).toBeInTheDocument();
  });

  it("renders the empty state when there are no sold results", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderSellerListings("sold");
    expect(screen.getByText("No past sales at this time.")).toBeInTheDocument();
  });

  it("renders a back link to the seller's profile", () => {
    renderSellerListings("active");
    const backLink = screen.getByRole("link", { name: /back to profile/i });
    expect(backLink).toHaveAttribute("href", "/profile/user1");
  });

  it("queries seller listings with the active statusFilter", () => {
    renderSellerListings("active");
    expect(usePaginatedQuery).toHaveBeenCalledWith(
      mockApi.auctions.getSellerListings,
      { userId: "user1", statusFilter: "active" },
      { initialNumItems: 12 }
    );
  });

  it("queries seller listings with the sold statusFilter", () => {
    renderSellerListings("sold");
    expect(usePaginatedQuery).toHaveBeenCalledWith(
      mockApi.auctions.getSellerListings,
      { userId: "user1", statusFilter: "sold" },
      { initialNumItems: 12 }
    );
  });

  it("renders loading state while fetching the first page", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    });

    renderSellerListings("active");
    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("calls loadMore when the pagination button is clicked", () => {
    const loadMore = vi.fn();
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockListings,
      status: "CanLoadMore",
      loadMore,
    });

    renderSellerListings("active");
    fireEvent.click(screen.getByText("Load More Listings"));
    expect(loadMore).toHaveBeenCalledWith(12);
  });

  it("shows a disabled loading button while loading more", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockListings,
      status: "LoadingMore",
      loadMore: vi.fn(),
    });

    renderSellerListings("active");
    const loadMoreBtn = screen.getByRole("button", { name: /loading/i });
    expect(loadMoreBtn).toBeDisabled();
  });

  it("handles watchedAuctionIds being undefined", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getSellerInfo) return mockSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return undefined;
      return null;
    });

    renderSellerListings("active");
    expect(screen.getByText(/Active Tractor/i)).toBeInTheDocument();
    expect(screen.queryByText(/\(Watched\)/i)).not.toBeInTheDocument();
  });
});
