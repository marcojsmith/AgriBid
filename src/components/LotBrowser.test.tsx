import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter, useSearchParams } from "react-router-dom";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import type { Id } from "convex/_generated/dataModel";

import { useSession } from "@/lib/auth-client";

import { LotBrowser, type LotBrowserProps } from "./LotBrowser";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
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
    hideStatus,
    "data-testid": testid = "filter-sidebar",
  }: {
    onClose?: () => void;
    hideStatus?: boolean;
    "data-testid"?: string;
  }) => (
    <div data-testid={testid} data-hide-status={String(hideStatus ?? false)}>
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

const TEST_AUCTION_ID = "a1" as Id<"auctions">;

describe("LotBrowser", () => {
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
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    (useSearchParams as Mock).mockReturnValue([new URLSearchParams(), vi.fn()]);
  });

  const renderLotBrowser = (props: LotBrowserProps = {}) => {
    return render(
      <BrowserRouter>
        <LotBrowser {...props} />
      </BrowserRouter>
    );
  };

  it("renders active auctions by default", () => {
    renderLotBrowser();
    expect(screen.getByText(/Active Auctions/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("auction-card")).toHaveLength(2);
    expect(screen.getByText(/Auction 1 \(detailed\)/i)).toBeInTheDocument();
  });

  it("renders loading state", () => {
    (useSession as Mock).mockReturnValue({ isPending: true });
    renderLotBrowser();
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("renders empty state when no auctions found", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderLotBrowser();
    expect(screen.getByText(/No auctions found/i)).toBeInTheDocument();
  });

  it("toggles view mode manually", () => {
    renderLotBrowser();
    const compactBtn = screen.getByText(/Compact/i);
    fireEvent.click(compactBtn);
    expect(screen.getByText(/Auction 1 \(compact\)/i)).toBeInTheDocument();

    const detailedBtn = screen.getByText(/Detailed/i);
    fireEvent.click(detailedBtn);
    expect(screen.getByText(/Auction 1 \(detailed\)/i)).toBeInTheDocument();
  });

  it("toggles desktop sidebar", () => {
    renderLotBrowser();
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

    renderLotBrowser();
    expect(screen.getByText(/Results for "tractor"/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear search results/i)).toBeInTheDocument();
  });

  it("renders different status filters", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("status=closed"),
      vi.fn(),
    ]);
    renderLotBrowser();
    expect(screen.getByText(/Closed Auctions/i)).toBeInTheDocument();

    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("status=all"),
      vi.fn(),
    ]);
    renderLotBrowser();
    expect(screen.getByText(/All Auctions/i)).toBeInTheDocument();
  });

  it("renders removable filter chips when filters are active", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("make=John+Deere"),
      vi.fn(),
    ]);
    renderLotBrowser();
    expect(screen.getByTestId("active-filter-chips")).toBeInTheDocument();
    expect(screen.getByTestId("filter-chip-make")).toHaveTextContent(
      "Make: John Deere"
    );
  });

  it("does not render filter chips when no filters are active", () => {
    renderLotBrowser();
    expect(screen.queryByTestId("active-filter-chips")).not.toBeInTheDocument();
  });

  it("removes the make filter and preserves other params when its chip is dismissed", () => {
    const setSearchParams = vi.fn();
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("make=John+Deere&q=tractor"),
      setSearchParams,
    ]);
    renderLotBrowser();
    fireEvent.click(screen.getByTestId("filter-chip-make"));

    const calledWith = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("make")).toBe(false);
    expect(calledWith.get("q")).toBe("tractor");
  });

  it("renders a combined year chip and removes both year params on dismissal", () => {
    const setSearchParams = vi.fn();
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("minYear=2015&maxYear=2020&make=John+Deere"),
      setSearchParams,
    ]);
    renderLotBrowser();
    const chip = screen.getByTestId("filter-chip-year");
    expect(chip).toHaveTextContent("Year: 2015–2020");

    fireEvent.click(chip);
    const calledWith = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("minYear")).toBe(false);
    expect(calledWith.has("maxYear")).toBe(false);
    expect(calledWith.get("make")).toBe("John Deere");
  });

  it("renders a price chip and removes both price params on dismissal", () => {
    const setSearchParams = vi.fn();
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("minPrice=100000&maxPrice=500000"),
      setSearchParams,
    ]);
    renderLotBrowser();
    const chip = screen.getByTestId("filter-chip-price");
    expect(chip).toHaveTextContent(/100/);
    expect(chip).toHaveTextContent(/500/);

    fireEvent.click(chip);
    const calledWith = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("minPrice")).toBe(false);
    expect(calledWith.has("maxPrice")).toBe(false);
  });

  it("renders a max hours chip and removes it on dismissal", () => {
    const setSearchParams = vi.fn();
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("maxHours=1000"),
      setSearchParams,
    ]);
    renderLotBrowser();
    expect(screen.getByTestId("filter-chip-hours")).toHaveTextContent(
      "Max Hours: 1"
    );

    fireEvent.click(screen.getByTestId("filter-chip-hours"));
    const calledWith = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("maxHours")).toBe(false);
  });

  it("renders a min-only year chip with 'from' phrasing", () => {
    const setSearchParams = vi.fn();
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("minYear=2015"),
      setSearchParams,
    ]);
    renderLotBrowser();
    expect(screen.getByTestId("filter-chip-year")).toHaveTextContent(
      "Year: from 2015"
    );

    fireEvent.click(screen.getByTestId("filter-chip-year"));
    const calledWith = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("minYear")).toBe(false);
  });

  it("renders a max-only price chip with 'up to' phrasing", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("maxPrice=500000"),
      vi.fn(),
    ]);
    renderLotBrowser();
    expect(screen.getByTestId("filter-chip-price")).toHaveTextContent(
      "Price: up to"
    );
  });

  it("renders a status chip for non-active status and removes it on dismissal", () => {
    const setSearchParams = vi.fn();
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("status=closed"),
      setSearchParams,
    ]);
    renderLotBrowser();
    expect(screen.getByTestId("filter-chip-status")).toHaveTextContent(
      "Status: Closed"
    );

    fireEvent.click(screen.getByTestId("filter-chip-status"));
    const calledWith = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("status")).toBe(false);
  });

  it("does not render a status chip when status comes from saved preferences only", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    });
    // First useQuery call → preferences, second → watchedAuctionIds
    (useQuery as Mock)
      .mockReturnValueOnce({ defaultStatusFilter: "closed" })
      .mockReturnValueOnce(["1"]);
    (useSearchParams as Mock).mockReturnValue([new URLSearchParams(), vi.fn()]);

    renderLotBrowser();
    expect(screen.queryByTestId("filter-chip-status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("active-filter-chips")).not.toBeInTheDocument();
  });

  it("initializes in mobile view (compact) when viewport is small", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderLotBrowser();

    // Mobile view defaults to compact
    expect(screen.getByText(/Auction 1 \(compact\)/i)).toBeInTheDocument();
  });

  it("shows mobile filter overlay", () => {
    // Mock mobile viewport
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderLotBrowser();
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
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderLotBrowser();
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

    renderLotBrowser();
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

    renderLotBrowser();
    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("renders skeleton during first page load", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    });

    renderLotBrowser();
    expect(screen.getAllByTestId("auction-skeleton")).toHaveLength(3);
  });

  it("updates view when media query matches change", () => {
    let changeHandler: () => void = () => {
      // intentional no-op: placeholder until LotBrowser registers its change listener
    };
    const mql = {
      matches: false,
      media: "(max-width: 768px)",
      onchange: null,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "change") changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { rerender } = render(
      <BrowserRouter>
        <LotBrowser />
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
        <LotBrowser />
      </BrowserRouter>
    );

    expect(screen.getByText(/Auction 1 \(compact\)/i)).toBeInTheDocument();
  });

  it("renders clear search results link and clears it", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("q=tractor"),
      vi.fn(),
    ]);
    renderLotBrowser();

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

    renderLotBrowser();
    const clearLink = screen.getByText(/Clear All Filters/i);
    expect(clearLink).toHaveAttribute("href", "/");
  });

  it("handles missing search query and filters gracefully", () => {
    (useSearchParams as Mock).mockReturnValue([new URLSearchParams(), vi.fn()]);
    renderLotBrowser();
    expect(screen.getByText(/Active Auctions/i)).toBeInTheDocument();
    expect(screen.queryByText(/Filters Applied/i)).not.toBeInTheDocument();
  });

  it("handles empty search and make strings as undefined", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("q=&make="),
      vi.fn(),
    ]);
    renderLotBrowser();
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
    renderLotBrowser();
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

    renderLotBrowser();
    expect(
      screen.getByText(/No auctions found matching "tractor"/i)
    ).toBeInTheDocument();
  });

  it("handles undefined watchedAuctionIds gracefully", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderLotBrowser();
    expect(screen.getAllByTestId("auction-card")).toHaveLength(2);
  });

  it("applies saved viewMode preference on load", async () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    });
    // First useQuery call → preferences, second → watchedAuctionIds
    (useQuery as Mock)
      .mockReturnValueOnce({ viewMode: "compact", sidebarOpen: false })
      .mockReturnValueOnce(["1"]);

    renderLotBrowser();

    await act(async () => {
      // intentional no-op: flush async preference-loading effects before asserting
    });

    expect(screen.getByText(/Auction 1 \(compact\)/i)).toBeInTheDocument();
  });

  it("applies saved sidebarOpen preference on load", async () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    });
    (useQuery as Mock)
      .mockReturnValueOnce({ viewMode: "detailed", sidebarOpen: true })
      .mockReturnValueOnce(["1"]);

    renderLotBrowser();

    await act(async () => {
      // intentional no-op: flush async preference-loading effects before asserting
    });

    expect(screen.getByText(/Hide Filters/i)).toBeInTheDocument();
  });

  it("fires updateMyPreferences when authenticated user toggles view mode", () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined);
    (useMutation as Mock).mockReturnValue(mockMutate);
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(null);

    renderLotBrowser();
    fireEvent.click(screen.getByText(/Compact/i));

    expect(mockMutate).toHaveBeenCalledWith({ viewMode: "compact" });
  });

  it("fires updateMyPreferences when authenticated user toggles sidebar", () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined);
    (useMutation as Mock).mockReturnValue(mockMutate);
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(null);

    renderLotBrowser();
    fireEvent.click(screen.getByText(/Show Filters/i));

    expect(mockMutate).toHaveBeenCalledWith({ sidebarOpen: true });
  });

  it("does not fire updateMyPreferences when unauthenticated user toggles view mode", () => {
    const mockMutate = vi.fn();
    (useMutation as Mock).mockReturnValue(mockMutate);
    (useSession as Mock).mockReturnValue({ data: null, isPending: false });
    (useQuery as Mock).mockReturnValue(null);

    renderLotBrowser();
    fireEvent.click(screen.getByText(/Compact/i));

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("fires updateMyPreferences when authenticated user clicks Detailed", () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined);
    (useMutation as Mock).mockReturnValue(mockMutate);
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(null);

    renderLotBrowser();
    fireEvent.click(screen.getByRole("button", { name: "Detailed" }));

    expect(mockMutate).toHaveBeenCalledWith({ viewMode: "detailed" });
  });

  it("applies compact grid classes in loading state", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    });

    // Set compact mode
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderLotBrowser();
    const skeletons = screen.getAllByTestId("auction-skeleton");
    expect(skeletons[0].parentElement).toHaveClass("max-w-[500px]");
  });

  it("shows the Sell button by default", () => {
    renderLotBrowser();
    expect(screen.getByRole("link", { name: "Sell" })).toHaveAttribute(
      "href",
      "/sell"
    );
  });

  it("hides the Sell button when showSellButton is false", () => {
    renderLotBrowser({ showSellButton: false });
    expect(
      screen.queryByRole("link", { name: "Sell" })
    ).not.toBeInTheDocument();
  });

  it("renders the heading prop instead of the status-derived heading", () => {
    renderLotBrowser({ heading: "My Custom Heading" });
    expect(
      screen.getByRole("heading", { level: 1, name: "My Custom Heading" })
    ).toBeInTheDocument();
  });

  describe("scoped to an auction container", () => {
    it("passes auctionId to the paginated lot query", () => {
      renderLotBrowser({ auctionId: TEST_AUCTION_ID });
      expect(usePaginatedQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ auctionId: TEST_AUCTION_ID }),
        expect.anything()
      );
    });

    it("does not pass auctionId in the global (search) mode", () => {
      renderLotBrowser();
      const args = (usePaginatedQuery as Mock).mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(args.auctionId).toBeUndefined();
    });

    it("omits the <h1> so the page provides its own heading", () => {
      renderLotBrowser({ auctionId: TEST_AUCTION_ID, heading: "Ignored" });
      expect(
        screen.queryByRole("heading", { level: 1 })
      ).not.toBeInTheDocument();
    });

    it("defaults statusFilter to 'all', ignoring the saved preference", async () => {
      (useSession as Mock).mockReturnValue({
        data: { user: { id: "u1" } },
        isPending: false,
      });
      (useQuery as Mock)
        .mockReturnValueOnce({ defaultStatusFilter: "closed" })
        .mockReturnValueOnce(["1"]);

      renderLotBrowser({ auctionId: TEST_AUCTION_ID });

      await act(async () => {
        // intentional no-op: flush async preference-loading effects before asserting
      });

      expect(usePaginatedQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ statusFilter: "all" }),
        expect.anything()
      );
    });

    it("still honours an explicit status param from the URL", () => {
      (useSearchParams as Mock).mockReturnValue([
        new URLSearchParams("status=closed"),
        vi.fn(),
      ]);

      renderLotBrowser({ auctionId: TEST_AUCTION_ID });

      expect(usePaginatedQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ statusFilter: "closed" }),
        expect.anything()
      );
    });

    it("hides the status filter in the sidebar", () => {
      renderLotBrowser({ auctionId: TEST_AUCTION_ID });

      const sidebars = screen.getAllByTestId("filter-sidebar");
      expect(sidebars.length).toBeGreaterThan(0);
      for (const sidebar of sidebars) {
        expect(sidebar).toHaveAttribute("data-hide-status", "true");
      }
    });

    it("does not render a status chip even for a non-default URL status", () => {
      (useSearchParams as Mock).mockReturnValue([
        new URLSearchParams("status=closed"),
        vi.fn(),
      ]);

      renderLotBrowser({ auctionId: TEST_AUCTION_ID });
      expect(
        screen.queryByTestId("filter-chip-status")
      ).not.toBeInTheDocument();
    });

    it("shows the auction-scoped empty state with a Clear filters button", () => {
      (usePaginatedQuery as Mock).mockReturnValue({
        results: [],
        status: "Exhausted",
        loadMore: vi.fn(),
      });

      renderLotBrowser({ auctionId: TEST_AUCTION_ID });
      expect(
        screen.getByText("No lots match your current filters.")
      ).toBeInTheDocument();

      const clearButton = screen.getByRole("button", { name: "Clear filters" });
      expect(clearButton).not.toHaveAttribute("href");
    });

    it("clears search params on the current path when Clear filters is clicked", () => {
      const setSearchParams = vi.fn();
      (useSearchParams as Mock).mockReturnValue([
        new URLSearchParams("make=John+Deere&q=tractor"),
        setSearchParams,
      ]);
      (usePaginatedQuery as Mock).mockReturnValue({
        results: [],
        status: "Exhausted",
        loadMore: vi.fn(),
      });

      renderLotBrowser({ auctionId: TEST_AUCTION_ID });
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

      expect(setSearchParams).toHaveBeenCalledTimes(1);
      const calledWith = setSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledWith.toString()).toBe("");
    });
  });
});
