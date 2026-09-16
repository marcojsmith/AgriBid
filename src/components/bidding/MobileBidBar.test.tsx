import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";

import type { LotDetail } from "@/types/auction";
import { useSession } from "@/lib/auth-client";

import { MobileBidBar } from "./MobileBidBar";

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

/**
 * Builds a lot-detail test fixture. Defaults to a live, biddable lot.
 *
 * @param overrides - Fields to override on the base fixture
 * @returns A lot detail fixture
 */
const createMockLot = (overrides: Partial<LotDetail> = {}): LotDetail =>
  ({
    _id: "lot123" as Id<"lots">,
    _creationTime: Date.now(),
    title: "Test Lot",
    make: "John Deere",
    model: "5075E",
    year: 2020,
    operatingHours: 1500,
    location: "Iowa, USA",
    categoryName: "Tractors",
    startingPrice: 45000,
    reservePrice: 50000,
    currentPrice: 47500,
    minIncrement: 100,
    sellerId: "seller123",
    status: "assigned",
    auctionStatus: "published",
    auctionStartTime: Date.now() - 60_000,
    auctionEndTime: Date.now() + 60_000,
    images: { additional: [] },
    ...overrides,
  }) as unknown as LotDetail;

const renderComponent = (auction: LotDetail) =>
  render(
    <MemoryRouter>
      <MobileBidBar auction={auction} />
      <div id="bidding-panel" />
    </MemoryRouter>
  );

describe("MobileBidBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Not implemented in JSDOM
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user123" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    vi.mocked(useQuery).mockReturnValue({
      profile: { isVerified: true, kycStatus: "verified" },
    });
  });

  it("shows the current bid price", () => {
    renderComponent(createMockLot());
    expect(screen.getByText(/Current bid/i)).toBeInTheDocument();
    expect(screen.getByText(/47[,.\s\u00A0\u202F]*500/)).toBeInTheDocument();
  });

  it("shows status text without an action button for a closed auction", () => {
    renderComponent(createMockLot({ status: "sold" }));

    expect(screen.getByText(/Auction sold/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /place bid/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /verify to bid/i })
    ).not.toBeInTheDocument();
  });

  it("shows ended text without an action button when the end time has passed", () => {
    const auction = createMockLot({
      auctionEndTime: Date.now() - 1000,
    });
    renderComponent(auction);

    expect(screen.getByText(/Auction ended/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /place bid/i })
    ).not.toBeInTheDocument();
  });

  it("shows a Verify to bid link for logged-in unverified users", () => {
    vi.mocked(useQuery).mockReturnValue({
      profile: { isVerified: false, kycStatus: "none" },
    });

    renderComponent(createMockLot());

    const verifyLink = screen.getByRole("link", { name: /verify to bid/i });
    expect(verifyLink).toHaveAttribute("href", "/kyc");
    expect(
      screen.queryByRole("button", { name: /place bid/i })
    ).not.toBeInTheDocument();
  });

  it("shows a Place bid button that scrolls to the bidding panel for verified users", () => {
    renderComponent(createMockLot());

    const placeBidButton = screen.getByRole("button", {
      name: /place bid/i,
    });
    fireEvent.click(placeBidButton);

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
    });
  });

  it("shows a Place bid button for logged-out users", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof useSession>);

    renderComponent(createMockLot());

    expect(
      screen.getByRole("button", { name: /place bid/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /verify to bid/i })
    ).not.toBeInTheDocument();
  });

  it("shows a Place bid button while the profile query is still loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);

    renderComponent(createMockLot());

    expect(
      screen.getByRole("button", { name: /place bid/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /verify to bid/i })
    ).not.toBeInTheDocument();
  });
});
