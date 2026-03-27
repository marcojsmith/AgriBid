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

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));

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

vi.mock("@/components/auction/AuctionCard", () => ({
  AuctionCard: ({ auction, isWatched }: AuctionCardProps) => (
    <div data-testid="auction-card">
      {auction.title} {isWatched ? "(Watched)" : ""}
    </div>
  ),
}));

describe("Profile Page", () => {
  const mockSellerInfo = {
    _id: "user1",
    name: "John Dippenaar",
    isVerified: true,
    role: "seller",
    createdAt: new Date("2026-01-15").getTime(),
    itemsSold: 10,
    totalListings: 25,
    bio: "Commercial farmer specialising in dryland maize production.",
    companyName: "Dippenaar Farms",
    location: "Lichtenburg, North West Province",
    bidsPlaced: 24,
    avgSalePrice: 485000,
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

  it("renders seller name", () => {
    renderProfile();
    expect(screen.getByText("John Dippenaar")).toBeInTheDocument();
  });

  it("renders member since with month and year format", () => {
    renderProfile();
    expect(screen.getByText(/January 2026/i)).toBeInTheDocument();
  });

  it("renders bio text when available", () => {
    renderProfile();
    expect(
      screen.getByText(
        "Commercial farmer specialising in dryland maize production."
      )
    ).toBeInTheDocument();
  });

  it("renders location with icon when available", () => {
    renderProfile();
    expect(
      screen.getByText(/Lichtenburg, North West Province/i)
    ).toBeInTheDocument();
  });

  it("renders placeholder rating", () => {
    renderProfile();
    expect(screen.getByText("★★★★★")).toBeInTheDocument();
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
  });

  it("shows non-owner buttons for non-owner", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile)
        return { ...mockMyProfile, userId: "other", _id: "other" };
      if (apiPath === mockApi.auctions.getSellerInfo) return mockSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");
    expect(screen.getByText("Contact Seller")).toBeInTheDocument();
    expect(screen.getByText("Report Profile")).toBeInTheDocument();
  });

  it("renders Active Auctions section with cards", () => {
    renderProfile();
    expect(screen.getByText("Active Auctions")).toBeInTheDocument();
    const cards = screen.getAllByTestId("auction-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText(/Active Tractor/i)).toBeInTheDocument();
    expect(screen.getByText(/Watched/i)).toBeInTheDocument();
  });

  it("renders Past Sales section with sold cards", () => {
    renderProfile();
    expect(screen.getByText("Sales History")).toBeInTheDocument();
    expect(screen.getByText(/Sold Baler/i)).toBeInTheDocument();
  });

  it("renders empty active listings state when no active auctions", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [{ _id: "a1", title: "Auction 1", status: "sold" }],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderProfile();
    expect(
      screen.getByText("No active auctions at this time.")
    ).toBeInTheDocument();
  });

  it("renders Recent Activity section placeholder", () => {
    renderProfile();
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(screen.getByText("Account created")).toBeInTheDocument();
  });

  it("renders Trust & Compliance section placeholder", () => {
    renderProfile();
    expect(screen.getByText("Trust & Compliance")).toBeInTheDocument();
    expect(screen.getByText("Identity")).toBeInTheDocument();
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

  it("handles watchedAuctionIds being undefined", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return mockSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return undefined;
      return null;
    });

    renderProfile();
    expect(screen.getByText("John Dippenaar")).toBeInTheDocument();
  });

  it("hides bio section when bio is empty", () => {
    const sellerInfoNoBio = {
      ...mockSellerInfo,
      bio: undefined,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return sellerInfoNoBio;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile();
    expect(
      screen.queryByText(
        "Commercial farmer specialising in dryland maize production."
      )
    ).not.toBeInTheDocument();
  });

  it("hides location section when location is empty", () => {
    const sellerInfoNoLocation = {
      ...mockSellerInfo,
      location: undefined,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo)
        return sellerInfoNoLocation;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile();
    expect(
      screen.queryByText(/Lichtenburg, North West Province/i)
    ).not.toBeInTheDocument();
  });
});
