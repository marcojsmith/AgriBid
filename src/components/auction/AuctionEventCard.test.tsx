import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AuctionEventCard, type AuctionEvent } from "./AuctionEventCard";

const baseEvent: AuctionEvent = {
  _id: "a1" as AuctionEvent["_id"],
  _creationTime: 0,
  title: "Spring Sale",
  description: "Tractors and combines",
  bannerImageUrl: undefined,
  startTime: Date.now() - 1000,
  endTime: Date.now() + 100000,
  status: "published",
  createdBy: "admin1",
  createdAt: 0,
  updatedAt: 0,
  lotCount: 3,
  defaultBuyerPremiumPct: undefined,
  defaultSellerCommissionPct: undefined,
};

const renderCard = (event: AuctionEvent, now: number = Date.now()) =>
  render(
    <MemoryRouter>
      <AuctionEventCard event={event} now={now} />
    </MemoryRouter>
  );

describe("AuctionEventCard", () => {
  it("renders title, description, date window and lot count", () => {
    renderCard({ ...baseEvent, endTime: Date.now() + 100000 });
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
    renderCard({ ...baseEvent, endTime: Date.now() - 1000 });
    expect(screen.queryByText("Live Now")).not.toBeInTheDocument();
  });

  it("does not show the Live Now badge when the event has not started yet", () => {
    renderCard({
      ...baseEvent,
      startTime: Date.now() + 100000,
      endTime: Date.now() + 200000,
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
});
