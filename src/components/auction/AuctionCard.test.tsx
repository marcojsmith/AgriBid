import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import { useSession } from "@/lib/auth-client";
import { isValidCallbackUrl } from "@/lib/utils";
import type { LotSummary } from "@/types/auction";

import { AuctionCard } from "./AuctionCard";

// Define mockNavigate at top level so it's accessible to vi.mock
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      mutations: {
        bidding: {
          placeBid: { _path: "auctions/mutations/bidding:placeBid" },
        },
      },
    },
    watchlist: {
      toggleWatchlist: { _path: "watchlist:toggleWatchlist" },
    },
  },
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  isValidCallbackUrl: vi.fn().mockReturnValue(true),
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const mockAuction = {
  _id: "lot123" as Id<"lots">,
  _creationTime: Date.now(),
  title: "Test Tractor",
  description: undefined,
  make: "John Deere",
  model: "6155R",
  year: 2020,
  currentPrice: 1000,
  minIncrement: 100,
  startingPrice: 1000,
  reservePrice: 2000,
  durationDays: undefined,
  status: "assigned",
  auctionId: "auction123" as Id<"auctions">,
  auctionStatus: "published" as const,
  auctionStartTime: Date.now() - 60_000,
  auctionEndTime: Date.now() + 100000,
  extendedEndTime: undefined,
  location: "Cape Town",
  operatingHours: 500,
  categoryId: undefined,
  categoryName: "Tractors",
  sellerId: "seller1",
  winnerId: undefined,
  conditionReportUrl: undefined,
  isExtended: undefined,
  seedId: undefined,
  conditionChecklist: undefined,
  bidCount: 5,
  images: {
    front: "image.jpg",
    engine: undefined,
    cabin: undefined,
    rear: undefined,
    additional: [] as string[],
  },
};

