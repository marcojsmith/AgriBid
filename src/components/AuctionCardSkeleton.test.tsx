import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { AuctionCardSkeleton } from "./AuctionCardSkeleton";

describe("AuctionCardSkeleton", () => {
  it("renders detailed view by default", () => {
    const { container } = render(<AuctionCardSkeleton />);
    // Check for detailed layout markers (aspect-video)
    expect(container.querySelector(".aspect-video")).toBeInTheDocument();
  });

  it("renders compact view", () => {
    const { container } = render(<AuctionCardSkeleton viewMode="compact" />);
    // Check for compact layout markers (w-[120px] or similar)
    expect(container.querySelector(".flex-row")).toBeInTheDocument();
    expect(container.querySelector(".border-r")).toBeInTheDocument();
  });

  it("has aria-hidden attribute", () => {
    const { container } = render(<AuctionCardSkeleton />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("has animate-pulse class", () => {
    const { container } = render(<AuctionCardSkeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });
});
