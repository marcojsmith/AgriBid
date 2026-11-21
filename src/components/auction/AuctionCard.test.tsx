import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import { useSession } from "@/lib/auth-client";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { LotSummary } from "@/types/auction";

import { AuctionCard } from "./AuctionCard";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("convex/react", () => ({ useMutation: vi.fn() }));

vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      mutations: {
        bidding: {
          placeBid: { _path: "auctions/mutations/bidding:placeBid" },
        },
      },
    },
    watchlist: { toggleWatchlist: { _path: "watchlist:toggleWatchlist" } },
  },
}));

vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn() }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const images = (
  over: Partial<LotSummary["images"]> = {}
): LotSummary["images"] => ({
  front: undefined,
  engine: undefined,
  cabin: undefined,
  rear: undefined,
  additional: [],
  ...over,
});

const mockAuction = {
  _id: "lot123" as Id<"lots">,
  _creationTime: Date.now(),
  title: "Test Tractor",
  make: "John Deere",
  model: "6155R",
  year: 2020,
  currentPrice: 1000,
  minIncrement: 100,
  startingPrice: 1000,
  reservePrice: 2000,
  status: "assigned",
  auctionId: "auction123" as Id<"auctions">,
  auctionStatus: "published",
  auctionStartTime: Date.now() - 60_000,
  auctionEndTime: Date.now() + 100_000,
  location: "Cape Town",
  operatingHours: 5200,
  categoryName: "Tractors",
  sellerId: "seller1",
  lotNumber: 12,
  images: images({ front: "image.jpg" }),
} as unknown as LotSummary;

