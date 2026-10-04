import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter, useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";

import AuctionDetail from "./AuctionDetail";

// Mock useParams
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(),
  };
});

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock Dialog component
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (o: boolean) => void;
  }) => (
    <div data-testid="dialog-root">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<{
              open?: boolean;
              onOpenChange?: (o: boolean) => void;
            }>,
            {
              open,
              onOpenChange,
            }
          );
        }
        return child;
      })}
    </div>
  ),
  DialogTrigger: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode;
    onOpenChange?: (o: boolean) => void;
  }) => (
    <div onClick={() => onOpenChange?.(true)} data-testid="dialog-trigger">
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (open ? <div data-testid="dialog-content">{children}</div> : null),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock Select to be a simple native select for easier testing
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange: (v: string) => void;
  }) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(e) => {
        onValueChange(e.target.value);
      }}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

interface AuctionHeaderProps {
  auction: { title: string };
}

// Mock child components to keep it focused on AuctionDetail logic
vi.mock("@/components/AuctionHeader", () => ({
  AuctionHeader: ({ auction }: AuctionHeaderProps) => (
    <div data-testid="auction-header">{auction.title}</div>
  ),
}));

vi.mock("@/components/ImageGallery", () => ({
  ImageGallery: () => <div data-testid="image-gallery">Image Gallery</div>,
}));

vi.mock("@/components/bidding/BiddingPanel", () => ({
  BiddingPanel: () => <div data-testid="bidding-panel">Bidding Panel</div>,
}));

vi.mock("@/components/bidding/MobileBidBar", () => ({
  MobileBidBar: () => <div data-testid="mobile-bid-bar">Mobile Bid Bar</div>,
}));

vi.mock("@/components/bidding/BidHistory", () => ({
  BidHistory: () => <div data-testid="bid-history">Bid History</div>,
}));

interface CapturedSellerInfoProps {
  sellerId?: string;
  lotId?: string;
  isOwnListing?: boolean;
}

const { sellerInfoPropsRef } = vi.hoisted(() => ({
  sellerInfoPropsRef: {
    current: null as CapturedSellerInfoProps | null,
  },
}));

vi.mock("@/components/SellerInfo", () => ({
  SellerInfo: (props: CapturedSellerInfoProps) => {
    sellerInfoPropsRef.current = props;
    return <div data-testid="seller-info">Seller Info</div>;
  },
}));

vi.mock("@/components/LoadingIndicator", () => ({
  LoadingIndicator: () => <div data-testid="loading-indicator">Loading...</div>,
}));

vi.mock("@/components/auction/AuctionCard", () => ({
  AuctionCard: ({
    auction,
    isWatched,
  }: {
    auction: { _id: string; title: string };
    isWatched?: boolean;
  }) => (
    <div data-testid="auction-card" data-watched={String(Boolean(isWatched))}>
      {auction.title}
    </div>
  ),
}));

vi.mock("@/components/auction/FeeBreakdown", () => ({
  FeeBreakdown: ({
    isWinner,
    isSeller,
  }: {
    lotId: string;
    isWinner: boolean;
    isSeller: boolean;
  }) => (
    <div data-testid="fee-breakdown">
      {`winner=${String(isWinner)} seller=${String(isSeller)}`}
    </div>
  ),
}));

