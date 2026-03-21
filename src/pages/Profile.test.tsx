import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useQuery, usePaginatedQuery } from "convex/react";

import Profile from "./Profile";

interface AuctionCardProps {
  auction: {
    title: string;
  };
  isWatched: boolean;
}

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));

// Mock Convex API
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    users: {
      getMyProfile: { name: "users:getMyProfile" },
    },
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

// Mock AuctionCard to keep it simple
vi.mock("@/components/auction", () => ({
  AuctionCard: ({ auction, isWatched }: AuctionCardProps) => (
    <div data-testid="auction-card">
      {auction.title} {isWatched ? "(Watched)" : ""}
    </div>
  ),
}));

describe("Profile Page", () => {
  const mockSellerInfo = {
    _id: "user1",
    name: "John Doe",
    isVerified: true,
    role: "Seller",
    createdAt: new Date("2026-01-15").getTime(), // Joined in 2026
    itemsSold: 10,
    totalListings: 25,
  };

  const mockMyProfile = {
    userId: "user1",
    _id: "user1",
  };

  const mockListings = [
    { _id: "auction1", title: "Active Tractor", status: "active" },
    { _id: "auction2", title: "Sold Baler", status: "sold" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
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

  const renderProfile = (userId = "user1") => {
    return render(
      <MemoryRouter initialEntries={[`/profile/${userId}`]}>
        <Routes>
          <Route path="/profile/:userId" element={<Profile />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("renders loading state", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return undefined;
      if (apiPath === mockApi.auctions.getSellerInfo) return undefined;
      return null;
    });
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    });

    renderProfile();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders seller information", () => {
    renderProfile();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Verified Seller")).toBeInTheDocument();
    // mockSellerInfo createdAt is in 2026
    expect(screen.getByText(/Joined 2026/i)).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument(); // itemsSold
  });

  it("renders active and sold listings", () => {
    renderProfile();
    expect(screen.getByText("Active Auctions")).toBeInTheDocument();
    expect(screen.getByText("Sales History")).toBeInTheDocument();

    const cards = screen.getAllByTestId("auction-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText(/Active Tractor/i)).toBeInTheDocument();
    expect(screen.getByText(/Sold Baler/i)).toBeInTheDocument();
    expect(screen.getByText(/Watched/i)).toBeInTheDocument();
  });

  it("shows 'Manage Verification' button for owner", () => {
    renderProfile("user1");
    expect(screen.getByText("Manage Verification")).toBeInTheDocument();
  });

  it("does not show 'Manage Verification' button for non-owner", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile)
        return { ...mockMyProfile, userId: "other", _id: "other" };
      if (apiPath === mockApi.auctions.getSellerInfo) return mockSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");
    expect(screen.queryByText("Manage Verification")).not.toBeInTheDocument();
  });

  it("renders user-not-found view when seller does not exist", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getSellerInfo) return null;
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      return null;
    });

    renderProfile("unknown");
    expect(screen.getByText("User Not Found")).toBeInTheDocument();
  });

  it("calls loadMore when pagination button is clicked", async () => {
    const loadMore = vi.fn();
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockListings,
      status: "CanLoadMore",
      loadMore,
    });

    renderProfile();
    const loadMoreBtn = screen.getByText("Load More Listings");
    await act(async () => {
      fireEvent.click(loadMoreBtn);
    });

    expect(loadMore).toHaveBeenCalledWith(6);
  });

  it("renders sold history section when status is LoadingMore", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [], // No sold listings initially
      status: "LoadingMore",
      loadMore: vi.fn(),
    });

    // Mock seller info to have 0 total listings to test the empty string branch
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo)
        return { ...mockSellerInfo, totalListings: 0 };
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile();
    expect(screen.getByText("Sales History")).toBeInTheDocument();
    // Check pagination shows "Showing 0 of 0 Listings"
    expect(screen.getByText(/Showing 0 of 0 Listings/)).toBeInTheDocument();
  });

  it("handles watchedAuctionIds being undefined", () => {
    // Mock watchedAuctionIds as undefined
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return mockSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return undefined;
      return null;
    });

    renderProfile();
    // Should render without error
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders empty active listings state when status is Exhausted", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [{ _id: "a1", title: "Auction 1", status: "sold" }], // Only sold listings
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderProfile();
    expect(
      screen.getByText("No active auctions at this time.")
    ).toBeInTheDocument();
  });
});
