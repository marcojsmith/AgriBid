import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { AuctionCardThumbnail } from "../auction/AuctionCardThumbnail";

describe("AuctionCardThumbnail", () => {
  const defaultProps = {
    primaryImage: "https://example.com/image.jpg",
    title: "Test Auction",
    isCompact: false,
    isWatched: false,
    onWatchlistToggle: vi.fn(),
    endTime: undefined,
    isClosed: false,
  };

  it("renders primary image when provided", () => {
    render(<AuctionCardThumbnail {...defaultProps} />);
    const img = screen.getByAltText("Test Auction");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/image.jpg");
  });

  it("renders placeholder when no image", () => {
    render(<AuctionCardThumbnail {...defaultProps} primaryImage={undefined} />);
    expect(screen.getByText("Image Pending")).toBeInTheDocument();
    expect(screen.getByText("🚜")).toBeInTheDocument();
  });

  it("renders watchlist button", () => {
    render(<AuctionCardThumbnail {...defaultProps} />);
    const button = screen.getByRole("button", { name: /add to watchlist/i });
    expect(button).toBeInTheDocument();
  });

  it("calls onWatchlistToggle when button clicked", async () => {
    const mockToggle = vi.fn().mockResolvedValue(undefined);
    render(
      <AuctionCardThumbnail {...defaultProps} onWatchlistToggle={mockToggle} />
    );

    const button = screen.getByRole("button", { name: /add to watchlist/i });
    fireEvent.click(button);

    expect(mockToggle).toHaveBeenCalled();
  });

  it("shows red heart when watched", () => {
    render(<AuctionCardThumbnail {...defaultProps} isWatched={true} />);
    const button = screen.getByRole("button", {
      name: /remove from watchlist/i,
    });
    expect(button).toHaveClass("text-red-500");
  });

  it("renders compact layout when isCompact is true", () => {
    render(<AuctionCardThumbnail {...defaultProps} isCompact={true} />);
    // The compact layout has specific width classes - check for the image element
    const img = screen.getByAltText("Test Auction");
    expect(img).toBeInTheDocument();
  });
});
