import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { usePaginatedQuery, useQuery } from "convex/react";

import type { AuctionEvent } from "@/components/auction/AuctionEventCard";
import { PAGINATION_LOAD_MORE_ITEMS } from "@/lib/constants";

import Home from "./Home";

vi.mock("convex/react", () => ({
  usePaginatedQuery: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  };
});

vi.mock("@/components/LotBrowser", () => ({
  LotBrowser: () => <div data-testid="lot-browser">Lot Browser</div>,
}));

vi.mock("@/components/LoadingIndicator", () => ({
  LoadingIndicator: () => <div data-testid="loading-indicator">Spinner</div>,
}));

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;

/**
 * Builds a full auction event for the card.
 *
 * @param id - Event id (also used in the title)
 * @param over - Fields to override
 * @returns An event as `getPublishedAuctions` returns it
 */
const makeEvent = (id: string, over: Partial<AuctionEvent> = {}) =>
  ({
    _id: id,
    _creationTime: 0,
    title: `Sale ${id}`,
    description: "A sale",
    startTime: NOW - HOUR,
    endTime: NOW + 48 * HOUR,
    effectiveEndTime: NOW + 48 * HOUR,
    status: "published",
    createdBy: "admin",
    createdAt: 0,
    updatedAt: 0,
    lotCount: 3,
    lotCountCapped: false,
    fromPrice: 100000,
    leadImageUrls: [],
    location: "Bothaville, FS",
    ...over,
  }) as AuctionEvent;

interface Page {
  results: AuctionEvent[];
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: Mock;
}

