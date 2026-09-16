import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { useQuery } from "convex/react";

import AuctionGallery from "./AuctionGallery";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () =>
    render(
      <HelmetProvider>
        <MemoryRouter>
          <AuctionGallery />
        </MemoryRouter>
      </HelmetProvider>
    );

  it("renders a loading state while events are undefined", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderPage();
    expect(screen.getByText(/Loading auctions/i)).toBeInTheDocument();
  });

  it("renders an empty state when there are no published events", () => {
    (useQuery as Mock).mockReturnValue([]);
    renderPage();
    expect(
      screen.getByText(/No auction events have been published yet/i)
    ).toBeInTheDocument();
  });

  it("renders event cards with title, window and lot count", () => {
    (useQuery as Mock).mockReturnValue([
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
    ]);
    renderPage();
    expect(screen.getByText("Spring Sale")).toBeInTheDocument();
    expect(screen.getByText("Tractors and combines")).toBeInTheDocument();
    expect(screen.getByText("3 lots")).toBeInTheDocument();
    expect(screen.getByText("Live Now")).toBeInTheDocument();
  });

  it("does not show the Live Now badge for a closed event", () => {
    (useQuery as Mock).mockReturnValue([
      {
        _id: "a2",
        title: "Past Sale",
        bannerImageUrl: undefined,
        startTime: Date.now() - 100000,
        endTime: Date.now() - 1000,
        status: "closed",
        lotCount: 1,
      },
    ]);
    renderPage();
    expect(screen.getByText("Past Sale")).toBeInTheDocument();
    expect(screen.queryByText("Live Now")).not.toBeInTheDocument();
  });

  it("links each card to its container detail page", () => {
    (useQuery as Mock).mockReturnValue([
      {
        _id: "a1",
        title: "Spring Sale",
        bannerImageUrl: undefined,
        startTime: Date.now() - 1000,
        endTime: Date.now() + 100000,
        status: "published",
        lotCount: 3,
      },
    ]);
    renderPage();
    expect(screen.getByRole("link", { name: /Spring Sale/i })).toHaveAttribute(
      "href",
      "/auctions/a1"
    );
  });
});
