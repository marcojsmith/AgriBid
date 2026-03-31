import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";

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
  useMutation: vi.fn(() => vi.fn()),
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

  it("shows Edit button only for profile owner", () => {
    renderProfile("user1");
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("does not show Edit button for non-owner", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile)
        return { userId: "other", _id: "other" };
      if (apiPath === mockApi.auctions.getSellerInfo) return mockSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });
    renderProfile("user1");
    expect(
      screen.queryByRole("button", { name: /edit/i })
    ).not.toBeInTheDocument();
  });

  it("opens edit form when Edit button is clicked", () => {
    renderProfile("user1");
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
  });

  it("cancels editing and restores view mode", () => {
    renderProfile("user1");
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByLabelText(/bio/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("calls updateMyProfile and closes form on save", async () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined);
    (useMutation as Mock).mockReturnValue(mockMutate);

    renderProfile("user1");
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    fireEvent.change(screen.getByLabelText(/bio/i), {
      target: { value: "New bio text" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ bio: "New bio text" })
    );
    expect(screen.queryByLabelText(/bio/i)).not.toBeInTheDocument();
  });

  it("shows Saving... while mutation is in-flight", async () => {
    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    (useMutation as Mock).mockReturnValue(() => pendingPromise);

    renderProfile("user1");
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    // Click save — mutation is pending
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(screen.getByText("Saving...")).toBeInTheDocument();

    // Resolve the mutation
    await act(async () => {
      resolvePromise!();
    });

    expect(screen.queryByText("Saving...")).not.toBeInTheDocument();
  });

  it("submits undefined for empty trimmed fields", async () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined);
    (useMutation as Mock).mockReturnValue(mockMutate);

    renderProfile("user1");
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    // Leave all fields empty
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    expect(mockMutate).toHaveBeenCalledWith({
      bio: undefined,
      location: undefined,
      companyName: undefined,
    });
  });

  it("logs error and stays in edit mode when save fails", async () => {
    const mockMutate = vi.fn().mockRejectedValue(new Error("Network error"));
    (useMutation as Mock).mockReturnValue(mockMutate);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderProfile("user1");
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    expect(spy).toHaveBeenCalled();
    // Edit form should still be open after failure
    expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it("updates location and companyName fields in edit form", async () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined);
    (useMutation as Mock).mockReturnValue(mockMutate);

    renderProfile("user1");
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: "Durban, KZN" },
    });
    fireEvent.change(screen.getByLabelText(/company name/i), {
      target: { value: "Sunrise Farms" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        location: "Durban, KZN",
        companyName: "Sunrise Farms",
      })
    );
  });

  it("shows admin activity item when user has admin role", () => {
    const adminSellerInfo = {
      ...mockSellerInfo,
      name: "Admin User",
      role: "admin",
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return adminSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds)
        return ["auction1"];
      return null;
    });

    renderProfile("user1");

    expect(screen.getByText("Admin role assigned")).toBeInTheDocument();
  });

  it("handles single-word name for getInitials", () => {
    const shortNameSellerInfo = {
      ...mockSellerInfo,
      name: "Bob",
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo)
        return shortNameSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds)
        return ["auction1"];
      return null;
    });

    renderProfile("user1");

    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows verification requested activity for non-admin user", () => {
    renderProfile("user1");

    expect(screen.getByText("Verification requested")).toBeInTheDocument();
  });

  it("shows Complete Verification button for unverified owner", () => {
    const unverifiedSellerInfo = {
      ...mockSellerInfo,
      isVerified: false,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo)
        return unverifiedSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");

    expect(
      screen.getByRole("button", { name: /complete verification/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("shows — for Avg Sale when avgSalePrice is undefined", () => {
    const noAvgSellerInfo = {
      ...mockSellerInfo,
      avgSalePrice: undefined,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return noAvgSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");

    expect(screen.getByText("Avg Sale")).toBeInTheDocument();
  });

  it("renders ?? initials when name is undefined", () => {
    const noNameSellerInfo = {
      ...mockSellerInfo,
      name: undefined,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return noNameSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");

    expect(screen.getByText("??")).toBeInTheDocument();
  });

  it("shows Unknown date for activity when createdAt is undefined", () => {
    const noDateSellerInfo = {
      ...mockSellerInfo,
      createdAt: undefined,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return noDateSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");

    expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(1);
  });

  it("shows unverified badge for unverified seller", () => {
    const unverifiedSellerInfo = {
      ...mockSellerInfo,
      isVerified: false,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo)
        return unverifiedSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");

    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("shows Admin badge for admin role", () => {
    const adminSellerInfo = {
      ...mockSellerInfo,
      role: "admin",
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return adminSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");

    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("does not show Complete Verification button for verified owner", () => {
    renderProfile("user1");

    expect(
      screen.queryByRole("button", { name: /complete verification/i })
    ).not.toBeInTheDocument();
  });

  it("renders loading indicator during LoadingMore pagination", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockListings,
      status: "LoadingMore",
      loadMore: vi.fn(),
    });

    renderProfile();

    const loadingElements = screen.getAllByText("Loading...");
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it("does not show Complete Verification button for non-owner", () => {
    const unverifiedSellerInfo = {
      ...mockSellerInfo,
      isVerified: false,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile)
        return { ...mockMyProfile, userId: "other", _id: "other" };
      if (apiPath === mockApi.auctions.getSellerInfo)
        return unverifiedSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");

    expect(
      screen.queryByRole("button", { name: /complete verification/i })
    ).not.toBeInTheDocument();
  });
});
