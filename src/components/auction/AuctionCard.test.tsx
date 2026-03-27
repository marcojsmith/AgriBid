import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import { useSession } from "@/lib/auth-client";
import { isValidCallbackUrl } from "@/lib/utils";
import type { AuctionWithCategory } from "@/types/auction";

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
  _id: "auction123" as Id<"auctions">,
  _creationTime: Date.now(),
  title: "Test Tractor",
  make: "John Deere",
  model: "6155R",
  year: 2020,
  currentPrice: 1000,
  minIncrement: 100,
  startingPrice: 1000,
  reservePrice: 2000,
  endTime: Date.now() + 100000,
  status: "active",
  location: "Cape Town",
  operatingHours: 500,
  categoryName: "Tractors",
  sellerId: "seller1",
  bidCount: 5,
  images: { front: "image.jpg" },
};

describe("AuctionCard", () => {
  const mockPlaceBid = vi.fn();
  const mockToggleWatchlist = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockImplementation((apiRef: { _path: string }) => {
      if (apiRef?._path === "auctions/mutations/bidding:placeBid")
        return mockPlaceBid;
      if (apiRef?._path === "watchlist:toggleWatchlist")
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

    expect(screen.getByText("SOLD")).toBeInTheDocument();
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

  it("handles price update during bid confirmation", async () => {
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
      auction: auction as unknown as AuctionWithCategory,
    });
    const img = screen.getByAltText(
      `${mockAuction.make} — ${mockAuction.model} — ${mockAuction.title}`
    );
    expect(img).toHaveAttribute("src", "front.jpg");
  });

  it("handles engine image fallback as primary", () => {
    const auction = { ...mockAuction, images: { engine: "engine.jpg" } };
    renderWithRouter({
      auction: auction as unknown as AuctionWithCategory,
    });
    const img = screen.getByAltText(
      `${mockAuction.make} — ${mockAuction.model} — ${mockAuction.title}`
    );
    expect(img).toHaveAttribute("src", "engine.jpg");
  });

  it("handles cabin image fallback as primary", () => {
    const auction = { ...mockAuction, images: { cabin: "cabin.jpg" } };
    renderWithRouter({
      auction: auction as unknown as AuctionWithCategory,
    });
    const img = screen.getByAltText(
      `${mockAuction.make} — ${mockAuction.model} — ${mockAuction.title}`
    );
    expect(img).toHaveAttribute("src", "cabin.jpg");
  });

  it("handles rear image fallback as primary", () => {
    const auction = { ...mockAuction, images: { rear: "rear.jpg" } };
    renderWithRouter({
      auction: auction as unknown as AuctionWithCategory,
    });
    const img = screen.getByAltText(
      `${mockAuction.make} — ${mockAuction.model} — ${mockAuction.title}`
    );
    expect(img).toHaveAttribute("src", "rear.jpg");
  });

  it("handles additional[0] image fallback as primary", () => {
    const auction = { ...mockAuction, images: { additional: ["add1.jpg"] } };
    renderWithRouter({
      auction: auction as unknown as AuctionWithCategory,
    });
    const img = screen.getByAltText(
      `${mockAuction.make} — ${mockAuction.model} — ${mockAuction.title}`
    );
    expect(img).toHaveAttribute("src", "add1.jpg");
  });

  it("handles no image at all", () => {
    const auction = { ...mockAuction, images: {} };
    renderWithRouter({
      auction: auction as unknown as AuctionWithCategory,
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
      auction: closedAuction as unknown as AuctionWithCategory,
      viewMode: "compact",
    });

    expect(screen.getByLabelText("Sold auction")).toBeInTheDocument();
  });

  it("renders closed and compact state with unsold badge", () => {
    const closedAuction = { ...mockAuction, status: "unsold" as const };
    renderWithRouter({
      auction: closedAuction as unknown as AuctionWithCategory,
      viewMode: "compact",
    });

    expect(screen.getByLabelText("Closed auction")).toBeInTheDocument();
  });

  it("renders closed and detailed state with SOLD badge", () => {
    const closedAuction = { ...mockAuction, status: "sold" as const };
    renderWithRouter({
      auction: closedAuction as unknown as AuctionWithCategory,
      viewMode: "detailed",
    });

    expect(screen.getByText("SOLD")).toBeInTheDocument();
  });

  it("renders closed and detailed state with UNSOLD badge", () => {
    const closedAuction = { ...mockAuction, status: "unsold" as const };
    renderWithRouter({
      auction: closedAuction as unknown as AuctionWithCategory,
      viewMode: "detailed",
    });

    expect(screen.getByText("UNSOLD")).toBeInTheDocument();
  });

  it("renders active and compact state without closed badges", () => {
    renderWithRouter({
      auction: mockAuction as unknown as AuctionWithCategory,
      viewMode: "compact",
    });

    expect(screen.queryByLabelText("Sold auction")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Closed auction")).not.toBeInTheDocument();
  });

  it("renders active and detailed state without closed badges", () => {
    renderWithRouter({
      auction: mockAuction as unknown as AuctionWithCategory,
      viewMode: "detailed",
    });

    expect(screen.queryByText("SOLD")).not.toBeInTheDocument();
    expect(screen.queryByText("UNSOLD")).not.toBeInTheDocument();
  });
});