describe("Home Page", () => {
  let active: Page;
  let closed: Page;
  let setSearchParams: Mock;

  const setUrl = (qs: string) => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams(qs),
      setSearchParams,
    ]);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    active = {
      results: [makeEvent("a1", { leadImageUrls: ["https://cdn/hero.jpg"] })],
      status: "Exhausted",
      loadMore: vi.fn(),
    };
    closed = {
      results: [
        makeEvent("c1", {
          status: "closed",
          endTime: NOW - HOUR,
          effectiveEndTime: NOW - HOUR,
        }),
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
    };
    setSearchParams = vi.fn();
    (useQuery as Mock).mockReturnValue([]);
    (usePaginatedQuery as Mock).mockImplementation(
      (_query: unknown, args: { status?: string } | "skip") => {
        if (args === "skip") {
          return { results: [], status: "Exhausted", loadMore: vi.fn() };
        }
        return args.status === "closed" ? closed : active;
      }
    );
    setUrl("");
  });

  const renderHome = () =>
    render(
      <HelmetProvider>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </HelmetProvider>
    );

  it("renders the hero h1, the Auctions section and How AgriBid works", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { level: 1, name: /online auction floor/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Auctions" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "How AgriBid works" })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("lot-browser")).not.toBeInTheDocument();
  });

  it("uses the first live event's first photo as the hero image", () => {
    const { container } = renderHome();
    const hero = container.querySelector('[data-slot="home-hero"] img');
    expect(hero).toHaveAttribute("src", "https://cdn/hero.jpg");
  });

  it("falls back to the plain hero colour when no live event has a photo", () => {
    active.results = [makeEvent("a1")];
    const { container } = renderHome();
    expect(container.querySelector('[data-slot="home-hero"] img')).toBeNull();
  });

  it("shows live and upcoming events on the default view", () => {
    active.results = [
      makeEvent("a1"),
      makeEvent("a2", {
        startTime: NOW + 10 * HOUR,
        endTime: NOW + 80 * HOUR,
        effectiveEndTime: NOW + 80 * HOUR,
      }),
    ];
    renderHome();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(
      screen.getByRole("radio", { name: "Live & upcoming" })
    ).toBeChecked();
  });

  it("loads only the open sales by default (ended sales are skipped)", () => {
    renderHome();
    expect(usePaginatedQuery).toHaveBeenCalledWith(
      expect.anything(),
      { status: "active" },
      { initialNumItems: 12 }
    );
    expect(usePaginatedQuery).toHaveBeenCalledWith(
      expect.anything(),
      "skip",
      expect.anything()
    );
  });

  it("drops sales whose window has ended from the live view", () => {
    active.results = [
      makeEvent("a1"),
      makeEvent("gone", {
        endTime: NOW - HOUR,
        effectiveEndTime: NOW - HOUR,
      }),
    ];
    renderHome();
    expect(screen.getByText("Sale a1")).toBeInTheDocument();
    expect(screen.queryByText("Sale gone")).not.toBeInTheDocument();
  });

  it("closing soon view lists only sales ending within 24 hours", () => {
    setUrl("view=soon");
    active.results = [
      makeEvent("far"),
      makeEvent("near", { effectiveEndTime: NOW + 5 * HOUR }),
    ];
    renderHome();
    expect(screen.getByText("Sale near")).toBeInTheDocument();
    expect(screen.queryByText("Sale far")).not.toBeInTheDocument();
  });

  it("shows an empty state with a way back when nothing closes within 24 hours", () => {
    setUrl("view=soon");
    renderHome();
    expect(screen.getByTestId("events-empty")).toHaveTextContent(
      "No sales close in the next 24 hours."
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Show live & upcoming" })
    );
    const params = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(params.has("view")).toBe(false);
  });

  it("results view loads ended sales", () => {
    setUrl("view=results");
    renderHome();
    expect(usePaginatedQuery).toHaveBeenCalledWith(
      expect.anything(),
      { status: "closed" },
      { initialNumItems: 12 }
    );
    expect(screen.getByText("Sale c1")).toBeInTheDocument();
    expect(screen.queryByLabelText("Sort")).not.toBeInTheDocument();
  });

  it("keeps the hero photo while on the results view", () => {
    setUrl("view=results");
    const { container } = renderHome();
    expect(
      container.querySelector('[data-slot="home-hero"] img')
    ).toHaveAttribute("src", "https://cdn/hero.jpg");
  });

  it("maps the retired status=closed link to results", () => {
    setUrl("status=closed");
    renderHome();
    expect(screen.getByRole("radio", { name: "Results" })).toBeChecked();
  });

  it("shows the empty state for results", () => {
    setUrl("view=results");
    closed.results = [];
    renderHome();
    expect(screen.getByTestId("events-empty")).toHaveTextContent(
      "Results appear here once a sale closes."
    );
  });

  it("shows the empty state when no sale is live or scheduled", () => {
    active.results = [];
    renderHome();
    expect(screen.getByTestId("events-empty")).toHaveTextContent(
      "No auctions are live or scheduled right now."
    );
  });

  it("shows a loading skeleton while the first page loads", () => {
    active.results = [];
    active.status = "LoadingFirstPage";
    renderHome();
    expect(screen.getAllByTestId("event-card-skeleton")).toHaveLength(3);
    expect(screen.queryByTestId("events-empty")).not.toBeInTheDocument();
  });

  it("writes the chosen view to the URL and removes it for the default", () => {
    renderHome();
    fireEvent.click(screen.getByRole("radio", { name: "Closing soon" }));
    expect(
      (setSearchParams.mock.calls[0][0] as URLSearchParams).get("view")
    ).toBe("soon");

    expect(setSearchParams.mock.calls[0][1]).toEqual({ replace: true });
  });

  it("clears the view and the retired status param when going back to Live & upcoming", () => {
    setUrl("view=soon&status=closed");
    renderHome();
    fireEvent.click(screen.getByRole("radio", { name: "Live & upcoming" }));
    const params = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(params.has("view")).toBe(false);
    expect(params.has("status")).toBe(false);
  });

  it("sorts newest first when asked and writes the sort to the URL", () => {
    active.results = [
      makeEvent("old", { startTime: NOW - 5 * HOUR }),
      makeEvent("new", {
        startTime: NOW - HOUR,
        effectiveEndTime: NOW + 90 * HOUR,
      }),
    ];
    setUrl("sort=newest");
    renderHome();
    const titles = screen
      .getAllByRole("article")
      .map((a) => within(a).getByRole("heading").textContent);
    expect(titles).toEqual(["Sale new", "Sale old"]);

    fireEvent.change(screen.getByLabelText("Sort"), {
      target: { value: "soonest" },
    });
    expect(
      (setSearchParams.mock.calls[0][0] as URLSearchParams).has("sort")
    ).toBe(false);
    fireEvent.change(screen.getByLabelText("Sort"), {
      target: { value: "newest" },
    });
    expect(
      (setSearchParams.mock.calls[1][0] as URLSearchParams).get("sort")
    ).toBe("newest");
  });

  it("auto-loads every page of open sales before showing them", () => {
    active.status = "CanLoadMore";
    renderHome();
    expect(active.loadMore).toHaveBeenCalledWith(PAGINATION_LOAD_MORE_ITEMS);
    // Not shown half-sorted while pages are still arriving.
    expect(screen.getAllByTestId("event-card-skeleton")).toHaveLength(3);
    expect(screen.queryByText("Sale a1")).not.toBeInTheDocument();
  });

  it("stops loading at 36 sales and says the list is cut off", () => {
    active.status = "CanLoadMore";
    active.results = Array.from({ length: 36 }, (_, i) =>
      makeEvent(`s${String(i)}`)
    );
    renderHome();
    expect(active.loadMore).not.toHaveBeenCalled();
    expect(screen.getByText("Showing the first 36 sales.")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(36);
    expect(
      screen.queryByRole("button", { name: /Load more auctions/i })
    ).not.toBeInTheDocument();
  });

  it("does not show the cut-off note when everything fits", () => {
    renderHome();
    expect(screen.queryByText(/Showing the first/)).not.toBeInTheDocument();
  });

  it("finds a sale that closes soon on a later page", () => {
    setUrl("view=soon");
    active.status = "Exhausted";
    active.results = [
      makeEvent("p1"),
      makeEvent("p2", { effectiveEndTime: NOW + 3 * HOUR }),
    ];
    renderHome();
    expect(screen.getByText("Sale p2")).toBeInTheDocument();
  });

  it("shows Load more on Results and loads the next page", () => {
    setUrl("view=results");
    closed.status = "CanLoadMore";
    renderHome();
    fireEvent.click(
      screen.getByRole("button", { name: /Load more auctions/i })
    );
    expect(closed.loadMore).toHaveBeenCalledWith(PAGINATION_LOAD_MORE_ITEMS);
    expect(active.loadMore).not.toHaveBeenCalled();
  });

  it("offers Load more on Results instead of the empty state while more pages exist", () => {
    setUrl("view=results");
    closed.results = [];
    closed.status = "CanLoadMore";
    renderHome();
    expect(screen.queryByTestId("events-empty")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Load more auctions/i })
    ).toBeInTheDocument();
  });

  it("shows the spinner while the next page of results loads", () => {
    setUrl("view=results");
    closed.status = "LoadingMore";
    renderHome();
    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("includes sales still published after their window ended in Results", () => {
    setUrl("view=results");
    active.results = [
      makeEvent("stuck", { endTime: NOW - HOUR, effectiveEndTime: NOW - HOUR }),
    ];
    renderHome();
    expect(screen.getByText("Sale stuck")).toBeInTheDocument();
    expect(screen.getByText("Sale c1")).toBeInTheDocument();
  });

  it("hides Load more when everything is loaded", () => {
    renderHome();
    expect(
      screen.queryByRole("button", { name: /Load more auctions/i })
    ).not.toBeInTheDocument();
  });

  it("renders the global lot browser when a q param is present", () => {
    setUrl("q=tractor");
    renderHome();
    expect(screen.getByTestId("lot-browser")).toBeInTheDocument();
    expect(screen.queryByText("Sale a1")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(usePaginatedQuery).toHaveBeenCalledWith(
      expect.anything(),
      "skip",
      expect.anything()
    );
  });

  it("skips the closing-soon query while searching", () => {
    setUrl("q=tractor");
    renderHome();
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("requests 12 closing-soon lots and shows the strip below the events", () => {
    (useQuery as Mock).mockReturnValue([
      {
        _id: "lot1",
        title: "T",
        make: "John Deere",
        model: "8R",
        year: 2020,
        auctionId: "a1",
        auctionTitle: "Sale a1",
        currentPrice: 500,
        startingPrice: 500,
        hasBids: false,
        effectiveEndTime: NOW + HOUR,
        location: "Bothaville",
      },
    ]);
    renderHome();
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), { limit: 12 });
    const strip = screen.getByRole("heading", {
      level: 2,
      name: "Closing in the next 24 hours",
    });
    const auctions = screen.getByRole("heading", {
      level: 2,
      name: "Auctions",
    });
    const how = screen.getByRole("heading", {
      level: 2,
      name: "How AgriBid works",
    });
    expect(
      auctions.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      strip.compareDocumentPosition(how) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("hides the closing-soon strip when there are no lots", () => {
    renderHome();
    expect(
      screen.queryByRole("heading", { name: "Closing in the next 24 hours" })
    ).not.toBeInTheDocument();
  });

  it("treats an empty q param as no search", () => {
    setUrl("q=");
    renderHome();
    expect(screen.queryByTestId("lot-browser")).not.toBeInTheDocument();
    expect(screen.getByText("Sale a1")).toBeInTheDocument();
  });
});
