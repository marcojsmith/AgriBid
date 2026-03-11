import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter, useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";

import { useSession } from "@/lib/auth-client";

import AuctionDetail from "../AuctionDetail";

// Mock useParams
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(),
  };
});

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

interface AuctionHeaderProps {
  auction: { title: string };
}

// Mock child components to keep it focused on AuctionDetail logic
vi.mock("@/components/AuctionHeader", () => ({
  AuctionHeader: ({ auction }: AuctionHeaderProps) => (
    <div data-testid="auction-header">{auction.title}</div>
  ),
}));

vi.mock("@/components/ImageGallery", () => ({
  ImageGallery: () => <div data-testid="image-gallery">Image Gallery</div>,
}));

vi.mock("@/components/bidding", () => ({
  BiddingPanel: () => <div data-testid="bidding-panel">Bidding Panel</div>,
  BidHistory: () => <div data-testid="bid-history">Bid History</div>,
}));

vi.mock("@/components/SellerInfo", () => ({
  SellerInfo: () => <div data-testid="seller-info">Seller Info</div>,
}));

vi.mock("@/components/LoadingIndicator", () => ({
  LoadingIndicator: () => <div data-testid="loading-indicator">Loading...</div>,
}));

describe("AuctionDetail Page", () => {
  const mockAuction = {
    _id: "auction1",
    title: "Test Tractor",
    description: "Detailed description",
    sellerEmail: "seller@example.com",
    sellerId: "seller1",
    images: { front: "img.jpg" },
    conditionReportUrl: "https://example.com/report.pdf",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as Mock).mockReturnValue({ id: "auction1" });
    (useSession as Mock).mockReturnValue({
      data: { user: { email: "user@example.com" } },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(mockAuction);
    (useMutation as Mock).mockReturnValue(vi.fn());
  });

  const renderPage = () => {
    return render(
      <BrowserRouter>
        <AuctionDetail />
      </BrowserRouter>
    );
  };

  it("renders auction details when data is loaded", () => {
    renderPage();
    expect(screen.getByTestId("auction-header")).toHaveTextContent(
      "Test Tractor"
    );
    expect(screen.getByText("Detailed description")).toBeInTheDocument();
    expect(screen.getByTestId("bidding-panel")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderPage();
    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("renders not found state", () => {
    (useQuery as Mock).mockReturnValue(null);
    renderPage();
    expect(screen.getByText(/Auction Not Found/i)).toBeInTheDocument();
  });

  it("shows report button for non-owners", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /^Report$/ })
    ).toBeInTheDocument();
  });

  it("hides report button for owners", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { email: "seller@example.com" } },
      isPending: false,
    });
    renderPage();
    expect(
      screen.queryByRole("button", { name: /^Report$/ })
    ).not.toBeInTheDocument();
  });

  it("opens condition report", () => {
    renderPage();
    const viewReportBtn = screen.getByText(/View Report/i);
    fireEvent.click(viewReportBtn);
    expect(screen.getByTitle("Condition Report")).toBeInTheDocument();
  });
});
