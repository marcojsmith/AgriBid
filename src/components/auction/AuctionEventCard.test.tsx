import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { useNow } from "@/hooks/useNow";

import { AuctionEventCard, type AuctionEvent } from "./AuctionEventCard";

vi.mock("@/hooks/useNow");

const NOW = Date.now();

const baseEvent: AuctionEvent = {
  _id: "a1" as AuctionEvent["_id"],
  _creationTime: 0,
  title: "Spring Sale",
  description: "Tractors and combines",
  bannerImageUrl: undefined,
  startTime: NOW - 1000,
  endTime: NOW + 100000,
  status: "published",
  createdBy: "admin1",
  createdAt: 0,
  updatedAt: 0,
  lotCount: 3,
  defaultBuyerPremiumPct: undefined,
  defaultSellerCommissionPct: undefined,
};

const renderCard = (event: AuctionEvent) =>
  render(
    <MemoryRouter>
      <AuctionEventCard event={event} />
    </MemoryRouter>
  );

describe("AuctionEventCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNow).mockReturnValue(NOW);
  });

  it("renders title, description, date window and lot count", () => {
    renderCard({ ...baseEvent, endTime: NOW + 100000 });
    expect(screen.getByText("Spring Sale")).toBeInTheDocument();
    expect(screen.getByText("Tractors and combines")).toBeInTheDocument();
    expect(screen.getByText("3 lots")).toBeInTheDocument();
    const dateText = `${new Date(baseEvent.startTime).toLocaleDateString()} – ${new Date(baseEvent.endTime).toLocaleDateString()}`;
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" && element.textContent === dateText
      )
    ).toBeInTheDocument();
  });

  it("uses the singular 'lot' label for a single lot", () => {
    renderCard({ ...baseEvent, lotCount: 1 });
    expect(screen.getByText("1 lot")).toBeInTheDocument();
  });

  it("renders the banner image when a banner URL is present", () => {
    renderCard({ ...baseEvent, bannerImageUrl: "https://cdn/banner.jpg" });
    expect(screen.getByRole("img", { name: "Spring Sale" })).toHaveAttribute(
      "src",
      "https://cdn/banner.jpg"
    );
  });

  it("renders a placeholder when no banner URL is present", () => {
    renderCard(baseEvent);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the Live Now badge for a published event inside its window", () => {
    renderCard({ ...baseEvent, status: "published" });
    expect(screen.getByText("Live Now")).toBeInTheDocument();
  });

  it("does not show the Live Now badge for a closed event", () => {
    renderCard({ ...baseEvent, status: "closed" });
    expect(screen.queryByText("Live Now")).not.toBeInTheDocument();
  });

  it("does not show the Live Now badge for a published event whose window has ended", () => {
    renderCard({ ...baseEvent, endTime: NOW - 1000 });
    expect(screen.queryByText("Live Now")).not.toBeInTheDocument();
  });

  it("does not show the Live Now badge when the event has not started yet", () => {
    renderCard({
      ...baseEvent,
      startTime: NOW + 100000,
      endTime: NOW + 200000,
    });
    expect(screen.queryByText("Live Now")).not.toBeInTheDocument();
  });

  it("links to the container detail page", () => {
    renderCard(baseEvent);
    expect(screen.getByRole("link", { name: /Spring Sale/i })).toHaveAttribute(
      "href",
      "/auctions/a1"
    );
  });

  it("uses a shorter banner and tighter body padding on phones", () => {
    renderCard({ ...baseEvent, bannerImageUrl: "https://cdn/banner.jpg" });

    expect(
      screen.getByRole("img", { name: "Spring Sale" }).parentElement
    ).toHaveClass("h-32", "sm:h-40");
    expect(screen.getByText("Spring Sale").parentElement).toHaveClass(
      "p-3",
      "sm:p-4"
    );
  });
});
