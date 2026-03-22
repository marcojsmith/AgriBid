import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { DashboardListSkeleton } from "./DashboardListSkeleton";

describe("DashboardListSkeleton", () => {
  it("should render bids variant by default with correct aria-label", () => {
    render(<DashboardListSkeleton />);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("aria-label", "Loading bids");
  });

  it("should render bids variant with explicit prop", () => {
    render(<DashboardListSkeleton variant="bids" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Loading bids");
  });

  it("should render listings variant", () => {
    render(<DashboardListSkeleton variant="listings" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Loading listings");
  });

  it("should apply custom className", () => {
    const { container } = render(
      <DashboardListSkeleton className="custom-class" />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("should have animate-pulse class on container", () => {
    const { container } = render(<DashboardListSkeleton />);

    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  it("should render skeleton elements for bids variant", () => {
    const { container } = render(<DashboardListSkeleton variant="bids" />);

    const skeletons = container.querySelectorAll("[class*='animate-pulse']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should render skeleton elements for listings variant", () => {
    const { container } = render(<DashboardListSkeleton variant="listings" />);

    const skeletons = container.querySelectorAll("[class*='animate-pulse']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should render 4 stat cards for bids variant", () => {
    const { container } = render(<DashboardListSkeleton variant="bids" />);

    const statCards = container.querySelectorAll("[data-testid='stat-card']");
    expect(statCards.length).toBe(4);
  });

  it("should render 4 status badge skeletons for bids variant", () => {
    const { container } = render(<DashboardListSkeleton variant="bids" />);

    const statusBadges = container.querySelectorAll(
      "[data-testid='status-badge']"
    );
    expect(statusBadges.length).toBe(4);
  });

  it("should render view all button skeleton for bids variant", () => {
    const { container } = render(<DashboardListSkeleton variant="bids" />);

    const viewAllSkeleton = container.querySelector(
      "[data-testid='view-all-skeleton']"
    );
    expect(viewAllSkeleton).toBeInTheDocument();
  });

  it("should render 4 auction card skeletons for bids variant", () => {
    const { container } = render(<DashboardListSkeleton variant="bids" />);

    const auctionCards = container.querySelectorAll(
      "[data-testid='auction-card-skeleton']"
    );
    expect(auctionCards.length).toBe(4);
  });

  it("should render 7 category filter skeletons for listings variant", () => {
    const { container } = render(<DashboardListSkeleton variant="listings" />);

    const categoryFilters = container.querySelectorAll(
      "[data-testid='category-filter-skeleton']"
    );
    expect(categoryFilters.length).toBe(7);
  });

  it("should render 4 auction card skeletons for listings variant", () => {
    const { container } = render(<DashboardListSkeleton variant="listings" />);

    const auctionCards = container.querySelectorAll(
      "[data-testid='auction-card-skeleton']"
    );
    expect(auctionCards.length).toBe(4);
  });

  it("should render correct number of cards for both variants", () => {
    const { container: bidsContainer } = render(
      <DashboardListSkeleton variant="bids" />
    );
    const { container: listingsContainer } = render(
      <DashboardListSkeleton variant="listings" />
    );

    const bidsCards = bidsContainer.querySelectorAll(
      "[data-testid='auction-card-skeleton']"
    );
    const listingsCards = listingsContainer.querySelectorAll(
      "[data-testid='auction-card-skeleton']"
    );
    expect(bidsCards.length).toBe(4);
    expect(listingsCards.length).toBe(4);
  });
});
