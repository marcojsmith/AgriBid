import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import { useSession } from "@/lib/auth-client";

import { AuctionCard } from "../auction/AuctionCard";

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
      placeBid: { _path: "auctions:placeBid" },
    },
    watchlist: {
      toggleWatchlist: { _path: "watchlist:toggleWatchlist" },
    },
  },
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
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
      if (apiRef?._path === "auctions:placeBid") return mockPlaceBid;
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
});
