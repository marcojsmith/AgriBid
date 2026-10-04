import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import type { Id } from "convex/_generated/dataModel";

import { BidCard } from "./BidCard";
import type { MyBidAuction } from "./bidTypes";

// Counts renders of the status badge so memoization can be observed.
const { badgeRender } = vi.hoisted(() => ({ badgeRender: vi.fn() }));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => {
    badgeRender();
    return (
      <span data-testid="status-badge" className={className}>
        {children}
      </span>
    );
  },
}));

vi.mock("@/components/CountdownTimer", () => ({
  CountdownTimer: ({
    endTime,
    className,
  }: {
    endTime: number;
    className?: string;
  }) => (
    <div data-testid="countdown-timer" className={className}>
      Ends: {new Date(endTime).toISOString()}
    </div>
  ),
}));

const LOT_ID = "lot1" as Id<"lots">;

/**
 * Build a complete `images` object, overriding only the slots a test sets.
 *
 * The query's return validator makes every slot a required key typed
 * `string | undefined`, so the fixture has to name all of them.
 *
 * @param overrides - Image slots to override on the default object
 * @returns An images object shaped like a `getMyBids` lot summary
 */
const makeImages = (
  overrides: Partial<MyBidAuction["images"]> = {}
): MyBidAuction["images"] => ({
  front: overrides.front,
  engine: overrides.engine,
  cabin: overrides.cabin,
  rear: overrides.rear,
  additional: overrides.additional ?? [],
});

/**
 * The `getMyBids` return validator turns every optional lot field into a
 * *required* key typed `| undefined`, so a typed fixture has to name them all.
 * Their "not set" values live here to keep {@link BASE_BID} readable.
 */
const UNSET_OPTIONAL_LOT_FIELDS = {
  categoryId: undefined,
  durationDays: undefined,
  auctionId: undefined,
  auctionStartTime: undefined,
  auctionStatus: undefined,
  extendedEndTime: undefined,
  winnerId: undefined,
  description: undefined,
  conditionReportUrl: undefined,
  isExtended: undefined,
  seedId: undefined,
  conditionChecklist: undefined,
} satisfies Partial<MyBidAuction>;

/** A complete `getMyBids` page entry; tests clone it and override what they need. */
const BASE_BID: MyBidAuction = {
  ...UNSET_OPTIONAL_LOT_FIELDS,
  _id: LOT_ID,
  _creationTime: 1_700_000_000_000,
  title: "John Deere 8RX",
  make: "John Deere",
  model: "8RX",
  year: 2020,
  operatingHours: 500,
  location: "Cape Town",
  categoryName: "Tractors",
  reservePrice: 2000,
  startingPrice: 1000,
  currentPrice: 3000,
  minIncrement: 100,
  sellerId: "seller1",
  status: "assigned",
  auctionEndTime: 1_700_000_600_000,
  images: makeImages(),
  myHighestBid: 3000,
  bidCount: 1,
  bidAmount: 3000,
  bidTimestamp: 1_700_000_500_000,
  lastBidTimestamp: 1_700_000_500_000,
  isWinning: false,
  isWon: false,
  isOutbid: false,
  isCancelled: false,
};

/**
 * Build a complete bid row, overriding only the fields a test cares about.
 *
 * Merges with `Object.assign` rather than an object spread: a `...overrides`
 * spread would make the row's required `| undefined` keys optional again, which
 * no longer satisfies {@link MyBidAuction}.
 *
 * @param overrides - Fields to override on the default row
 * @returns A bid row shaped like a `getMyBids` page entry
 */
const makeBid = (overrides: Partial<MyBidAuction> = {}): MyBidAuction =>
  Object.assign({ ...BASE_BID }, overrides);

describe("BidCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCard = (auction: MyBidAuction) =>
    render(
      <BrowserRouter>
        <BidCard auction={auction} />
      </BrowserRouter>
    );

  it("shows the title, make/model and the user's bid", () => {
    renderCard(makeBid());

    expect(screen.getByText("John Deere 8RX")).toBeInTheDocument();
    expect(screen.getByText("John Deere")).toBeInTheDocument();
    expect(screen.getByText("8RX")).toBeInTheDocument();
    expect(screen.getByText("My Bid")).toBeInTheDocument();
    expect(screen.getByText(/1 bid$/)).toBeInTheDocument();
  });

  it("shows the next minimum bid while the lot is live", () => {
    renderCard(makeBid());

    expect(screen.getByText("Next Min")).toBeInTheDocument();
    // currentPrice (3000) + minIncrement (100)
    expect(screen.getByText("R 3 100,00")).toBeInTheDocument();
    expect(screen.getByTestId("countdown-timer")).toBeInTheDocument();
  });

  it("shows the final price once the lot has ended", () => {
    renderCard(makeBid({ status: "sold", isWon: true, myHighestBid: 2500 }));

    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.getByText("R 3 000,00")).toBeInTheDocument();
    expect(screen.queryByTestId("countdown-timer")).not.toBeInTheDocument();
  });

  it("omits the countdown when the lot has no end time", () => {
    renderCard(makeBid({ auctionEndTime: undefined }));

    expect(screen.queryByTestId("countdown-timer")).not.toBeInTheDocument();
  });

  it.each([
    [{ isWon: true }, "WON"],
    [{ isWinning: true }, "WINNING"],
    [{ isOutbid: true }, "OUTBID"],
    [{ status: "unsold" }, "RESERVE NOT MET"],
    [{ isCancelled: true }, "CANCELLED"],
    [{ status: "pending_review" }, "PENDING_REVIEW"],
  ] as const)("renders the %s badge as %s", (overrides, label) => {
    renderCard(makeBid(overrides));

    expect(screen.getByTestId("status-badge")).toHaveTextContent(label);
  });

  it("flags an outbid lot and links to raising the bid", () => {
    renderCard(makeBid({ isOutbid: true, myHighestBid: 2000 }));

    expect(screen.getByText("Outbid!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /raise bid/i })).toHaveAttribute(
      "href",
      `/auction/${LOT_ID}`
    );
  });

  it("links to the lot with a view label that matches the status", () => {
    const { unmount } = renderCard(makeBid());
    expect(
      screen.getByRole("link", { name: "View Details" })
    ).toBeInTheDocument();
    unmount();

    renderCard(makeBid({ status: "sold" }));
    expect(
      screen.getByRole("link", { name: "View Results" })
    ).toBeInTheDocument();
  });

  it("falls back to a placeholder when the lot has no image", () => {
    renderCard(makeBid({ images: makeImages() }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the lot image with the title as alt text", () => {
    renderCard(makeBid({ images: makeImages({ front: "front.jpg" }) }));

    expect(screen.getByRole("img", { name: "John Deere 8RX" })).toHaveAttribute(
      "src",
      "front.jpg"
    );
  });

  it("does not re-render when its props are unchanged", () => {
    const auction = makeBid();
    const { rerender } = renderCard(auction);
    expect(badgeRender).toHaveBeenCalledTimes(1);

    rerender(
      <BrowserRouter>
        <BidCard auction={auction} />
      </BrowserRouter>
    );

    expect(badgeRender).toHaveBeenCalledTimes(1);
  });

  it("re-renders when the bid changes", () => {
    const { rerender } = renderCard(makeBid());
    expect(badgeRender).toHaveBeenCalledTimes(1);

    rerender(
      <BrowserRouter>
        <BidCard auction={makeBid({ isWinning: true })} />
      </BrowserRouter>
    );

    expect(badgeRender).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("WINNING");
  });
});
