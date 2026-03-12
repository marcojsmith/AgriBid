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
      onChange={(e) => onValueChange(e.target.value)}
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

vi.mock("@/components/bidding", () => ({
  BiddingPanel: () => <div data-testid="bidding-panel">Bidding Panel</div>,
  BidHistory: () => <div data-testid="bid-history">Bid History</div>,
}));

vi.mock("@/components/SellerInfo", () => ({
  SellerInfo: () => <div data-testid="seller-info">Seller Info</div>,
}));

vi.mock("@/components/LoadingIndicator", () => ({
  LoadingIndicator: () => <div data-testid="loading-indicator">Loading...</div>,
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
    status: "active",
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
        auctionId: "auction1",
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
    fireEvent.click(reportBtn!);

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
    fireEvent.click(reportBtn!);

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

  it("handles condition report dialog and download link", async () => {
    renderPage();
    const viewBtn = screen.getByRole("button", { name: /View Report/i });
    fireEvent.click(viewBtn);

    expect(
      screen.getByText("Condition Report", {
        selector: '[data-slot="dialog-title"]',
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
});
