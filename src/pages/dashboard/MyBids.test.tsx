import React from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, usePaginatedQuery } from "convex/react";

import MyBids from "./MyBids";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));

// Mock Convex API
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    auctions: {
      queries: {
        getMyBidsStats: { name: "auctions/queries:getMyBidsStats" },
        getMyBids: { name: "auctions/queries:getMyBids" },
      },
      getMyBidsCount: { name: "auctions:getMyBidsCount" },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

// Mock CountdownTimer to avoid timer logic issues in tests
vi.mock("@/components/CountdownTimer", () => ({
  CountdownTimer: ({
    endTime,
    className,
  }: {
    endTime: number;
    className?: string;
  }) => (
    <div data-testid="countdown-timer" className={className}>
      Ends: {new Date(endTime).toISOString()}
    </div>
  ),
}));

// Mock select component since it's a Radix primitive that can be hard to test
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      aria-label="Sort bids"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <>{placeholder}</>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({ value }: { children?: React.ReactNode; value: string }) => {
    // We want to avoid rendering complex children like divs inside an option
    // In many tests, children might be a div with an icon and text.
    // For simplicity, we'll just use the value as the text if children is complex,
    // or try to render children and hope for the best if it's simple.
    return <option value={value}>{value}</option>;
  },
}));

vi.mock("@/components/ui/tabs", () => {
  let currentOnValueChange: ((v: string) => void) | null = null;
  return {
    Tabs: ({
      children,
      onValueChange,
    }: {
      children: React.ReactNode;
      onValueChange: (v: string) => void;
    }) => {
      currentOnValueChange = onValueChange;
      return <div>{children}</div>;
    },
    TabsList: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    TabsTrigger: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => (
      <button onClick={() => currentOnValueChange?.(value)}>{children}</button>
    ),
    TabsContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

describe("MyBids Page", () => {
  const mockStats = {
    totalActive: 2,
    winningCount: 1,
    outbidCount: 1,
    totalExposure: 5000,
  };

  const mockAuctions = [
    {
      _id: "auction1",
      title: "Winning Auction",
      make: "John Deere",
      model: "8RX",
      currentPrice: 3000,
      minIncrement: 100,
      myHighestBid: 3000,
      bidCount: 5,
      status: "active",
      endTime: Date.now() + 10000,
      isWinning: true,
      isWon: false,
      isOutbid: false,
      isCancelled: false,
      images: { front: "image1.jpg" },
      lastBidTimestamp: Date.now() - 1000,
    },
    {
      _id: "auction2",
      title: "Outbid Auction",
      make: "Case IH",
      model: "Magnum",
      currentPrice: 2500,
      minIncrement: 100,
      myHighestBid: 2000,
      bidCount: 3,
      status: "active",
      endTime: Date.now() + 20000,
      isWinning: false,
      isWon: false,
      isOutbid: true,
      isCancelled: false,
      images: { front: "image2.jpg" },
      lastBidTimestamp: Date.now() - 5000,
    },
    {
      _id: "auction3",
      title: "Won Auction",
      make: "Fendt",
      model: "1050",
      currentPrice: 10000,
      minIncrement: 500,
      myHighestBid: 10000,
      bidCount: 10,
      status: "sold",
      isWinning: false,
      isWon: true,
      isOutbid: false,
      isCancelled: false,
      images: {},
      lastBidTimestamp: Date.now() - 10000,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks with matching for full API paths
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.queries.getMyBidsStats) return mockStats;
      if (apiPath === mockApi.auctions.getMyBidsCount) return 3;
      return null;
    });

    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockAuctions,
      status: "Exhausted",
      loadMore: vi.fn(),
    });
  });

  const renderMyBids = () => {
    return render(
      <BrowserRouter>
        <MyBids />
      </BrowserRouter>
    );
  };

  it("renders the page title and stats", () => {
    renderMyBids();
    expect(screen.getByText("My Bids")).toBeInTheDocument();
    expect(screen.getByText("Active Bids")).toBeInTheDocument();

    // stats values - find the card containing "Active Bids" then check for "2"
    const activeBidsText = screen.getByText("Active Bids");
    const activeBidsCard = activeBidsText.parentElement;
    expect(
      within(activeBidsCard as HTMLElement).getByText("2")
    ).toBeInTheDocument();

    const winningText = screen.getByText("Winning", { selector: "p" });
    const winningCard = winningText.parentElement;
    expect(
      within(winningCard as HTMLElement).getByText("1")
    ).toBeInTheDocument();
  });

  it("renders the list of auctions", () => {
    renderMyBids();
    expect(screen.getByText("Winning Auction")).toBeInTheDocument();
    expect(screen.getByText("Outbid Auction")).toBeInTheDocument();
    expect(screen.getByText("Won Auction")).toBeInTheDocument();
  });

  it("shows loading state when first page is loading", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    });

    renderMyBids();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders empty state when no auctions are found", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderMyBids();
    expect(
      screen.getByText(/You haven’t placed any bids yet/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Browse Auctions")).toBeInTheDocument();
  });

  it("filters auctions by status", async () => {
    renderMyBids();

    // Default is "All", should show all 3
    expect(screen.getByText("Winning Auction")).toBeInTheDocument();
    expect(screen.getByText("Outbid Auction")).toBeInTheDocument();
    expect(screen.getByText("Won Auction")).toBeInTheDocument();

    // Click "Winning" filter
    await act(async () => {
      fireEvent.click(screen.getByText("Winning", { selector: "button" }));
    });
    expect(screen.getByText("Winning Auction")).toBeInTheDocument();
    expect(screen.queryByText("Outbid Auction")).not.toBeInTheDocument();
    expect(screen.queryByText("Won Auction")).not.toBeInTheDocument();

    // Click "Outbid" filter
    await act(async () => {
      fireEvent.click(screen.getByText("Outbid", { selector: "button" }));
    });
    expect(screen.queryByText("Winning Auction")).not.toBeInTheDocument();
    expect(screen.getByText("Outbid Auction")).toBeInTheDocument();
    expect(screen.queryByText("Won Auction")).not.toBeInTheDocument();

    // Click "Ended" filter
    await act(async () => {
      fireEvent.click(screen.getByText("Ended", { selector: "button" }));
    });
    expect(screen.queryByText("Winning Auction")).not.toBeInTheDocument();
    expect(screen.queryByText("Outbid Auction")).not.toBeInTheDocument();
    expect(screen.getByText("Won Auction")).toBeInTheDocument();
  });

  it("sorts auctions by highest bid", async () => {
    renderMyBids();

    const select = screen.getByLabelText("Sort bids");
    await act(async () => {
      fireEvent.change(select, { target: { value: "bid" } });
    });

    // Get all auction titles after sorting
    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);

    // Highest bids: Won (10000), Winning (3000), Outbid (2000)
    expect(titles[0]).toBe("Won Auction");
    expect(titles[1]).toBe("Winning Auction");
    expect(titles[2]).toBe("Outbid Auction");
  });

  it("sorts auctions by recent activity", async () => {
    renderMyBids();

    const select = screen.getByLabelText("Sort bids");
    await act(async () => {
      fireEvent.change(select, { target: { value: "recent" } });
    });

    // Get all auction titles after sorting
    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);

    // Most recent: Winning (-1000), Outbid (-5000), Won (-10000)
    expect(titles[0]).toBe("Winning Auction");
    expect(titles[1]).toBe("Outbid Auction");
    expect(titles[2]).toBe("Won Auction");
  });

  it("calls loadMore when button is clicked", () => {
    const loadMore = vi.fn();
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockAuctions,
      status: "CanLoadMore",
      loadMore,
    });

    renderMyBids();
    const loadMoreBtn = screen.getByText("Load More");
    fireEvent.click(loadMoreBtn);

    expect(loadMore).toHaveBeenCalledWith(10);
  });

  it("shows loading indicator when loading more", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockAuctions,
      status: "LoadingMore",
      loadMore: vi.fn(),
    });

    renderMyBids();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
  });

  it("displays correct status badges and icons", () => {
    renderMyBids();

    // Check "WINNING" badge
    const winningCard = screen
      .getByText("Winning Auction")
      .closest("div[class*='group']");
    expect(
      within(winningCard as HTMLElement).getByText("WINNING")
    ).toBeInTheDocument();

    // Check "OUTBID" badge
    const outbidCard = screen
      .getByText("Outbid Auction")
      .closest("div[class*='group']");
    expect(
      within(outbidCard as HTMLElement).getByText("OUTBID")
    ).toBeInTheDocument();
    expect(
      within(outbidCard as HTMLElement).getByText("Outbid!")
    ).toBeInTheDocument(); // Pulse text

    // Check "WON" badge
    const wonCard = screen
      .getByText("Won Auction")
      .closest("div[class*='group']");
    expect(within(wonCard as HTMLElement).getByText("WON")).toBeInTheDocument();
  });
});
