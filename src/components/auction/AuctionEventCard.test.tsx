import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { useNow } from "@/hooks/useNow";

import { AuctionEventCard, type AuctionEvent } from "./AuctionEventCard";

vi.mock("@/hooks/useNow");

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;

const baseEvent: AuctionEvent = {
  _id: "a1" as AuctionEvent["_id"],
  _creationTime: 0,
  title: "Spring Sale",
  description: "Tractors and combines",
  bannerImageUrl: undefined,
  startTime: NOW - HOUR,
  endTime: NOW + 48 * HOUR,
  status: "published",
  createdBy: "admin1",
  createdAt: 0,
  updatedAt: 0,
  lotCount: 3,
  lotCountCapped: false,
  fromPrice: null,
  leadImageUrls: [],
  location: null,
  effectiveEndTime: NOW + 48 * HOUR,
  defaultBuyerPremiumPct: undefined,
  defaultSellerCommissionPct: undefined,
};

const renderCard = (
  event: AuctionEvent,
  props: { className?: string; headingLevel?: "h2" | "h3" } = {}
) =>
  render(
    <MemoryRouter>
      <AuctionEventCard event={event} {...props} />
    </MemoryRouter>
  );

describe("AuctionEventCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNow).mockReturnValue(NOW);
  });

  it("renders the title as an h3 link to the sale and a one-line summary", () => {
    renderCard(baseEvent);
    const heading = screen.getByRole("heading", {
      level: 3,
      name: "Spring Sale",
    });
    expect(within(heading).getByRole("link")).toHaveAttribute(
      "href",
      "/auctions/a1"
    );
    expect(screen.getByText("Tractors and combines")).toHaveClass(
      "line-clamp-1"
    );
  });

  it("can render the title as an h2", () => {
    renderCard(baseEvent, { headingLevel: "h2" });
    expect(
      screen.getByRole("heading", { level: 2, name: "Spring Sale" })
    ).toBeInTheDocument();
  });

  it("omits the summary when there is no description", () => {
    renderCard({ ...baseEvent, description: undefined });
    expect(screen.queryByText("Tractors and combines")).toBeNull();
  });

  it("shows the location, lot count and from-price", () => {
    renderCard({
      ...baseEvent,
      location: "Bothaville, FS",
      fromPrice: 200000,
    });
    expect(screen.getByText("Bothaville, FS")).toBeInTheDocument();
    expect(screen.getByText("3 lots")).toBeInTheDocument();
    expect(screen.getByText(/^R\s200\s000$/)).toBeInTheDocument();
    expect(screen.getByText(/^From/)).toBeInTheDocument();
  });

  it("hides the location and price rows when unknown", () => {
    renderCard(baseEvent);
    expect(screen.queryByText(/^From/)).toBeNull();
    expect(screen.getByText("3 lots")).toBeInTheDocument();
  });

  it("uses the singular label for exactly one lot", () => {
    renderCard({ ...baseEvent, lotCount: 1 });
    expect(screen.getByText("1 lot")).toBeInTheDocument();
  });

  it("marks a capped lot count with a plus and plural label", () => {
    renderCard({ ...baseEvent, lotCount: 1, lotCountCapped: true });
    expect(screen.getByText("1+ lots")).toBeInTheDocument();
  });

  it("shows a Live badge and a Closes in countdown for an open sale", () => {
    renderCard(baseEvent);
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText(/Closes in/)).toBeInTheDocument();
  });

  it("shows Closing soon (never colour alone) inside the last 24 hours", () => {
    renderCard({ ...baseEvent, effectiveEndTime: NOW + 5 * HOUR });
    expect(screen.getByText("Closing soon")).toBeInTheDocument();
  });

  it("uses the urgent chip colour inside the last hour", () => {
    renderCard({ ...baseEvent, effectiveEndTime: NOW + 20 * 60 * 1000 });
    expect(screen.getByText(/Closes in/).closest("span")).toHaveClass(
      "bg-urgent-solid"
    );
  });

  it("shows when an upcoming sale opens and an Opens in chip", () => {
    renderCard({
      ...baseEvent,
      startTime: NOW + 10 * HOUR,
      endTime: NOW + 80 * HOUR,
      effectiveEndTime: NOW + 80 * HOUR,
    });
    expect(screen.getByText(/^Opens .*SAST$/)).toBeInTheDocument();
    expect(screen.getByText(/Opens in/)).toBeInTheDocument();
    expect(screen.queryByText("Live")).toBeNull();
  });

  it("shows Closed with the close date for an ended sale", () => {
    renderCard({
      ...baseEvent,
      status: "closed",
      endTime: NOW - 5 * HOUR,
      effectiveEndTime: NOW - 5 * HOUR,
    });
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.queryByText(/Closes in|Opens in/)).toBeNull();
    expect(screen.getByText(/^Closed .*SAST$/)).toBeInTheDocument();
    expect(screen.queryByText("Live")).toBeNull();
  });

  it("keeps the sale Live during a soft-close extension past the scheduled end", () => {
    renderCard({
      ...baseEvent,
      endTime: NOW - 1000,
      effectiveEndTime: NOW + 60000,
    });
    expect(screen.getByText(/Closes in/)).toBeInTheDocument();
  });

  it("states when the lots close in SAST", () => {
    renderCard(baseEvent);
    expect(screen.getByText(/^Lots close from .*SAST$/)).toBeInTheDocument();
  });

  it("has a View lots link of at least 44px on phones", () => {
    renderCard(baseEvent);
    const link = screen.getByRole("link", { name: "View lots: Spring Sale" });
    expect(link).toHaveAttribute("href", "/auctions/a1");
    expect(link).toHaveClass("max-md:h-11");
  });

  it("renders the lead photos as a mosaic", () => {
    renderCard({
      ...baseEvent,
      leadImageUrls: [
        "https://cdn/1.jpg",
        "https://cdn/2.jpg",
        "https://cdn/3.jpg",
      ],
    });
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(
      screen.getByRole("img", { name: "Spring Sale, photo 1" })
    ).toHaveAttribute("src", "https://cdn/1.jpg");
  });

  it("falls back to the banner image when there are no lead photos", () => {
    renderCard({ ...baseEvent, bannerImageUrl: "https://cdn/banner.jpg" });
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://cdn/banner.jpg"
    );
  });

  it("shows the branded empty state when there are no photos at all", () => {
    renderCard(baseEvent);
    expect(
      screen.getByRole("img", { name: "Spring Sale: no photos yet" })
    ).toBeInTheDocument();
  });

  it("merges extra layout classes onto the card", () => {
    const { container } = renderCard(baseEvent, { className: "lg:grid" });
    expect(container.firstElementChild).toHaveClass("lg:grid");
  });
});
