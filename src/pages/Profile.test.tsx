import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import Profile from "./Profile";

interface AuctionCardProps {
  auction: {
    title: string;
  };
  isWatched: boolean;
}

interface SellerInfo {
  _id: string;
  name?: string;
  isVerified: boolean;
  kycStatus?: "pending" | "verified" | "rejected";
  role: string;
  createdAt?: number;
  itemsSold: number;
  totalListings: number;
  bio?: string;
  companyName?: string;
  location?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  bankingVerified?: boolean;
  taxNumberVerified?: boolean;
  bidsPlaced: number;
  avgSalePrice?: number;
  avgRating?: number;
  reviewCount: number;
}

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Dialog component (same pattern as AuctionDetail.test.tsx)
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (o: boolean) => void;
  }) => (
    <div data-testid="dialog-root">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<{
              open?: boolean;
              onOpenChange?: (o: boolean) => void;
            }>,
            {
              open,
              onOpenChange,
            }
          );
        }
        return child;
      })}
    </div>
  ),
  DialogTrigger: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode;
    onOpenChange?: (o: boolean) => void;
  }) => (
    <div
      onClick={() => onOpenChange && onOpenChange(true)}
      data-testid="dialog-trigger"
    >
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (open ? <div data-testid="dialog-content">{children}</div> : null),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock Select to be a simple native select for easier testing
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange: (v: string) => void;
  }) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
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
    reviews: {
      getSellerReviews: { name: "reviews:getSellerReviews" },
    },
    watchlist: {
      getWatchedAuctionIds: { name: "watchlist:getWatchedAuctionIds" },
    },
    profileFlags: {
      reportProfile: { name: "profileFlags:reportProfile" },
    },
    messages: {
      startConversation: { name: "messages:startConversation" },
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
  const mockSellerInfo: SellerInfo = {
    _id: "user1",
    name: "John Dippenaar",
    isVerified: true,
    kycStatus: "verified",
    role: "seller",
    createdAt: new Date("2026-01-15").getTime(),
    itemsSold: 10,
    totalListings: 25,
    bio: "Commercial farmer specialising in dryland maize production.",
    companyName: "Dippenaar Farms",
    location: "Lichtenburg, North West Province",
    emailVerified: false,
    phoneVerified: false,
    bankingVerified: false,
    taxNumberVerified: false,
    bidsPlaced: 24,
    avgSalePrice: 485000,
    avgRating: undefined,
    reviewCount: 0,
  };

  const mockMyProfile = {
    userId: "user1",
    _id: "user1",
  };

  const mockListings = [
    { _id: "auction1", title: "Active Tractor", status: "active" },
    { _id: "auction2", title: "Sold Baler", status: "sold" },
  ];

  const mockReviews = [
    {
      _id: "review1",
      auctionId: "auction2",
      rating: 5,
      comment: "Great seller, smooth transaction.",
      createdAt: new Date("2026-02-10").getTime(),
      reviewerName: "Alice Bezuidenhout",
      response: {
        text: "Thank you for the smooth sale!",
        createdAt: new Date("2026-02-12").getTime(),
      },
    },
    {
      _id: "review2",
      auctionId: "auction3",
      rating: 4,
      comment: "Tractor as described.",
      createdAt: new Date("2026-01-20").getTime(),
    },
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

    (usePaginatedQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getSellerListings) {
        return {
          results: mockListings,
          status: "Exhausted",
          loadMore: vi.fn(),
        };
      }
      if (apiPath === mockApi.reviews.getSellerReviews) {
        return { results: [], status: "Exhausted", loadMore: vi.fn() };
      }
      return { results: [], status: "Exhausted", loadMore: vi.fn() };
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

  it("renders amber stars and review count when reviews exist", () => {
    const ratedSellerInfo = {
      ...mockSellerInfo,
      avgRating: 4,
      reviewCount: 2,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return ratedSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile();

    expect(screen.getByText("★★★★☆")).toBeInTheDocument();
    expect(screen.getByText("2 reviews")).toBeInTheDocument();
    expect(screen.queryByText("No reviews yet")).not.toBeInTheDocument();
  });

  it("renders singular review label for a single review", () => {
    const singleReviewSellerInfo = {
      ...mockSellerInfo,
      avgRating: 5,
      reviewCount: 1,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo)
        return singleReviewSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile();

    expect(screen.getByText("★★★★★")).toBeInTheDocument();
    expect(screen.getByText("1 review")).toBeInTheDocument();
  });

  it("renders Seller Rating trust item with average and count when reviewed", () => {
    const ratedSellerInfo = {
      ...mockSellerInfo,
      avgRating: 4.5,
      reviewCount: 2,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return ratedSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile();

    expect(screen.getByText("4.5 (2)")).toBeInTheDocument();
  });

  it("renders verified Seller Rating trust item when reviewed", () => {
    const ratedSellerInfo = {
      ...mockSellerInfo,
      avgRating: 4,
      reviewCount: 2,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return ratedSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile();

    const ratingLabel = screen.getByText("Seller Rating");
    const ratingItem = ratingLabel.parentElement;
    expect(ratingItem).not.toBeNull();
    expect(ratingItem).toHaveTextContent("4.0 (2)");
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
    expect(
      screen.getByRole("button", { name: /contact seller/i })
    ).toBeEnabled();
    const reportButton = screen.getByRole("button", {
      name: /report profile/i,
    });
    expect(reportButton).toBeInTheDocument();
    expect(reportButton).toBeEnabled();
  });

  describe("Report Profile dialog", () => {
    const setupNonOwner = () => {
      (useQuery as Mock).mockImplementation((apiPath) => {
        if (apiPath === mockApi.users.getMyProfile)
          return { ...mockMyProfile, userId: "other", _id: "other" };
        if (apiPath === mockApi.auctions.getSellerInfo) return mockSellerInfo;
        if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
        return null;
      });
    };

    const openReportDialog = () => {
      setupNonOwner();
      renderProfile("user1");
      fireEvent.click(screen.getByRole("button", { name: /report profile/i }));
      expect(screen.getByText("Report this Profile")).toBeInTheDocument();
    };

    it("opens the report dialog with reason select and details field", () => {
      openReportDialog();

      expect(screen.getByTestId("mock-select")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/Provide more context/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /submit report/i })
      ).toBeInTheDocument();
    });

    it("closes the dialog on cancel", () => {
      openReportDialog();

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(screen.queryByText("Report this Profile")).not.toBeInTheDocument();
    });

    it("shows an error toast when submitting without a reason", () => {
      openReportDialog();

      fireEvent.click(screen.getByRole("button", { name: /submit report/i }));

      expect(toast.error).toHaveBeenCalledWith(
        "Please select a reason for reporting"
      );
    });

    it("submits the report with reason and details, shows success toast, and closes the dialog", async () => {
      const mockReportProfile = vi.fn().mockResolvedValue({ success: true });
      (useMutation as Mock).mockReturnValue(mockReportProfile);

      openReportDialog();

      fireEvent.change(screen.getByTestId("mock-select"), {
        target: { value: "fake_account" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Provide more context/i), {
        target: { value: "Suspicious seller" },
      });
      fireEvent.click(screen.getByRole("button", { name: /submit report/i }));

      await waitFor(() => {
        expect(mockReportProfile).toHaveBeenCalledWith({
          reportedUserId: "user1",
          reason: "fake_account",
          details: "Suspicious seller",
        });
        expect(toast.success).toHaveBeenCalledWith("Thank you for your report");
      });
      expect(screen.queryByText("Report this Profile")).not.toBeInTheDocument();
    });

    it("submits undefined details when the details field is blank", async () => {
      const mockReportProfile = vi.fn().mockResolvedValue({ success: true });
      (useMutation as Mock).mockReturnValue(mockReportProfile);

      openReportDialog();

      fireEvent.change(screen.getByTestId("mock-select"), {
        target: { value: "abusive_behaviour" },
      });
      fireEvent.click(screen.getByRole("button", { name: /submit report/i }));

      await waitFor(() => {
        expect(mockReportProfile).toHaveBeenCalledWith({
          reportedUserId: "user1",
          reason: "abusive_behaviour",
          details: undefined,
        });
      });
    });

    it("shows an error toast and keeps the dialog open when submission fails", async () => {
      const mockReportProfile = vi
        .fn()
        .mockRejectedValue(new Error("You have already reported this profile"));
      (useMutation as Mock).mockReturnValue(mockReportProfile);

      openReportDialog();

      fireEvent.change(screen.getByTestId("mock-select"), {
        target: { value: "other" },
      });
      fireEvent.click(screen.getByRole("button", { name: /submit report/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "You have already reported this profile"
        );
      });
      expect(screen.getByText("Report this Profile")).toBeInTheDocument();
    });
  });

  describe("Contact Seller dialog", () => {
    const setupNonOwner = () => {
      (useQuery as Mock).mockImplementation((apiPath) => {
        if (apiPath === mockApi.users.getMyProfile)
          return { ...mockMyProfile, userId: "other", _id: "other" };
        if (apiPath === mockApi.auctions.getSellerInfo) return mockSellerInfo;
        if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
        return null;
      });
    };

    const renderProfileWithMessagesRoute = () => {
      return render(
        <MemoryRouter initialEntries={["/profile/user1"]}>
          <Routes>
            <Route path="/profile/:userId" element={<Profile />} />
            <Route
              path="/messages/:conversationId"
              element={<div data-testid="messages-thread">Thread</div>}
            />
          </Routes>
        </MemoryRouter>
      );
    };

    const openContactDialog = () => {
      setupNonOwner();
      renderProfileWithMessagesRoute();
      fireEvent.click(screen.getByRole("button", { name: /contact seller/i }));
      expect(
        screen.getByText("Send a message to start a conversation")
      ).toBeInTheDocument();
    };

    it("opens the contact dialog with a message field and send button", () => {
      openContactDialog();

      expect(screen.getByLabelText(/^message$/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /send message/i })
      ).toBeInTheDocument();
    });

    it("closes the dialog on cancel", () => {
      openContactDialog();

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
    });

    it("shows an error toast when submitting without a message", () => {
      openContactDialog();

      fireEvent.click(screen.getByRole("button", { name: /send message/i }));

      expect(toast.error).toHaveBeenCalledWith("Please enter a message");
    });

    it("starts a conversation and navigates to the thread on success", async () => {
      const mockStartConversation = vi.fn().mockResolvedValue("conv_new_123");
      (useMutation as Mock).mockImplementation((apiPath) => {
        if (apiPath === mockApi.messages.startConversation) {
          return mockStartConversation;
        }
        return vi.fn();
      });

      openContactDialog();

      fireEvent.change(screen.getByLabelText(/^message$/i), {
        target: { value: "Hi, is the tractor still available?" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send message/i }));

      await waitFor(() => {
        expect(mockStartConversation).toHaveBeenCalledWith({
          recipientId: "user1",
          initialMessage: "Hi, is the tractor still available?",
          auctionId: undefined,
        });
        expect(toast.success).toHaveBeenCalledWith("Message sent");
        expect(screen.getByTestId("messages-thread")).toBeInTheDocument();
      });
    });

    it("trims whitespace-only messages to empty and rejects submission", () => {
      const mockStartConversation = vi.fn();
      (useMutation as Mock).mockImplementation((apiPath) => {
        if (apiPath === mockApi.messages.startConversation) {
          return mockStartConversation;
        }
        return vi.fn();
      });

      openContactDialog();

      fireEvent.change(screen.getByLabelText(/^message$/i), {
        target: { value: "   " },
      });
      fireEvent.click(screen.getByRole("button", { name: /send message/i }));

      expect(toast.error).toHaveBeenCalledWith("Please enter a message");
      expect(mockStartConversation).not.toHaveBeenCalled();
    });

    it("shows an error toast and stays on the profile when the mutation fails", async () => {
      const mockStartConversation = vi
        .fn()
        .mockRejectedValue(new Error("You cannot message yourself"));
      (useMutation as Mock).mockImplementation((apiPath) => {
        if (apiPath === mockApi.messages.startConversation) {
          return mockStartConversation;
        }
        return vi.fn();
      });

      openContactDialog();

      fireEvent.change(screen.getByLabelText(/^message$/i), {
        target: { value: "Hello" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send message/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("You cannot message yourself");
      });
      expect(screen.queryByTestId("messages-thread")).not.toBeInTheDocument();
    });
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

  const setupReviewsSection = (
    reviews = mockReviews,
    sellerInfo: SellerInfo = {
      ...mockSellerInfo,
      avgRating: 4.5,
      reviewCount: 2,
    }
  ) => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return sellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });
    (usePaginatedQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getSellerListings) {
        return {
          results: mockListings,
          status: "Exhausted",
          loadMore: vi.fn(),
        };
      }
      if (apiPath === mockApi.reviews.getSellerReviews) {
        return { results: reviews, status: "Exhausted", loadMore: vi.fn() };
      }
      return { results: [], status: "Exhausted", loadMore: vi.fn() };
    });
  };

  it("renders the Reviews section with reviewer names, ratings, and comments", () => {
    setupReviewsSection();
    renderProfile();

    expect(screen.getByText("Reviews")).toBeInTheDocument();
    expect(screen.getByText("Alice Bezuidenhout")).toBeInTheDocument();
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(
      screen.getByText("Great seller, smooth transaction.")
    ).toBeInTheDocument();
    expect(screen.getByText("Tractor as described.")).toBeInTheDocument();
    expect(screen.getByText("Feb 2026")).toBeInTheDocument();
  });

  it("renders the seller response underneath a reviewed review", () => {
    setupReviewsSection();
    renderProfile();

    expect(screen.getByText("Seller response")).toBeInTheDocument();
    expect(
      screen.getByText("Thank you for the smooth sale!")
    ).toBeInTheDocument();
  });

  it("renders the Reviews empty state when the seller has no reviews", () => {
    setupReviewsSection([], mockSellerInfo);
    renderProfile();

    expect(screen.getByText("Reviews")).toBeInTheDocument();
    expect(screen.getByText("No reviews yet.")).toBeInTheDocument();
    expect(screen.queryByText("Seller response")).not.toBeInTheDocument();
  });

  it("still shows Sales History and its View all link when itemsSold > 0 but no sold listings are on the current page", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [
        {
          _id: "a1",
          title: "Active Tractor",
          status: "active",
          sellerId: "user1",
        },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderProfile();
    expect(screen.getByText("Sales History")).toBeInTheDocument();
    expect(screen.getByText(/View all sold listings/i)).toBeInTheDocument();
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

  it("renders Linked and no Pending values when granular fields are verified", () => {
    const verifiedSellerInfo = {
      ...mockSellerInfo,
      emailVerified: true,
      phoneVerified: true,
      bankingVerified: true,
      taxNumberVerified: true,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return verifiedSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");

    expect(screen.getByText("Linked")).toBeInTheDocument();
    expect(screen.queryByText("Not linked")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });

  it("renders Pending and Not linked when granular fields are unverified", () => {
    const unverifiedFieldsSellerInfo = {
      ...mockSellerInfo,
      emailVerified: false,
      phoneVerified: false,
      bankingVerified: false,
      taxNumberVerified: false,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo)
        return unverifiedFieldsSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");

    expect(screen.getByText("Not linked")).toBeInTheDocument();
    expect(screen.getAllByText("Pending")).toHaveLength(3);
    expect(screen.getByText("No reviews")).toBeInTheDocument();
  });

  it("renders granular trust values independently per field", () => {
    const mixedSellerInfo = {
      ...mockSellerInfo,
      isVerified: false,
      kycStatus: undefined,
      emailVerified: true,
      phoneVerified: false,
      bankingVerified: undefined,
      taxNumberVerified: undefined,
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockMyProfile;
      if (apiPath === mockApi.auctions.getSellerInfo) return mixedSellerInfo;
      if (apiPath === mockApi.watchlist.getWatchedAuctionIds) return [];
      return null;
    });

    renderProfile("user1");

    // Only Email is verified (identity badge shows "Unverified")
    expect(screen.getAllByText("Verified")).toHaveLength(1);
    // Identity, Phone and Tax Number are all pending
    expect(screen.getAllByText("Pending")).toHaveLength(3);
    expect(screen.getByText("Not linked")).toBeInTheDocument();
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
