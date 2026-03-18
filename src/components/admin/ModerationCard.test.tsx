import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Id } from "convex/_generated/dataModel";

import { ModerationCard } from "./ModerationCard";

vi.mock("@/lib/auction-utils", () => ({
  normalizeAuctionImages: vi.fn((images) => {
    if (!images) return {};
    if (typeof images === "string") return { front: images };
    if (Array.isArray(images) && images.length > 0) return { front: images[0] };
    if (typeof images === "object" && "front" in images) return images;
    return {};
  }),
}));

vi.mock("@/lib/currency", () => ({
  formatCurrency: vi.fn((amount: number) => `R ${amount.toLocaleString()}`),
}));

describe("ModerationCard", () => {
  const mockAuction = {
    _id: "auction-1" as Id<"auctions">,
    _creationTime: 1704067200000,
    title: "John Deere 8R",
    make: "John Deere",
    model: "8R 410",
    year: 2022,
    operatingHours: 1500,
    location: "Gauteng",
    categoryId: "cat-1" as Id<"equipmentCategories">,
    reservePrice: 140000,
    startingPrice: 150000,
    currentPrice: 150000,
    minIncrement: 500,
    sellerId: "seller-1",
    status: "pending_review" as const,
    images: ["https://example.com/image.jpg"],
    categoryName: "Tractors",
    conditionChecklist: {
      engine: true,
      hydraulics: true,
      tires: false,
      serviceHistory: false,
    },
  };

  const defaultProps = {
    auction: mockAuction,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onView: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders auction title", () => {
    render(<ModerationCard {...defaultProps} />);
    expect(screen.getByText("John Deere 8R")).toBeInTheDocument();
  });

  it("renders auction year", () => {
    render(<ModerationCard {...defaultProps} />);
    expect(screen.getByText("2022")).toBeInTheDocument();
  });

  it("renders auction make", () => {
    render(<ModerationCard {...defaultProps} />);
    expect(screen.getByText("John Deere")).toBeInTheDocument();
  });

  it("renders auction location", () => {
    render(<ModerationCard {...defaultProps} />);
    expect(screen.getByText("Gauteng")).toBeInTheDocument();
  });

  it("renders starting price", () => {
    render(<ModerationCard {...defaultProps} />);
    expect(screen.getByText("R 150,000")).toBeInTheDocument();
  });

  it("renders category badge", () => {
    render(<ModerationCard {...defaultProps} />);
    expect(screen.getByText("Tractors")).toBeInTheDocument();
  });

  it("renders Approve button and calls onApprove", () => {
    render(<ModerationCard {...defaultProps} />);
    const approveBtn = screen.getByRole("button", { name: /approve/i });
    expect(approveBtn).toBeInTheDocument();
    fireEvent.click(approveBtn);
    expect(defaultProps.onApprove).toHaveBeenCalledTimes(1);
  });

  it("renders Reject button and calls onReject", () => {
    render(<ModerationCard {...defaultProps} />);
    const rejectBtn = screen.getByRole("button", { name: /reject/i });
    expect(rejectBtn).toBeInTheDocument();
    fireEvent.click(rejectBtn);
    expect(defaultProps.onReject).toHaveBeenCalledTimes(1);
  });

  it("renders Details button and calls onView", () => {
    render(<ModerationCard {...defaultProps} />);
    const viewBtn = screen.getByRole("button", { name: /details/i });
    expect(viewBtn).toBeInTheDocument();
    fireEvent.click(viewBtn);
    expect(defaultProps.onView).toHaveBeenCalledTimes(1);
  });

  it("renders condition items", () => {
    render(<ModerationCard {...defaultProps} />);
    expect(screen.getByText("Engine")).toBeInTheDocument();
    expect(screen.getByText("Hydraulics")).toBeInTheDocument();
    expect(screen.getByText("Tires")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("renders PASS for true condition values", () => {
    render(<ModerationCard {...defaultProps} />);
    expect(screen.getAllByText("PASS")).toHaveLength(2);
  });

  it("renders FAIL for false condition values", () => {
    render(<ModerationCard {...defaultProps} />);
    expect(screen.getAllByText("FAIL")).toHaveLength(2);
  });

  it("renders N/A for conditionChecklist undefined", () => {
    const auctionWithoutCondition = {
      ...mockAuction,
      conditionChecklist: undefined,
    };
    render(
      <ModerationCard
        auction={auctionWithoutCondition}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onView={vi.fn()}
      />
    );
    // Without conditionChecklist, all conditions show N/A
    expect(screen.getAllByText("N/A")).toHaveLength(4);
  });

  it("renders with no images", () => {
    const noImageAuction = {
      ...mockAuction,
      images: [] as unknown as typeof mockAuction.images,
    };
    render(
      <ModerationCard
        auction={noImageAuction}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onView={vi.fn()}
      />
    );
    expect(screen.getByText("John Deere 8R")).toBeInTheDocument();
  });

  it("renders with unknown category", () => {
    const noCategoryAuction = { ...mockAuction, categoryName: undefined };
    render(
      <ModerationCard
        auction={noCategoryAuction}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onView={vi.fn()}
      />
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
});
