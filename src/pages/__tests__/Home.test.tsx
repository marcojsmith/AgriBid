import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, usePaginatedQuery } from "convex/react";

import { useSession } from "@/lib/auth-client";

import Home from "../Home";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

// Mock FilterSidebar to keep it simple
vi.mock("@/components/FilterSidebar", () => ({
  FilterSidebar: () => <div data-testid="filter-sidebar">Filter Sidebar</div>,
}));

interface AuctionCardProps {
  auction: { title: string };
}

// Mock AuctionCard to keep it simple
vi.mock("@/components/auction", () => ({
  AuctionCard: ({ auction }: AuctionCardProps) => (
    <div data-testid="auction-card">{auction.title}</div>
  ),
}));

describe("Home Page", () => {
  const mockAuctions = [
    { _id: "1", title: "Auction 1" },
    { _id: "2", title: "Auction 2" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useSession as Mock).mockReturnValue({ isPending: false });
    (useQuery as Mock).mockReturnValue(["1"]); // Watched ID 1
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockAuctions,
      status: "Exhausted",
      loadMore: vi.fn(),
    });
  });

  const renderHome = () => {
    return render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
  };

  it("renders active auctions by default", () => {
    renderHome();
    expect(screen.getByText(/Active Auctions/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("auction-card")).toHaveLength(2);
    expect(screen.getByText("Auction 1")).toBeInTheDocument();
    expect(screen.getByText("Auction 2")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    (useSession as Mock).mockReturnValue({ isPending: true });
    renderHome();
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("renders empty state when no auctions found", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderHome();
    expect(screen.getByText(/No auctions found/i)).toBeInTheDocument();
  });

  it("toggles view mode", () => {
    renderHome();
    const compactBtn = screen.getByText(/Compact/i);
    const detailedBtn = screen.getByText(/Detailed/i);

    fireEvent.click(compactBtn);
    expect(compactBtn).toHaveAttribute("data-variant", "default");

    fireEvent.click(detailedBtn);
    expect(detailedBtn).toHaveAttribute("data-variant", "default");
  });

  it("toggles desktop sidebar", () => {
    renderHome();
    expect(screen.queryByTestId("filter-sidebar")).not.toBeInTheDocument();

    const showFiltersBtn = screen.getByText(/Show Filters/i);
    fireEvent.click(showFiltersBtn);

    expect(screen.getByTestId("filter-sidebar")).toBeInTheDocument();
    expect(screen.getByText(/Hide Filters/i)).toBeInTheDocument();
  });
});