describe("AuctionDetail Page", () => {
  const mockAuction = {
    _id: "auction1",
    title: "Test Tractor",
    description: "Detailed description",
    sellerEmail: "seller@example.com",
    sellerId: "seller1",
    images: {
      front: "img.jpg",
      engine: "eng.jpg",
      cabin: "cab.jpg",
      rear: "rear.jpg",
      additional: ["add.jpg"],
    },
    conditionReportUrl: "https://example.com/report.pdf",
    status: "assigned",
    auctionStatus: "published",
    auctionStartTime: Date.now() - 60_000,
    auctionEndTime: Date.now() + 100_000,
  };

  const mockFlagAuction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as Mock).mockReturnValue({ id: "auction1" });
    (useSession as Mock).mockReturnValue({
      data: { user: { email: "user@example.com" } },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue(mockAuction);
    (useMutation as Mock).mockReturnValue(mockFlagAuction);
  });

  const renderPage = () => {
    return render(
      <BrowserRouter>
        <AuctionDetail />
      </BrowserRouter>
    );
  };

  it("renders auction details when data is loaded", () => {
    renderPage();
    expect(screen.getByTestId("auction-header")).toHaveTextContent(
      "Test Tractor"
    );
    expect(screen.getByText("Detailed description")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-bid-bar")).toBeInTheDocument();
  });

  it("shows the 'Auction Starts' banner when startTime is in the future", () => {
    (useQuery as Mock).mockReturnValue({
      ...mockAuction,
      auctionStartTime: Date.now() + 60_000,
    });
    renderPage();
    expect(screen.getByText(/Auction Starts:/i)).toBeInTheDocument();
  });

  it("hides the 'Auction Starts' banner once startTime has passed", () => {
    (useQuery as Mock).mockReturnValue({
      ...mockAuction,
      auctionStartTime: Date.now() - 60_000,
    });
    renderPage();
    expect(screen.queryByText(/Auction Starts:/i)).not.toBeInTheDocument();
  });

  it("renders invalid id state", () => {
    (useParams as Mock).mockReturnValue({ id: undefined });
    renderPage();
    expect(screen.getByText(/Invalid Auction ID/i)).toBeInTheDocument();
  });

  it("renders not found state", () => {
    (useQuery as Mock).mockReturnValue(null);
    renderPage();
    expect(screen.getByText(/Auction Not Found/i)).toBeInTheDocument();
  });

  it("opens and submits flag dialog with reason and details", async () => {
    renderPage();

    // Find the destructive Report button
    const reportButtons = screen.getAllByRole("button", { name: /Report/i });
    const reportBtn = reportButtons.find((b) =>
      b.classList.contains("bg-destructive")
    );
    if (!reportBtn) throw new Error("Could not find Report button");

    fireEvent.click(reportBtn);

    expect(screen.getByText("Report this Listing")).toBeInTheDocument();

    const select = screen.getByTestId("mock-select");
    fireEvent.change(select, { target: { value: "misleading" } });

    const textarea = screen.getByPlaceholderText(/Provide more context/i);
    fireEvent.change(textarea, { target: { value: "Some details" } });

    mockFlagAuction.mockResolvedValue({ hideTriggered: false });
    const submitBtn = screen.getByRole("button", { name: "Submit Report" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockFlagAuction).toHaveBeenCalledWith({
        lotId: "auction1",
        reason: "misleading",
        details: "Some details",
      });
      expect(toast.success).toHaveBeenCalledWith("Thank you for your report");
    });
  });

  it("handles successful flag with hideTriggered: true", async () => {
    renderPage();
    const reportButtons = screen.getAllByRole("button", { name: /Report/i });
    const reportBtn = reportButtons.find((b) =>
      b.classList.contains("bg-destructive")
    );
    if (!reportBtn) throw new Error("Could not find Report button");
    fireEvent.click(reportBtn);

    const select = screen.getByTestId("mock-select");
    fireEvent.change(select, { target: { value: "suspicious" } });

    mockFlagAuction.mockResolvedValue({ hideTriggered: true });
    fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Auction has been flagged and hidden for review"
      );
    });
  });

  it("handles flag validation and mutation error", async () => {
    renderPage();
    const reportButtons = screen.getAllByRole("button", { name: /Report/i });
    const reportBtn = reportButtons.find((b) =>
      b.classList.contains("bg-destructive")
    );
    if (!reportBtn) throw new Error("Could not find Report button");
    fireEvent.click(reportBtn);

    const submitBtn = screen.getByRole("button", { name: "Submit Report" });
    fireEvent.click(submitBtn);
    expect(toast.error).toHaveBeenCalledWith(
      "Please select a reason for flagging"
    );

    const select = screen.getByTestId("mock-select");
    fireEvent.change(select, { target: { value: "other" } });

    mockFlagAuction.mockRejectedValue(new Error("API Error"));
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("API Error");
    });
  });

  it("handles condition report dialog and download link", () => {
    renderPage();
    const viewBtn = screen.getByRole("button", { name: /View Report/i });
    fireEvent.click(viewBtn);

    expect(
      screen.getByText("Condition Report", {
        selector: "h2",
      })
    ).toBeInTheDocument();

    // Use text-based find for the link since it's more reliable when dialogs are open
    const downloadText = screen.getByText(/Download PDF/i);
    const downloadLink = downloadText.closest("a");
    expect(downloadLink).toHaveAttribute(
      "href",
      mockAuction.conditionReportUrl
    );
  });

  it("handles non-array images object correctly", () => {
    const auctionWithObjectImages = {
      ...mockAuction,
      images: {
        front: "front.jpg",
        engine: "engine.jpg",
        cabin: "cabin.jpg",
        rear: "rear.jpg",
        additional: ["extra.jpg"],
      },
    };
    (useQuery as Mock).mockReturnValue(auctionWithObjectImages);
    renderPage();
    expect(screen.getByTestId("image-gallery")).toBeInTheDocument();
  });

  it("submits report without details", async () => {
    renderPage();
    const reportButtons = screen.getAllByRole("button", { name: /Report/i });
    const reportBtn = reportButtons.find((b) =>
      b.classList.contains("bg-destructive")
    );
    if (!reportBtn) throw new Error("Could not find Report button");
    fireEvent.click(reportBtn);

    const select = screen.getByTestId("mock-select");
    fireEvent.change(select, { target: { value: "inappropriate" } });

    mockFlagAuction.mockResolvedValue({ hideTriggered: false });
    fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => {
      expect(mockFlagAuction).toHaveBeenCalledWith({
        lotId: "auction1",
        reason: "inappropriate",
        details: undefined,
      });
    });
  });

  it("renders loading state", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderPage();
    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("handles array-based images correctly", () => {
    const auctionWithArrayImages = {
      ...mockAuction,
      images: ["img1.jpg", "img2.jpg", null],
    };
    (useQuery as Mock).mockReturnValue(auctionWithArrayImages);
    renderPage();
    expect(screen.getByTestId("image-gallery")).toBeInTheDocument();
  });

  it("handles non-Error flag mutation rejection", async () => {
    renderPage();
    const reportButtons = screen.getAllByRole("button", { name: /Report/i });
    const reportBtn = reportButtons.find((b) =>
      b.classList.contains("bg-destructive")
    );
    if (!reportBtn) throw new Error("Could not find Report button");
    fireEvent.click(reportBtn);

    const select = screen.getByTestId("mock-select");
    fireEvent.change(select, { target: { value: "other" } });

    mockFlagAuction.mockRejectedValue("String error");
    fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to flag auction");
    });
  });

  it("closes flag dialog when cancel is clicked", async () => {
    renderPage();
    const reportButtons = screen.getAllByRole("button", { name: /Report/i });
    const reportBtn = reportButtons.find((b) =>
      b.classList.contains("bg-destructive")
    );
    if (!reportBtn) throw new Error("Could not find Report button");
    fireEvent.click(reportBtn);

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText("Report this Listing")).not.toBeInTheDocument();
    });
  });

  it("handles condition report dialog with missing URL in dialog itself", () => {
    const { rerender } = render(
      <BrowserRouter>
        <AuctionDetail />
      </BrowserRouter>
    );

    const viewBtn = screen.getByRole("button", { name: /View Report/i });
    fireEvent.click(viewBtn);

    // Force the URL to be missing after opening
    const auctionNoReport = { ...mockAuction, conditionReportUrl: null };
    (useQuery as Mock).mockReturnValue(auctionNoReport);

    rerender(
      <BrowserRouter>
        <AuctionDetail />
      </BrowserRouter>
    );

    expect(
      screen.getByText("No condition report available")
    ).toBeInTheDocument();
  });

  it("renders fallback text when description is missing", () => {
    const auctionNoDesc = { ...mockAuction, description: "" };
    (useQuery as Mock).mockReturnValue(auctionNoDesc);
    renderPage();
    expect(screen.getByText("No description provided.")).toBeInTheDocument();
  });

  it("passes lotId and isOwnListing=false to SellerInfo for non-owners", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "buyer1" } },
      isPending: false,
    });
    renderPage();

    expect(sellerInfoPropsRef.current).toEqual({
      sellerId: "seller1",
      lotId: "auction1",
      isOwnListing: false,
    });
  });

  it("passes isOwnListing=true to SellerInfo when the viewer is the seller", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "seller1" } },
      isPending: false,
    });
    renderPage();

    expect(sellerInfoPropsRef.current).toEqual({
      sellerId: "seller1",
      lotId: "auction1",
      isOwnListing: true,
    });
  });

  it("scrolls the bidding column with the page and only sticks on tall viewports", () => {
    const { container } = renderPage();

    const stickyColumn =
      container.querySelector("#bidding-panel")?.parentElement;

    // A capped, internally scrollable column gave the sidebar a second
    // scrollbar on short viewports; it now scrolls with the page and only
    // sticks when the viewport is tall enough to hold it.
    expect(stickyColumn).toHaveClass("lg:[@media(min-height:900px)]:sticky");
    expect(stickyColumn?.className).not.toContain("max-h-[");
    expect(stickyColumn?.className).not.toContain("overflow-y-auto");
  });

  it("tightens the layout and card padding on phones", () => {
    const { container } = renderPage();

    const description = container.querySelector(
      '[aria-label="Equipment Description"]'
    );
    const grid = description?.parentElement?.parentElement;

    // `pb-20` only existed to clear the fixed MobileBidBar; `pb-12` is enough
    // once the card padding and gaps below stop adding another 100px or so.
    expect(grid).toHaveClass("gap-4", "lg:gap-8", "pb-12", "lg:pb-0");
    expect(description).toHaveClass("p-4", "sm:p-8");

    const biddingAside = container.querySelector("#bidding-panel");
    expect(biddingAside).toHaveClass("p-4", "sm:p-6");

    const bidHistory = container.querySelector('[aria-label="Bid History"]');
    expect(bidHistory).toHaveClass("p-4", "sm:p-6");
  });

  it("labels the bid history only through the accordion trigger", () => {
    renderPage();

    // A section heading duplicated the accordion trigger's own label, stacking
    // two "Bid History" headings on the phone.
    expect(
      screen.queryByRole("heading", { name: "Bid History" })
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Bid History")).toHaveLength(1);
  });

  it("renders a sparse lot without optional metadata", () => {
    (useQuery as Mock).mockReturnValue({
      _id: "auction1",
      title: "Bare Lot",
      sellerEmail: "seller@example.com",
      sellerId: "seller1",
      images: { front: "img.jpg" },
      status: "assigned",
      auctionStatus: "published",
      auctionStartTime: Date.now() - 60_000,
    });
    renderPage();

    expect(screen.getByText("No description provided.")).toBeInTheDocument();
    expect(screen.getByTestId("image-gallery")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View Report/i })).toBeNull();
  });

  it("lists related lots of the same make and marks watched ones", () => {
    const auctionWithMake = { ...mockAuction, make: "John Deere" };
    // The page's three queries are told apart by their arguments: the lot
    // lookup passes lotId, the related-lot lookup passes make/excludeId, and
    // the watchlist lookup passes an empty object.
    (useQuery as Mock).mockImplementation((_query: unknown, args: unknown) => {
      const params = (args ?? {}) as Record<string, unknown>;
      if ("make" in params) {
        return [
          { ...auctionWithMake, _id: "auction2", title: "Related Tractor" },
        ];
      }
      if ("lotId" in params) return auctionWithMake;
      return ["auction2"];
    });

    renderPage();

    const card = screen.getByTestId("auction-card");
    expect(card).toHaveTextContent("Related Tractor");
    expect(card).toHaveAttribute("data-watched", "true");
  });

  it("shows the fee breakdown to the winning bidder on a sold lot", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "buyer1" } },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue({
      ...mockAuction,
      status: "sold",
      winnerId: "buyer1",
    });

    renderPage();

    expect(screen.getByTestId("fee-breakdown")).toHaveTextContent(
      "winner=true seller=false"
    );
  });

  it("shows the fee breakdown to the seller on a sold lot", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "seller1" } },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue({
      ...mockAuction,
      status: "sold",
      winnerId: "buyer1",
    });

    renderPage();

    expect(screen.getByTestId("fee-breakdown")).toHaveTextContent(
      "winner=false seller=true"
    );
  });

  it("hides the fee breakdown from unrelated viewers of a sold lot", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "buyer2" } },
      isPending: false,
    });
    (useQuery as Mock).mockReturnValue({
      ...mockAuction,
      status: "sold",
      winnerId: "buyer1",
    });

    renderPage();

    expect(screen.queryByTestId("fee-breakdown")).toBeNull();
  });
});
