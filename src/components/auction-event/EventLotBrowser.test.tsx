import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSession } from "@/lib/auth-client";
import type { LotSummary } from "@/types/auction";

import { EventLotBrowser } from "./EventLotBrowser";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));
vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: { getActiveLots: "getActiveLots" },
    userPreferences: {
      getMyPreferences: "getMyPreferences",
      updateMyPreferences: "updateMyPreferences",
    },
    watchlist: { getWatchedLotIds: "getWatchedLotIds" },
  },
}));
vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn() }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: vi.fn() }));
vi.mock("@/components/FilterSidebar", () => ({
  FilterSidebar: ({
    onClose,
    applySavedDefaults,
  }: {
    onClose?: () => void;
    applySavedDefaults?: boolean;
  }) => (
    <div
      data-testid={onClose ? "sheet-filters" : "sidebar-filters"}
      data-apply-defaults={String(applySavedDefaults)}
    />
  ),
}));
vi.mock("@/components/AuctionCardSkeleton", () => ({
  AuctionCardSkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock("@/components/auction/AuctionCard", () => ({
  AuctionCard: ({
    auction,
    viewMode,
    isWatched,
  }: {
    auction: LotSummary;
    viewMode: string;
    isWatched: boolean;
  }) => (
    <div data-testid="card" data-view={viewMode} data-watched={isWatched}>
      {auction.title}
    </div>
  ),
}));

const AUCTION_ID = "a1" as Id<"auctions">;

const lot = (title: string, price: number): LotSummary =>
  ({ _id: `id-${title}`, title, currentPrice: price }) as unknown as LotSummary;

const LOTS = [lot("Alpha", 300), lot("Bravo", 100), lot("Charlie", 200)];

function Search() {
  return <div data-testid="search">{useLocation().search}</div>;
}

describe("EventLotBrowser", () => {
  const loadMore = vi.fn();
  const updateMyPreferences = vi.fn();
  let paginated: { results: LotSummary[]; status: string; loadMore: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    paginated = { results: LOTS, status: "Exhausted", loadMore };
    (usePaginatedQuery as Mock).mockImplementation(() => paginated);
    (useQuery as Mock).mockImplementation((ref: string) =>
      ref === "getWatchedLotIds" ? ["id-Bravo"] : undefined
    );
    (useMutation as Mock).mockReturnValue(updateMyPreferences);
    (useSession as Mock).mockReturnValue({ data: null });
    (useMediaQuery as Mock).mockReturnValue(true);
  });

  const renderBrowser = (url = "/auctions/a1") =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <EventLotBrowser auctionId={AUCTION_ID} />
        <Search />
      </MemoryRouter>
    );

  const titles = () => screen.getAllByTestId("card").map((c) => c.textContent);

  it("queries the sale's lots with every status, passing the URL filters", () => {
    renderBrowser("/auctions/a1?make=Fendt&minYear=2018");
    expect(usePaginatedQuery).toHaveBeenCalledWith(
      "getActiveLots",
      expect.objectContaining({
        auctionId: AUCTION_ID,
        statusFilter: "all",
        make: "Fendt",
        minYear: 2018,
      }),
      expect.anything()
    );
  });

  describe("count and results", () => {
    it("shows N lots that matches the cards listed", () => {
      renderBrowser();
      expect(screen.getByTestId("lot-count")).toHaveTextContent("3 lots");
      expect(screen.getAllByTestId("card")).toHaveLength(3);
    });

    it("uses the singular for one lot", () => {
      paginated.results = [LOTS[0]];
      renderBrowser();
      expect(screen.getByTestId("lot-count")).toHaveTextContent("1 lot");
    });

    it("adds a + while more lots can be loaded and loads them on request", () => {
      paginated.status = "CanLoadMore";
      renderBrowser();
      expect(screen.getByTestId("lot-count")).toHaveTextContent("3+ lots");
      fireEvent.click(screen.getByRole("button", { name: /Load more lots/ }));
      expect(loadMore).toHaveBeenCalled();
    });

    it("marks watched lots", () => {
      renderBrowser();
      const watched = screen
        .getAllByTestId("card")
        .map((c) => c.getAttribute("data-watched"));
      expect(watched).toEqual(["false", "true", "false"]);
    });

    it("shows skeletons while the first page loads", () => {
      paginated = { results: [], status: "LoadingFirstPage", loadMore };
      renderBrowser();
      expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
    });

    it("shows a loading indicator while more load", () => {
      paginated.status = "LoadingMore";
      renderBrowser();
      expect(screen.getAllByTestId("card")).toHaveLength(3);
    });
  });

  describe("empty states", () => {
    beforeEach(() => {
      paginated.results = [];
    });

    it("says the sale has no lots when no filter is set", () => {
      renderBrowser();
      expect(
        screen.getByText("There are no lots in this sale yet.")
      ).toBeInTheDocument();
      expect(screen.getByTestId("lot-count")).toHaveTextContent("0 lots");
    });

    it("offers to clear filters when filters hide every lot", () => {
      renderBrowser("/auctions/a1?make=Fendt&sort=closing");
      expect(
        screen.getByText("No lots match these filters.")
      ).toBeInTheDocument();
      // The chips bar and the empty state each offer Clear filters.
      const buttons = screen.getAllByRole("button", { name: "Clear filters" });
      expect(buttons).toHaveLength(2);
      fireEvent.click(buttons[1]);
      // Filters go, the chosen sort stays.
      expect(screen.getByTestId("search")).toHaveTextContent("?sort=closing");
    });
  });

  describe("filter chips", () => {
    const url = `/auctions/a1?${new URLSearchParams({
      make: "Fendt",
      minYear: "2018",
      maxYear: "2022",
      maxHours: "5000",
    }).toString()}`;

    it("shows one chip per active filter", () => {
      renderBrowser(url);
      const group = screen.getByRole("group", { name: "Active filters" });
      expect(within(group).getAllByRole("button")).toHaveLength(4); // 3 chips + Clear
      expect(screen.getByText("Make: Fendt")).toBeInTheDocument();
      expect(screen.getByText("Year: 2018–2022")).toBeInTheDocument();
    });

    it("shows no chips when no filter is set", () => {
      renderBrowser();
      expect(
        screen.queryByRole("group", { name: "Active filters" })
      ).not.toBeInTheDocument();
    });

    it("removes just one filter's params", () => {
      renderBrowser(url);
      fireEvent.click(
        screen.getByRole("button", { name: "Remove filter: Year: 2018–2022" })
      );
      const search = screen.getByTestId("search").textContent;
      expect(search).toContain("make=Fendt");
      expect(search).toContain("maxHours=5000");
      expect(search).not.toContain("Year");
      expect(search).not.toContain("minYear");
    });

    it("clears every filter", () => {
      renderBrowser(url);
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
      expect(screen.getByTestId("search")).toHaveTextContent("");
    });
  });

  describe("sort", () => {
    it("keeps lot-number (server) order by default", () => {
      renderBrowser();
      expect(titles()).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    it("reorders by price from the URL", () => {
      renderBrowser("/auctions/a1?sort=price-asc");
      expect(titles()).toEqual(["Bravo", "Charlie", "Alpha"]);
    });

    it("loads the rest of the sale before a price sort, but not for lot order", () => {
      paginated.status = "CanLoadMore";
      const { unmount } = renderBrowser();
      expect(loadMore).not.toHaveBeenCalled();
      unmount();
      renderBrowser("/auctions/a1?sort=price-asc");
      expect(loadMore).toHaveBeenCalledWith(50);
    });

    it("does not keep loading once the sale is exhausted", () => {
      renderBrowser("/auctions/a1?sort=closing");
      expect(loadMore).not.toHaveBeenCalled();
    });

    it("writes the chosen sort to the URL and drops it for lot number", () => {
      renderBrowser();
      const [select] = screen.getAllByLabelText("Sort lots");
      fireEvent.change(select, { target: { value: "price-desc" } });
      expect(screen.getByTestId("search")).toHaveTextContent(
        "?sort=price-desc"
      );
      fireEvent.change(screen.getAllByLabelText("Sort lots")[0], {
        target: { value: "lot" },
      });
      expect(screen.getByTestId("search")).toHaveTextContent("");
    });
  });

  describe("desktop layout", () => {
    it("shows the 260px sidebar and the Detailed/Compact toggle", () => {
      renderBrowser();
      const sidebar = screen.getByTestId("desktop-sidebar");
      expect(sidebar).toBeInTheDocument();
      expect(
        within(sidebar).getByTestId("sidebar-filters")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("radiogroup", { name: "Lot layout" })
      ).toBeVisible();
    });

    it("defaults to detailed and switches to compact, saving it for a signed-in user", () => {
      (useSession as Mock).mockReturnValue({ data: { user: { id: "u" } } });
      renderBrowser();
      expect(screen.getAllByTestId("card")[0]).toHaveAttribute(
        "data-view",
        "detailed"
      );
      fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
      expect(screen.getAllByTestId("card")[0]).toHaveAttribute(
        "data-view",
        "compact"
      );
      expect(updateMyPreferences).toHaveBeenCalledWith({ viewMode: "compact" });
    });

    it("does not save the layout for a guest", () => {
      renderBrowser();
      fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
      expect(updateMyPreferences).not.toHaveBeenCalled();
    });

    it("applies the saved layout preference", () => {
      (useSession as Mock).mockReturnValue({ data: { user: { id: "u" } } });
      (useQuery as Mock).mockImplementation((ref: string) =>
        ref === "getMyPreferences" ? { viewMode: "compact" } : undefined
      );
      renderBrowser();
      expect(screen.getAllByTestId("card")[0]).toHaveAttribute(
        "data-view",
        "compact"
      );
    });
  });

  describe("phone", () => {
    beforeEach(() => {
      (useMediaQuery as Mock).mockReturnValue(false);
    });

    it("mounts no desktop sidebar, so only the sheet's filters sync the URL", () => {
      renderBrowser();
      expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("sidebar-filters")).not.toBeInTheDocument();
    });

    it("always uses compact rows", () => {
      renderBrowser();
      expect(screen.getAllByTestId("card")[0]).toHaveAttribute(
        "data-view",
        "compact"
      );
    });

    it("shows a sticky Filters (n) and Sort bar whose count matches the chips", () => {
      renderBrowser("/auctions/a1?make=Fendt&minPrice=1&maxPrice=9");
      const bar = screen.getByTestId("mobile-filter-bar");
      expect(bar.className).toMatch(/sticky/);
      expect(
        within(bar).getByRole("button", { name: "Filters (2)" })
      ).toBeInTheDocument();
      expect(within(bar).getByLabelText("Sort lots")).toBeInTheDocument();
    });

    it("shows Filters (0) with no filters", () => {
      renderBrowser();
      expect(
        screen.getByRole("button", { name: "Filters (0)" })
      ).toBeInTheDocument();
    });

    it("does not leave a filter sheet open after the window widens to desktop", () => {
      const { rerender } = renderBrowser();
      fireEvent.click(screen.getByRole("button", { name: "Filters (0)" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      (useMediaQuery as Mock).mockReturnValue(true);
      rerender(
        <MemoryRouter initialEntries={["/auctions/a1"]}>
          <EventLotBrowser auctionId={AUCTION_ID} />
          <Search />
        </MemoryRouter>
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("opens the filter sheet and closes it with Show N lots", () => {
      renderBrowser();
      expect(screen.queryByTestId("sheet-filters")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Filters (0)" }));
      const sheet = screen.getByRole("dialog", { name: "Filter lots" });
      expect(within(sheet).getByTestId("sheet-filters")).toBeInTheDocument();
      fireEvent.click(
        within(sheet).getByRole("button", { name: "Show 3 lots" })
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("never re-merges saved default filters when the sheet reopens", () => {
      renderBrowser();
      for (let i = 0; i < 2; i++) {
        fireEvent.click(screen.getByRole("button", { name: "Filters (0)" }));
        const sheet = screen.getByRole("dialog", { name: "Filter lots" });
        expect(within(sheet).getByTestId("sheet-filters")).toHaveAttribute(
          "data-apply-defaults",
          "false"
        );
        fireEvent.click(
          within(sheet).getByRole("button", { name: "Show 3 lots" })
        );
      }
    });
  });
});
