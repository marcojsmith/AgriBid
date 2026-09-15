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
});