describe("AuctionCard", () => {
  const mockPlaceBid = vi.fn();
  const mockToggleWatchlist = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockImplementation((apiRef: { _path: string }) =>
      apiRef._path === "auctions/mutations/bidding:placeBid"
        ? mockPlaceBid
        : mockToggleWatchlist
    );
    (useSession as Mock).mockReturnValue({ data: { user: { id: "user1" } } });
    (useUserProfile as Mock).mockReturnValue({
      profile: { isVerified: true, kycStatus: "verified" },
    });
  });

  const renderCard = (
    auction: Partial<LotSummary> = {},
    props: Partial<React.ComponentProps<typeof AuctionCard>> = {}
  ) =>
    render(
      <BrowserRouter>
        <AuctionCard auction={{ ...mockAuction, ...auction }} {...props} />
      </BrowserRouter>
    );

  const upcoming = {
    auctionStartTime: Date.now() + 3_600_000,
    auctionEndTime: Date.now() + 7_200_000,
  };
  const ended = {
    auctionStartTime: Date.now() - 7_200_000,
    auctionEndTime: Date.now() - 3_600_000,
  };

  describe("content", () => {
    it("shows the lot eyebrow, make/model title, hours and place", () => {
      renderCard();
      expect(screen.getByText("Lot 12 · Tractors")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "2020 John Deere 6155R" })
      ).toBeInTheDocument();
      expect(screen.getByText(/5\s*200 hrs/)).toBeInTheDocument();
      expect(screen.getByText("Cape Town")).toBeInTheDocument();
    });

    it("omits the lot number when the lot has none", () => {
      renderCard({ lotNumber: undefined });
      expect(screen.getByText("Tractors")).toBeInTheDocument();
    });

    it("prefers the province label over the free-text location", () => {
      renderCard({ province: "free_state" });
      expect(screen.getByText("Free State")).toBeInTheDocument();
      expect(screen.queryByText("Cape Town")).not.toBeInTheDocument();
    });

    it("labels the price Opening bid when nobody has bid", () => {
      renderCard();
      expect(screen.getByText("Opening bid")).toBeInTheDocument();
      expect(screen.getByText(/R\s*1\s*000/)).toBeInTheDocument();
    });

    it("labels the price Current bid once the price has moved", () => {
      renderCard({ currentPrice: 1500 });
      expect(screen.getByText("Current bid")).toBeInTheDocument();
      expect(screen.getByText(/R\s*1\s*500/)).toBeInTheDocument();
    });

    it("shows a reserve pill with its state", () => {
      const { unmount } = renderCard();
      expect(screen.getByText("Reserve not met")).toBeInTheDocument();
      unmount();
      renderCard({ currentPrice: 2500 });
      expect(screen.getByText("Reserve met")).toBeInTheDocument();
    });

    it("shows No reserve when the reserve is zero", () => {
      renderCard({ reservePrice: 0 });
      expect(screen.getByText("No reserve")).toBeInTheDocument();
    });

    it("shows a Closes in countdown while live and Opens in before the start", () => {
      const { unmount } = renderCard();
      expect(screen.getByText("Closes in")).toBeInTheDocument();
      unmount();
      renderCard(upcoming);
      expect(screen.getByText("Opens in")).toBeInTheDocument();
    });

    it("uses the first photo available, with an announced empty state when none", () => {
      const { unmount } = renderCard({
        images: images({ engine: "engine.jpg" }),
      });
      expect(document.querySelector("img")).toHaveAttribute(
        "src",
        "engine.jpg"
      );
      unmount();
      renderCard({ images: images() });
      expect(document.querySelector("img")).toBeNull();
    });
  });

  describe("call to action", () => {
    it("live: shows Bid R x with no cents and opens the confirmation", () => {
      renderCard();
      const bid = screen.getByRole("button", { name: /^Bid R/ });
      expect(bid.textContent).toMatch(/R\s*1\s*100$/);
      fireEvent.click(bid);
      expect(screen.getByText(/Confirm Your Bid/i)).toBeInTheDocument();
    });

    it("live and signed out: Bid sends the guest to sign in", () => {
      (useSession as Mock).mockReturnValue({ data: null });
      renderCard();
      fireEvent.click(screen.getByRole("button", { name: /^Bid R/ }));
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("sign in to place a bid")
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/login?callbackUrl=")
      );
    });

    it("pre-start guest: Register to bid links to sign-in, never a grey Not Started", () => {
      (useSession as Mock).mockReturnValue({ data: null });
      renderCard(upcoming);
      const link = screen.getByRole("link", { name: "Register to bid" });
      expect(link.getAttribute("href")).toContain("/login?callbackUrl=");
      expect(screen.queryByText(/Not Started/i)).not.toBeInTheDocument();
    });

    it("pre-start verified user: Watch lot toggles the watchlist (no pre-start bid exists)", async () => {
      mockToggleWatchlist.mockResolvedValue(true);
      renderCard(upcoming);
      const watch = screen.getByRole("button", { name: "Watch lot" });
      expect(watch).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(watch);
      await waitFor(() => {
        expect(mockToggleWatchlist).toHaveBeenCalledWith({ lotId: "lot123" });
      });
      expect(
        await screen.findByRole("button", { name: "Watching" })
      ).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByText(/max bid/i)).not.toBeInTheDocument();
    });

    it("pre-start verified user already watching sees Watching", () => {
      renderCard(upcoming, { isWatched: true });
      expect(screen.getByRole("button", { name: "Watching" })).toBeVisible();
    });

    it("the seller's own lot offers View lot, never Bid", () => {
      (useSession as Mock).mockReturnValue({
        data: { user: { id: "seller1" } },
      });
      const { unmount } = renderCard();
      expect(screen.getByRole("link", { name: "View lot" })).toHaveAttribute(
        "href",
        "/auction/lot123"
      );
      expect(
        screen.queryByRole("button", { name: /^Bid R/ })
      ).not.toBeInTheDocument();
      unmount();
      renderCard(upcoming);
      expect(screen.getByRole("link", { name: "View lot" })).toBeVisible();
    });

    it("signed in but unverified: Verify to bid links to /kyc", () => {
      (useUserProfile as Mock).mockReturnValue({
        profile: { isVerified: false, kycStatus: "none" },
      });
      renderCard(upcoming);
      expect(
        screen.getByRole("link", { name: "Verify to bid" })
      ).toHaveAttribute("href", "/kyc");
    });

    it("does not ask for verification while the profile is still loading", () => {
      (useUserProfile as Mock).mockReturnValue(undefined);
      renderCard(upcoming);
      expect(
        screen.getByRole("button", { name: "Watch lot" })
      ).toBeInTheDocument();
    });

    it("ended: View result links to the lot and shows no countdown or reserve", () => {
      renderCard({ ...ended, status: "sold" });
      expect(screen.getByRole("link", { name: "View result" })).toHaveAttribute(
        "href",
        "/auction/lot123"
      );
      expect(screen.queryByText("Closes in")).not.toBeInTheDocument();
      expect(screen.queryByText(/Reserve/)).not.toBeInTheDocument();
    });

    it("sold: labels the price Sold for and shows a Sold badge", () => {
      renderCard({ ...ended, status: "sold", currentPrice: 2500 });
      expect(screen.getByText("Sold for")).toBeInTheDocument();
      expect(screen.getByText("Sold")).toBeInTheDocument();
    });

    it("an ended lot with bids reads Highest bid, not Current bid", () => {
      renderCard({ ...ended, status: "assigned", currentPrice: 1500 });
      expect(screen.getByText("Highest bid")).toBeInTheDocument();
      expect(screen.queryByText("Current bid")).not.toBeInTheDocument();
    });

    it("unsold: shows Passed in", () => {
      renderCard({ ...ended, status: "unsold" });
      expect(screen.getByText("Passed in")).toBeInTheDocument();
    });

    it("names the lot for assistive tech on every call to action", () => {
      renderCard();
      const bid = screen.getByRole("button", { name: /^Bid R/ });
      const title = document.getElementById(
        bid.getAttribute("aria-describedby") ?? ""
      );
      expect(title).toHaveTextContent("2020 John Deere 6155R");
    });

    it("every call to action is at least 44px tall", () => {
      renderCard();
      expect(screen.getByRole("button", { name: /^Bid R/ }).className).toMatch(
        /min-h-11/
      );
    });
  });

  describe("bidding", () => {
    it("waits for the profile instead of opening the confirmation", () => {
      (useUserProfile as Mock).mockReturnValue(undefined);
      renderCard();
      fireEvent.click(screen.getByRole("button", { name: /^Bid R/ }));
      expect(toast.info).toHaveBeenCalledWith("Verifying account status...");
      expect(screen.queryByText(/Confirm Your Bid/i)).not.toBeInTheDocument();
    });

    it("refuses to bid when the sale closed while the confirmation was open", () => {
      const { rerender } = renderCard();
      fireEvent.click(screen.getByRole("button", { name: /^Bid R/ }));
      rerender(
        <BrowserRouter>
          <AuctionCard auction={{ ...mockAuction, ...ended }} />
        </BrowserRouter>
      );
      fireEvent.click(screen.getByRole("button", { name: /^Confirm Bid$/i }));
      expect(toast.error).toHaveBeenCalledWith(
        "This auction is not open for bidding"
      );
      expect(mockPlaceBid).not.toHaveBeenCalled();
    });

    it("cancels the confirmation", () => {
      renderCard();
      fireEvent.click(screen.getByRole("button", { name: /^Bid R/ }));
      fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
      expect(screen.queryByText(/Confirm Your Bid/i)).not.toBeInTheDocument();
    });

    it("places a bid", async () => {
      mockPlaceBid.mockResolvedValue({});
      renderCard();
      fireEvent.click(screen.getByRole("button", { name: /^Bid R/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Confirm Bid$/i }));
      await waitFor(() => {
        expect(mockPlaceBid).toHaveBeenCalledWith({
          lotId: "lot123",
          amount: 1100,
        });
        expect(toast.success).toHaveBeenCalledWith("Bid placed successfully!");
      });
    });

    it("reports a failed bid", async () => {
      mockPlaceBid.mockRejectedValue(new Error("Outbid"));
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      renderCard();
      fireEvent.click(screen.getByRole("button", { name: /^Bid R/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Confirm Bid$/i }));
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it("raises the bid when the price moved during confirmation", () => {
      const { rerender } = renderCard();
      fireEvent.click(screen.getByRole("button", { name: /^Bid R/ }));
      rerender(
        <BrowserRouter>
          <AuctionCard auction={{ ...mockAuction, currentPrice: 1200 }} />
        </BrowserRouter>
      );
      fireEvent.click(screen.getByRole("button", { name: /^Confirm Bid$/i }));
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Price updated")
      );
      expect(mockPlaceBid).not.toHaveBeenCalled();
    });
  });

  describe("watchlist", () => {
    it("toggles the watchlist", async () => {
      mockToggleWatchlist.mockResolvedValue(true);
      renderCard();
      const button = screen.getByRole("button", { name: /^Watch / });
      expect(button).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(button);
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Added to watchlist");
      });
      expect(screen.getByRole("button", { name: /^Watch / })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });

    it("shows a watched lot as watched and follows the prop", () => {
      const { rerender } = renderCard({}, { isWatched: true });
      expect(screen.getByRole("button", { name: /^Watch / })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      rerender(
        <BrowserRouter>
          <AuctionCard auction={mockAuction} isWatched={false} />
        </BrowserRouter>
      );
      expect(screen.getByRole("button", { name: /^Watch / })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });

    it("reports a failed toggle", async () => {
      mockToggleWatchlist.mockRejectedValue(new Error("x"));
      renderCard();
      fireEvent.click(screen.getByRole("button", { name: /^Watch / }));
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to update watchlist");
      });
    });

    it("sends a guest to sign in", () => {
      (useSession as Mock).mockReturnValue({ data: null });
      renderCard();
      fireEvent.click(screen.getByRole("button", { name: /^Watch / }));
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("sign in to watch")
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/login?callbackUrl=")
      );
    });
  });

  describe("compact row", () => {
    it("renders as a row with the same content and a 4:3 photo", () => {
      renderCard({}, { viewMode: "compact" });
      const card = document.querySelector("[data-slot='lot-card']");
      expect(card).toHaveAttribute("data-view-mode", "compact");
      expect(card?.className).toMatch(/flex-row/);
      expect(card?.querySelector(".aspect-\\[4\\/3\\]")).not.toBeNull();
      expect(screen.getByText("Lot 12 · Tractors")).toBeInTheDocument();
    });

    it("keeps a 44px Bid button with no cents", () => {
      renderCard({}, { viewMode: "compact" });
      const bid = screen.getByRole("button", { name: /^Bid R/ });
      expect(bid.className).toMatch(/min-h-11/);
      expect(bid.textContent).not.toMatch(/[.,]\d{2}$/);
    });

    it("shows the status in the text column, not over the narrow photo", () => {
      renderCard(upcoming, { viewMode: "compact" });
      const badge = screen.getByText(/^Opens .*SAST$/);
      const photoColumn = document.querySelector(
        "[data-slot='lot-card'] > div:first-child"
      );
      expect(photoColumn).not.toContainElement(badge);
    });

    it("shows no italic description", () => {
      renderCard({ description: "Long text" }, { viewMode: "compact" });
      expect(screen.queryByText("Long text")).not.toBeInTheDocument();
    });
  });
});