describe("AuctionCard", () => {
  const mockPlaceBid = vi.fn();
  const mockToggleWatchlist = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockImplementation((apiRef: { _path: string }) => {
      if (apiRef._path === "auctions/mutations/bidding:placeBid")
        return mockPlaceBid;
      if (apiRef._path === "watchlist:toggleWatchlist")
        return mockToggleWatchlist;
      return vi.fn();
    });
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "user1" } },
    });
  });

  const renderWithRouter = (
    props?: Partial<React.ComponentProps<typeof AuctionCard>>
  ) => {
    return render(
      <BrowserRouter>
        <AuctionCard
          {...props}
          auction={
            props?.auction ??
            (mockAuction as unknown as React.ComponentProps<
              typeof AuctionCard
            >["auction"])
          }
        />
      </BrowserRouter>
    );
  };

  it("renders auction details correctly", () => {
    renderWithRouter();
    expect(screen.getByText("Test Tractor")).toBeInTheDocument();
    expect(screen.getByText("Tractors")).toBeInTheDocument();
    expect(screen.getByText(/500 hrs/i)).toBeInTheDocument();
    expect(screen.getByText(/Cape Town/i)).toBeInTheDocument();
  });

  it("renders bid button with correct amount", () => {
    renderWithRouter();
    const bidButton = screen.getByRole("button", { name: /Bid R 1/i });
    expect(bidButton).toBeInTheDocument();
    // South African locale uses space as thousands separator
    expect(bidButton.textContent).toMatch(/1\s*100/);
  });

  it("initiates bid process for authenticated user", () => {
    renderWithRouter();
    const bidButton = screen.getByRole("button", { name: /Bid R 1/i });
    fireEvent.click(bidButton);

    expect(screen.getByText(/Confirm Your Bid/i)).toBeInTheDocument();
  });

  it("redirects to login for unauthenticated user trying to bid", () => {
    (useSession as Mock).mockReturnValue({ data: null });
    renderWithRouter();

    const bidButton = screen.getByRole("button", { name: /Bid R 1/i });
    fireEvent.click(bidButton);

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("sign in to place a bid")
    );
    expect(mockNavigate).toHaveBeenCalled();
  });

  it("redirects to login for unauthenticated user trying to watchlist", () => {
    (useSession as Mock).mockReturnValue({ data: null });
    renderWithRouter();

    const watchlistButton = screen.getByRole("button", { name: /watchlist/i });
    fireEvent.click(watchlistButton);

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("sign in to watch an auction")
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("/login?callbackUrl=")
    );
  });

  it("cancels bid confirmation", () => {
    renderWithRouter();
    fireEvent.click(screen.getByRole("button", { name: /Bid R 1/i }));

    expect(screen.getByText(/Confirm Your Bid/i)).toBeInTheDocument();

    // Close using Cancel button
    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(screen.queryByText(/Confirm Your Bid/i)).not.toBeInTheDocument();
  });

  it("successfully places a bid", async () => {
    mockPlaceBid.mockResolvedValue({});
    renderWithRouter();

    // Open confirmation
    fireEvent.click(screen.getByRole("button", { name: /Bid R 1/i }));

    // Click confirm in modal
    const confirmButton = screen.getByRole("button", {
      name: /^Confirm Bid$/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockPlaceBid).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Bid placed successfully!");
    });
  });

  it("handles bid errors correctly", async () => {
    mockPlaceBid.mockRejectedValue(new Error("Outbid"));
    renderWithRouter();

    fireEvent.click(screen.getByRole("button", { name: /Bid R 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Confirm Bid$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("handles watchlist toggle", async () => {
    mockToggleWatchlist.mockResolvedValue(true);
    renderWithRouter();

    // Find watchlist button (heart icon)
    const watchlistButton = screen.getByRole("button", { name: /watchlist/i });
    fireEvent.click(watchlistButton);

    await waitFor(() => {
      expect(mockToggleWatchlist).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Added to watchlist");
    });
  });

  it("renders closed state", () => {
    const closedAuction = { ...mockAuction, status: "sold" as const };
    renderWithRouter({ auction: closedAuction });

    expect(screen.getByText("Sold")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Closed" })).toBeDisabled();
  });

  it("renders compact view mode correctly", () => {
    const compactAuction = {
      ...mockAuction,
      description: "Short desc",
    };
    renderWithRouter({
      auction: compactAuction as unknown as React.ComponentProps<
        typeof AuctionCard
      >["auction"],
      viewMode: "compact",
    });

    expect(screen.getByText("Short desc")).toBeInTheDocument();
    // Compact mode doesn't show operating hours/location in details area
    expect(screen.queryByText(/500 hrs/i)).not.toBeInTheDocument();
  });

  it("shows a phone-only current bid figure in compact view", () => {
    renderWithRouter({
      auction: mockAuction as unknown as LotSummary,
      viewMode: "compact",
    });

    // formatCurrency uses a space as thousands separator
    const currentBid = screen.getByText("Current bid");
    expect(currentBid).toHaveTextContent("R 1 000,00");
    expect(currentBid).toHaveClass("sm:hidden");
  });

  it("does not add the phone-only current bid line in detailed view", () => {
    renderWithRouter({
      auction: mockAuction as unknown as LotSummary,
      viewMode: "detailed",
    });

    expect(screen.getByText("Current bid")).not.toHaveClass("sm:hidden");
  });

  it("marks the card content as a container so the price row can query it", () => {
    renderWithRouter({
      auction: mockAuction as unknown as LotSummary,
      viewMode: "detailed",
    });

    // AuctionCardPrice switches layout with container queries, and an element
    // cannot query its own container — the `@container` has to be an ancestor.
    expect(
      screen.getByText("Current bid").closest('[class~="@container"]')
    ).not.toBeNull();
  });

  it("pins the bid footer to the bottom of a stretched card", () => {
    renderWithRouter({ viewMode: "detailed" });

    const bidButton = screen.getByRole("button", { name: /Bid R 1/i });
    const footer = bidButton.parentElement;
    const cardBody = footer?.parentElement;

    // A grid row stretches the shorter card to its neighbour's height. Without a
    // full-height flex column the footer stays put and leaves a white strip.
    expect(cardBody).toHaveClass("flex", "flex-col", "h-full");
    expect(cardBody?.querySelector("a")).toHaveClass("flex-1");
    expect(footer).toHaveClass("mt-auto");
  });

  it("uses tighter card padding on phones and keeps the bid button tappable", () => {
    renderWithRouter({ viewMode: "detailed" });

    const title = screen.getByText("Test Tractor");
    const cardHeader = title.parentElement?.parentElement;
    const cardContent = cardHeader?.nextElementSibling;
    const bidButton = screen.getByRole("button", { name: /Bid R 1/i });

    // `p-4 md:p-5` on every block added ~24px of dead padding per phone card.
    expect(cardHeader).toHaveClass("p-3", "sm:p-4", "md:p-5");
    expect(cardContent).toHaveClass("p-3", "sm:p-4", "md:p-5");
    expect(bidButton.parentElement).toHaveClass("p-3", "sm:p-4", "md:p-5");
    // ...without shrinking the bid button below the 44px touch target.
    expect(bidButton).toHaveClass("h-11");
  });

  it("stretches the compact thumbnail column to the height of the card body", () => {
    renderWithRouter({ viewMode: "compact" });

    const image = screen.getByAltText(
      `${mockAuction.make} — ${mockAuction.model} — ${mockAuction.title}`
    );
    const wrapper = image.parentElement?.parentElement?.parentElement;

    // The thumbnail column used to be content-sized, so a taller body left a
    // white gap underneath the countdown strip on phones.
    expect(wrapper).toHaveClass("self-stretch");
  });

  it("clamps compact titles to three lines and shortens the description to match", () => {
    renderWithRouter({
      auction: {
        ...mockAuction,
        description: "Short desc",
      } as unknown as LotSummary,
      viewMode: "compact",
    });

    // Tablets show compact cards in two columns, where a two-line clamp hid
    // the tail of titles such as "Fendt 1050 Vario — German...".
    const title = screen.getByText("Test Tractor");
    expect(title).toHaveClass("line-clamp-3");
    expect(title.className).not.toContain("line-clamp-2");
    // One line moves from the title to the description, so card height holds.
    expect(screen.getByText("Short desc")).toHaveClass("line-clamp-2");
  });

  it("keeps the two-line title clamp in detailed view", () => {
    renderWithRouter({ viewMode: "detailed" });

    const title = screen.getByText("Test Tractor");
    expect(title).toHaveClass("line-clamp-2");
    expect(title.className).not.toContain("line-clamp-3");
  });

  it("handles watchlist removal", async () => {
    mockToggleWatchlist.mockResolvedValue(false); // Returning false means removed
    renderWithRouter({ isWatched: true });

    const watchlistButton = screen.getByRole("button", { name: /watchlist/i });
    fireEvent.click(watchlistButton);

    await waitFor(() => {
      expect(mockToggleWatchlist).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Removed from watchlist");
    });
  });

  it("handles watchlist toggle error", async () => {
    mockToggleWatchlist.mockRejectedValue(new Error("Fail"));
    renderWithRouter();

    const watchlistButton = screen.getByRole("button", { name: /watchlist/i });
    fireEvent.click(watchlistButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update watchlist");
    });
  });

  it("handles price update during bid confirmation", () => {
    const { rerender } = renderWithRouter();

    // Open confirmation
    fireEvent.click(screen.getByRole("button", { name: /Bid R 1/i }));

    // Update auction prop to simulate price increase from server
    const updatedAuction = {
      ...mockAuction,
      currentPrice: 1500, // Price went up
    };

    rerender(
      <BrowserRouter>
        <AuctionCard
          auction={
            updatedAuction as unknown as React.ComponentProps<
              typeof AuctionCard
            >["auction"]
          }
        />
      </BrowserRouter>
    );

    // Click confirm - should show error because pendingBid (1100) < new minimum (1600)
    const confirmButton = screen.getByRole("button", {
      name: /^Confirm Bid$/i,
    });
    fireEvent.click(confirmButton);

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Price updated")
    );
  });

  it("handles front image as primary", () => {
    const auction = { ...mockAuction, images: { front: "front.jpg" } };
    renderWithRouter({
      auction: auction as unknown as LotSummary,
    });
    const img = screen.getByAltText(
      `${mockAuction.make} — ${mockAuction.model} — ${mockAuction.title}`
    );
    expect(img).toHaveAttribute("src", "front.jpg");
  });

  it("handles engine image fallback as primary", () => {
    const auction = { ...mockAuction, images: { engine: "engine.jpg" } };
    renderWithRouter({
      auction: auction as unknown as LotSummary,
    });
    const img = screen.getByAltText(
      `${mockAuction.make} — ${mockAuction.model} — ${mockAuction.title}`
    );
    expect(img).toHaveAttribute("src", "engine.jpg");
  });

  it("handles cabin image fallback as primary", () => {
    const auction = { ...mockAuction, images: { cabin: "cabin.jpg" } };
    renderWithRouter({
      auction: auction as unknown as LotSummary,
    });
    const img = screen.getByAltText(
      `${mockAuction.make} — ${mockAuction.model} — ${mockAuction.title}`
    );
    expect(img).toHaveAttribute("src", "cabin.jpg");
  });

  it("handles rear image fallback as primary", () => {
    const auction = { ...mockAuction, images: { rear: "rear.jpg" } };
    renderWithRouter({
      auction: auction as unknown as LotSummary,
    });
    const img = screen.getByAltText(
      `${mockAuction.make} — ${mockAuction.model} — ${mockAuction.title}`
    );
    expect(img).toHaveAttribute("src", "rear.jpg");
  });

  it("handles additional[0] image fallback as primary", () => {
    const auction = { ...mockAuction, images: { additional: ["add1.jpg"] } };
    renderWithRouter({
      auction: auction as unknown as LotSummary,
    });
    const img = screen.getByAltText(
      `${mockAuction.make} — ${mockAuction.model} — ${mockAuction.title}`
    );
    expect(img).toHaveAttribute("src", "add1.jpg");
  });

  it("handles no image at all", () => {
    const auction = { ...mockAuction, images: { additional: [] } };
    renderWithRouter({
      auction: auction as unknown as LotSummary,
    });
    // Should render a placeholder emoji/text instead of img
    expect(screen.getByText("🚜")).toBeInTheDocument();
  });

  it("handles invalid callback URL during bid initiation", () => {
    vi.mocked(isValidCallbackUrl).mockReturnValueOnce(false);
    (useSession as Mock).mockReturnValue({ data: null });

    renderWithRouter();
    fireEvent.click(screen.getByRole("button", { name: /Bid R 1/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/login?callbackUrl=/");
  });

  it("handles invalid callback URL during watchlist toggle", () => {
    vi.mocked(isValidCallbackUrl).mockReturnValueOnce(false);
    (useSession as Mock).mockReturnValue({ data: null });

    renderWithRouter();
    fireEvent.click(screen.getByRole("button", { name: /watchlist/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/login?callbackUrl=/");
  });

  it("renders closed and compact state with sold badge", () => {
    const closedAuction = { ...mockAuction, status: "sold" as const };
    renderWithRouter({
      auction: closedAuction as unknown as LotSummary,
      viewMode: "compact",
    });

    expect(screen.getByLabelText("Sold auction")).toBeInTheDocument();
  });

  it("renders closed and compact state with unsold badge", () => {
    const closedAuction = { ...mockAuction, status: "unsold" as const };
    renderWithRouter({
      auction: closedAuction as unknown as LotSummary,
      viewMode: "compact",
    });

    expect(screen.getByLabelText("Closed auction")).toBeInTheDocument();
  });

  it("renders closed and detailed state with Sold badge", () => {
    const closedAuction = { ...mockAuction, status: "sold" as const };
    renderWithRouter({
      auction: closedAuction as unknown as LotSummary,
      viewMode: "detailed",
    });

    expect(screen.getByText("Sold")).toBeInTheDocument();
  });

  it("renders closed and detailed state with Unsold badge", () => {
    const closedAuction = { ...mockAuction, status: "unsold" as const };
    renderWithRouter({
      auction: closedAuction as unknown as LotSummary,
      viewMode: "detailed",
    });

    expect(screen.getByText("Unsold")).toBeInTheDocument();
  });

  it("renders active and compact state without closed badges", () => {
    renderWithRouter({
      auction: mockAuction as unknown as LotSummary,
      viewMode: "compact",
    });

    expect(screen.queryByLabelText("Sold auction")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Closed auction")).not.toBeInTheDocument();
  });

  it("renders active and detailed state without closed badges", () => {
    renderWithRouter({
      auction: mockAuction as unknown as LotSummary,
      viewMode: "detailed",
    });

    expect(screen.queryByText("Sold")).not.toBeInTheDocument();
    expect(screen.queryByText("Unsold")).not.toBeInTheDocument();
  });

  describe("scheduled (not-started) auctions (#296)", () => {
    const notStartedAuction = {
      ...mockAuction,
      status: "assigned" as const,
      auctionStartTime: Date.now() + 60_000,
    };

    it("shows a 'Scheduled' badge in detailed view", () => {
      renderWithRouter({
        auction: notStartedAuction as unknown as LotSummary,
        viewMode: "detailed",
      });

      expect(screen.getByText("Scheduled")).toBeInTheDocument();
    });

    it("shows a scheduled icon badge in compact view", () => {
      renderWithRouter({
        auction: notStartedAuction as unknown as LotSummary,
        viewMode: "compact",
      });

      expect(
        screen.getByLabelText("Scheduled auction, not yet started")
      ).toBeInTheDocument();
    });

    it("disables the bid button and shows 'Not Started'", () => {
      renderWithRouter({
        auction: notStartedAuction as unknown as LotSummary,
      });

      const bidButton = screen.getByRole("button", { name: "Not Started" });
      expect(bidButton).toBeDisabled();
    });

    it("shows a 'Starts in' countdown instead of 'Ends in'", () => {
      renderWithRouter({
        auction: notStartedAuction as unknown as LotSummary,
      });

      expect(screen.getByText("Starts in")).toBeInTheDocument();
      expect(screen.queryByText("Ends in")).not.toBeInTheDocument();
      expect(screen.getByText("Starting price")).toBeInTheDocument();
    });

    it("does not show scheduled badges once startTime has passed", () => {
      const startedAuction = {
        ...mockAuction,
        status: "assigned" as const,
        auctionStartTime: Date.now() - 60_000,
      };
      renderWithRouter({
        auction: startedAuction as unknown as LotSummary,
      });

      expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Bid R 1/i })
      ).not.toBeDisabled();
    });

    it("does not treat a future startTime as scheduled for non-active auctions", () => {
      const draftAuction = {
        ...mockAuction,
        status: "draft" as const,
        auctionStartTime: Date.now() + 60_000,
      };
      renderWithRouter({
        auction: draftAuction as unknown as LotSummary,
      });

      expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
    });
  });
});
