import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter, useSearchParams } from "react-router-dom";
import { useQuery, usePaginatedQuery } from "convex/react";

import { useSession } from "@/lib/auth-client";

import Home from "./Home";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  };
});

// Mock FilterSidebar to keep it simple
vi.mock("@/components/FilterSidebar", () => ({
  FilterSidebar: ({
    onClose,
    "data-testid": testid = "filter-sidebar",
  }: {
    onClose?: () => void;
    "data-testid"?: string;
  }) => (
    <div data-testid={testid}>
      Filter Sidebar
      {onClose && <button onClick={onClose}>Close Sidebar</button>}
    </div>
  ),
}));

// Mock AuctionCard to keep it simple
vi.mock("@/components/auction/AuctionCard", () => ({
  AuctionCard: ({
    auction,
    viewMode,
  }: {
    auction: { title: string };
    viewMode: string;
  }) => (
    <div data-testid="auction-card">
      {auction.title} ({viewMode})
    </div>
  ),
}));

// Mock AuctionCardSkeleton
vi.mock("@/components/AuctionCardSkeleton", () => ({
  AuctionCardSkeleton: () => (
    <div data-testid="auction-skeleton">Loading...</div>
  ),
}));

// Mock LoadingIndicator
vi.mock("@/components/LoadingIndicator", () => ({
  LoadingPage: ({ message }: { message: string }) => <div>{message}</div>,
  LoadingIndicator: () => <div data-testid="loading-indicator">Spinner</div>,
}));

