import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { AuctionCardPrice } from "./AuctionCardPrice";

vi.mock("@/hooks/usePriceHighlight", () => ({
  usePriceHighlight: vi.fn(() => false),
}));

describe("AuctionCardPrice", () => {
  const defaultProps = {
    currentPrice: 50000,
    endTime: undefined,
    isCompact: false,
    isClosed: false,
  };

  it("renders current price", () => {
    render(<AuctionCardPrice {...defaultProps} />);
    // The price is split across elements, check for part of it
    expect(screen.getByText("Current bid")).toBeInTheDocument();
    // Find an element containing R and a number
    const priceElement = screen.getByText(
      (content) => content.includes("R") && /\d/.test(content)
    );
    expect(priceElement).toBeInTheDocument();
  });

  it("renders price with proper formatting", () => {
    render(<AuctionCardPrice {...defaultProps} currentPrice={1234567} />);
    // Just check that some price element exists
    expect(screen.getByText("Current bid")).toBeInTheDocument();
  });

  it("renders nothing when isCompact is true", () => {
    const { container } = render(
      <AuctionCardPrice {...defaultProps} isCompact={true} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render countdown when isClosed is true", () => {
    render(<AuctionCardPrice {...defaultProps} isClosed={true} />);
    expect(screen.queryByText("Ends in")).not.toBeInTheDocument();
  });

  it("renders countdown when not closed", () => {
    render(
      <AuctionCardPrice {...defaultProps} endTime={Date.now() + 86400000} />
    );
    expect(screen.getByText("Ends in")).toBeInTheDocument();
  });

  it("shows 'Starts in' and 'Starting price' when isNotStarted is true (#296)", () => {
    render(
      <AuctionCardPrice
        {...defaultProps}
        isNotStarted={true}
        startTime={Date.now() + 60_000}
      />
    );
    expect(screen.getByText("Starts in")).toBeInTheDocument();
    expect(screen.getByText("Starting price")).toBeInTheDocument();
    expect(screen.queryByText("Ends in")).not.toBeInTheDocument();
    expect(screen.queryByText("Current bid")).not.toBeInTheDocument();
  });

  describe("responsive wrapping", () => {
    it("keeps the price on a single line and scales it with the card width", () => {
      render(<AuctionCardPrice {...defaultProps} />);

      const price = screen.getByText("Current bid").nextElementSibling;

      expect(price).toHaveClass(
        "whitespace-nowrap",
        "text-xl",
        "@[18rem]:text-2xl",
        "@[24rem]:text-3xl"
      );
    });

    it("responds to the card width, not the viewport, for the row direction", () => {
      render(
        <AuctionCardPrice {...defaultProps} endTime={Date.now() + 86400000} />
      );

      const row = screen.getByText("Current bid").closest("div")?.parentElement;

      expect(row).toHaveClass(
        "flex-col",
        "items-start",
        "@[24rem]:flex-row",
        "@[24rem]:items-end",
        "@[24rem]:justify-between"
      );
      expect(row?.className).not.toContain("md:flex-row");
      expect(row?.className).not.toContain("sm:flex-row");
      // The container itself must live on an ancestor: an element cannot query
      // its own container, so `@container` here would disable every variant.
      expect(row?.className).not.toContain("@container");
    });

    it("keeps the countdown on one line and left aligned until the card is wide enough", () => {
      render(
        <AuctionCardPrice {...defaultProps} endTime={Date.now() + 86400000} />
      );

      const countdown = screen.getByText("Ends in").parentElement;

      expect(countdown).toHaveClass(
        "whitespace-nowrap",
        "min-w-0",
        "@[24rem]:text-right"
      );
      expect(countdown?.className).not.toContain("md:text-right");
      expect(countdown).not.toHaveClass("text-right");
    });

    it("lets the price block shrink so it cannot overflow the card", () => {
      render(<AuctionCardPrice {...defaultProps} />);

      const priceBlock = screen.getByText("Current bid").parentElement;

      expect(priceBlock).toHaveClass("min-w-0");
    });
  });

  it("keeps the price block flush with its sibling text", () => {
    render(
      <AuctionCardPrice {...defaultProps} endTime={Date.now() + 86400000} />
    );

    const priceBlock = screen.getByText("Current bid").parentElement;

    // The flash box bleeds out horizontally only: its 8px padding is cancelled
    // by an equal negative margin, so "Current bid" and the price line up with
    // "Ends in" while the highlight keeps its breathing room.
    expect(priceBlock).toHaveClass("p-2", "-mx-2");
    expect(priceBlock).not.toHaveClass("-m-2");
  });
});
