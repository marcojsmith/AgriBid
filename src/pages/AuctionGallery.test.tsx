import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { usePaginatedQuery } from "convex/react";

import { PAGINATION_LOAD_MORE_ITEMS } from "@/lib/constants";

import AuctionGallery from "./AuctionGallery";

vi.mock("convex/react", () => ({
  usePaginatedQuery: vi.fn(),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      getPublishedAuctions: {
        name: "auctions:getPublishedAuctions",
      },
    },
  },
}));

describe("AuctionGallery Page", () => {
  const loadMore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore,
    });
  });

  const renderPage = () =>
    render(
      <HelmetProvider>
        <MemoryRouter>
          <AuctionGallery />
        </MemoryRouter>
      </HelmetProvider>
    );

  it("renders a loading state while the first page is loading", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore,
    });
    renderPage();
    expect(screen.getByText(/Loading auctions/i)).toBeInTheDocument();
  });

  it("renders an empty state when there are no published events", () => {
    renderPage();
    expect(
      screen.getByText(/No auction events have been published yet/i)
    ).toBeInTheDocument();
  });

  it("renders event cards with title, window and lot count", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [
        {
          _id: "a1",
          title: "Spring Sale",
          description: "Tractors and combines",
          bannerImageUrl: "https://cdn/banner.jpg",
          startTime: Date.now() - 1000,
          endTime: Date.now() + 100000,
          status: "published",
          lotCount: 3,
        },
      ],
      status: "Exhausted",
      loadMore,
    });
    renderPage();
    expect(screen.getByText("Spring Sale")).toBeInTheDocument();
    expect(screen.getByText("Tractors and combines")).toBeInTheDocument();
    expect(screen.getByText("3 lots")).toBeInTheDocument();
    expect(screen.getByText("Live Now")).toBeInTheDocument();
  });

  it("does not show the Live Now badge for a closed event", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [
        {
          _id: "a2",
          title: "Past Sale",
          bannerImageUrl: undefined,
          startTime: Date.now() - 100000,
          endTime: Date.now() - 1000,
          status: "closed",
          lotCount: 1,
        },
      ],
      status: "Exhausted",
      loadMore,
    });
    renderPage();
    expect(screen.getByText("Past Sale")).toBeInTheDocument();
    expect(screen.queryByText("Live Now")).not.toBeInTheDocument();
  });

  it("links each card to its container detail page", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [
        {
          _id: "a1",
          title: "Spring Sale",
          bannerImageUrl: undefined,
          startTime: Date.now() - 1000,
          endTime: Date.now() + 100000,
          status: "published",
          lotCount: 3,
        },
      ],
      status: "Exhausted",
      loadMore,
    });
    renderPage();
    expect(screen.getByRole("link", { name: /Spring Sale/i })).toHaveAttribute(
      "href",
      "/auctions/a1"
    );
  });

  it("subscribes with the paginated query hook and shows Load More when more pages exist", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [
        {
          _id: "a1",
          title: "Spring Sale",
          bannerImageUrl: undefined,
          startTime: Date.now() - 1000,
          endTime: Date.now() + 100000,
          status: "published",
          lotCount: 3,
        },
      ],
      status: "CanLoadMore",
      loadMore,
    });
    renderPage();

    expect(usePaginatedQuery).toHaveBeenCalledWith(
      expect.anything(),
      {},
      { initialNumItems: 12 }
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Load More Auctions/i })
    );
    expect(loadMore).toHaveBeenCalledWith(PAGINATION_LOAD_MORE_ITEMS);
  });

  it("hides the Load More button when all pages are loaded", () => {
    renderPage();
    expect(
      screen.queryByRole("button", { name: /Load More Auctions/i })
    ).not.toBeInTheDocument();
  });
});