describe("Home Page Full Coverage", () => {
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

    // Default desktop matchMedia
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    (useSearchParams as Mock).mockReturnValue([new URLSearchParams(), vi.fn()]);
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
    expect(screen.getByText(/Auction 1 \(detailed\)/i)).toBeInTheDocument();
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

  it("toggles view mode manually", () => {
    renderHome();
    const compactBtn = screen.getByText(/Compact/i);
    fireEvent.click(compactBtn);
    expect(screen.getByText(/Auction 1 \(compact\)/i)).toBeInTheDocument();

    const detailedBtn = screen.getByText(/Detailed/i);
    fireEvent.click(detailedBtn);
    expect(screen.getByText(/Auction 1 \(detailed\)/i)).toBeInTheDocument();
  });

  it("toggles desktop sidebar", () => {
    renderHome();
    expect(screen.getByText(/Show Filters/i)).toBeInTheDocument();

    const showFiltersBtn = screen.getByText(/Show Filters/i);
    fireEvent.click(showFiltersBtn);

    const desktopSidebar = screen.getByTestId("desktop-sidebar");
    expect(within(desktopSidebar).getByTestId("filter-sidebar")).toBeVisible();
    expect(screen.getByText(/Hide Filters/i)).toBeInTheDocument();
  });

  it("renders search results header and clear link", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("q=tractor"),
      vi.fn(),
    ]);
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [{ _id: "3", title: "Tractor X" }],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderHome();
    expect(screen.getByText(/Results for "tractor"/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear search results/i)).toBeInTheDocument();
  });

  it("renders different status filters", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("status=closed"),
      vi.fn(),
    ]);
    renderHome();
    expect(screen.getByText(/Closed Auctions/i)).toBeInTheDocument();

    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("status=all"),
      vi.fn(),
    ]);
    renderHome();
    expect(screen.getByText(/All Auctions/i)).toBeInTheDocument();
  });

  it("renders filters applied indicator", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("make=John+Deere"),
      vi.fn(),
    ]);
    renderHome();
    expect(screen.getByText(/Filters Applied/i)).toBeInTheDocument();
  });

  it("initializes in mobile view (compact) when viewport is small", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderHome();

    // Mobile view defaults to compact
    expect(screen.getByText(/Auction 1 \(compact\)/i)).toBeInTheDocument();
  });

  it("shows mobile filter overlay", () => {
    // Mock mobile viewport
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderHome();
    const filterBtn = screen.getByLabelText(/Filters/i);
    fireEvent.click(filterBtn);

    const overlay = screen.getByTestId("mobile-filter-overlay");
    expect(within(overlay).getByTestId("filter-sidebar")).toBeVisible();

    // Click backdrop to close
    const backdrop = screen.getByLabelText(/Close filters/i);
    fireEvent.click(backdrop);
    expect(
      screen.queryByTestId("mobile-filter-overlay")
    ).not.toBeInTheDocument();
  });

  it("closes mobile filters via onClose prop", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderHome();
    fireEvent.click(screen.getByLabelText(/Filters/i));

    const overlay = screen.getByTestId("mobile-filter-overlay");
    const closeBtn = within(overlay).getByText(/Close Sidebar/i);
    fireEvent.click(closeBtn);
    expect(
      screen.queryByTestId("mobile-filter-overlay")
    ).not.toBeInTheDocument();
  });

  it("renders load more button and status", () => {
    const mockLoadMore = vi.fn();
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockAuctions,
      status: "CanLoadMore",
      loadMore: mockLoadMore,
    });

    renderHome();
    const loadMoreBtn = screen.getByText(/Load More Auctions/i);
    fireEvent.click(loadMoreBtn);
    expect(mockLoadMore).toHaveBeenCalledWith(12);
  });

  it("renders loading more state", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockAuctions,
      status: "LoadingMore",
      loadMore: vi.fn(),
    });

    renderHome();
    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("renders skeleton during first page load", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    });

    renderHome();
    expect(screen.getAllByTestId("auction-skeleton")).toHaveLength(3);
  });

  it("updates view when media query matches change", () => {
    let changeHandler: () => void = () => {};
    const mql = {
      matches: false,
      media: "(max-width: 768px)",
      onchange: null,
      addEventListener: vi.fn((event, handler) => {
        if (event === "change") changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { rerender } = render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    expect(screen.getByText(/Auction 1 \(detailed\)/i)).toBeInTheDocument();

    // Simulate media query change
    act(() => {
      mql.matches = true;
      changeHandler();
    });

    rerender(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    expect(screen.getByText(/Auction 1 \(compact\)/i)).toBeInTheDocument();
  });

  it("renders clear search results link and clears it", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("q=tractor"),
      vi.fn(),
    ]);
    renderHome();

    const clearLink = screen.getByText(/Clear search results/i);
    expect(clearLink).toHaveAttribute("href", "/");
  });

  it("renders clear all filters link in empty state and clears it", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
    });
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("make=John+Deere"),
      vi.fn(),
    ]);

    renderHome();
    const clearLink = screen.getByText(/Clear All Filters/i);
    expect(clearLink).toHaveAttribute("href", "/");
  });

  it("handles missing search query and filters gracefully", () => {
    (useSearchParams as Mock).mockReturnValue([new URLSearchParams(), vi.fn()]);
    renderHome();
    expect(screen.getByText(/Active Auctions/i)).toBeInTheDocument();
    expect(screen.queryByText(/Filters Applied/i)).not.toBeInTheDocument();
  });

  it("handles empty search and make strings as undefined", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("q=&make="),
      vi.fn(),
    ]);
    renderHome();
    expect(usePaginatedQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        search: undefined,
        make: undefined,
      }),
      expect.anything()
    );
  });

  it("handles invalid numeric filter parameters", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("minYear=abc"),
      vi.fn(),
    ]);
    renderHome();
    expect(usePaginatedQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        minYear: undefined,
      }),
      expect.anything()
    );
  });

  it("handles empty state with search query", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("q=tractor"),
      vi.fn(),
    ]);
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderHome();
    expect(
      screen.getByText(/No auctions found matching "tractor"/i)
    ).toBeInTheDocument();
  });

  it("handles undefined watchedAuctionIds gracefully", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderHome();
    expect(screen.getAllByTestId("auction-card")).toHaveLength(2);
  });

  it("applies compact grid classes in loading state", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    });

    // Set compact mode
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderHome();
    const skeletons = screen.getAllByTestId("auction-skeleton");
    expect(skeletons[0].parentElement).toHaveClass("max-w-[500px]");
  });
});
