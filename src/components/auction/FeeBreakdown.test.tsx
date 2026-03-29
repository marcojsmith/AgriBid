import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Id } from "convex/_generated/dataModel";

vi.mock("lucide-react", () => ({
  Receipt: () => <div data-testid="receipt" />,
  Users: () => <div data-testid="users" />,
  Building2: () => <div data-testid="building2" />,
}));

const { mockUseQuery } = vi.hoisted(() => ({ mockUseQuery: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: mockUseQuery }));
vi.mock("convex/_generated/api", () => ({
  api: { admin: { getAuctionFeesForUser: "admin:getAuctionFeesForUser" } },
}));

import { FeeBreakdown } from "./FeeBreakdown";

const mockAuctionId = "auction123" as Id<"auctions">;

describe("FeeBreakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when fees is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(
      <FeeBreakdown
        auctionId={mockAuctionId}
        userId="user123"
        isWinner={true}
        isSeller={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when both fee arrays are empty", () => {
    mockUseQuery.mockReturnValue({ buyerFees: [], sellerFees: [] });
    const { container } = render(
      <FeeBreakdown
        auctionId={mockAuctionId}
        userId="user123"
        isWinner={true}
        isSeller={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when isWinner=false and isSeller=false (even with fee data)", () => {
    mockUseQuery.mockReturnValue({
      buyerFees: [
        {
          feeName: "Buyer Fee",
          feeType: "percentage" as const,
          rate: 0.05,
          calculatedAmount: 500,
        },
      ],
      sellerFees: [
        {
          feeName: "Seller Fee",
          feeType: "percentage" as const,
          rate: 0.05,
          calculatedAmount: 500,
        },
      ],
    });
    const { container } = render(
      <FeeBreakdown
        auctionId={mockAuctionId}
        userId="user123"
        isWinner={false}
        isSeller={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders buyer fees when isWinner=true", () => {
    mockUseQuery.mockReturnValue({
      buyerFees: [
        {
          feeName: "Buyer Commission",
          feeType: "percentage" as const,
          rate: 0.05,
          calculatedAmount: 500,
        },
      ],
      sellerFees: [],
    });
    render(
      <FeeBreakdown
        auctionId={mockAuctionId}
        userId="user123"
        isWinner={true}
        isSeller={false}
      />
    );
    expect(screen.getByText("Your Fees (as Buyer)")).toBeInTheDocument();
    expect(screen.getByText("Buyer Commission")).toBeInTheDocument();
  });

  it("renders seller fees when isSeller=true", () => {
    mockUseQuery.mockReturnValue({
      buyerFees: [],
      sellerFees: [
        {
          feeName: "Seller Commission",
          feeType: "percentage" as const,
          rate: 0.05,
          calculatedAmount: 500,
        },
      ],
    });
    render(
      <FeeBreakdown
        auctionId={mockAuctionId}
        userId="user123"
        isWinner={false}
        isSeller={true}
      />
    );
    expect(screen.getByText("Your Fees (as Seller)")).toBeInTheDocument();
    expect(screen.getByText("Seller Commission")).toBeInTheDocument();
  });

  it("renders both sections when both isWinner and isSeller are true", () => {
    mockUseQuery.mockReturnValue({
      buyerFees: [
        {
          feeName: "Buyer Commission",
          feeType: "percentage" as const,
          rate: 0.05,
          calculatedAmount: 500,
        },
      ],
      sellerFees: [
        {
          feeName: "Seller Commission",
          feeType: "percentage" as const,
          rate: 0.05,
          calculatedAmount: 500,
        },
      ],
    });
    render(
      <FeeBreakdown
        auctionId={mockAuctionId}
        userId="user123"
        isWinner={true}
        isSeller={true}
      />
    );
    expect(screen.getByText("Your Fees (as Buyer)")).toBeInTheDocument();
    expect(screen.getByText("Your Fees (as Seller)")).toBeInTheDocument();
  });

  it("displays correct totals for buyer fees", () => {
    mockUseQuery.mockReturnValue({
      buyerFees: [
        {
          feeName: "Buyer Commission",
          feeType: "percentage" as const,
          rate: 0.05,
          calculatedAmount: 500,
        },
        {
          feeName: "Buyer Admin",
          feeType: "fixed" as const,
          rate: 100,
          calculatedAmount: 100,
        },
      ],
      sellerFees: [],
    });
    render(
      <FeeBreakdown
        auctionId={mockAuctionId}
        userId="user123"
        isWinner={true}
        isSeller={false}
      />
    );
    expect(screen.getByText(/R\s*600/)).toBeInTheDocument();
  });

  it("displays correct totals for seller fees", () => {
    mockUseQuery.mockReturnValue({
      buyerFees: [],
      sellerFees: [
        {
          feeName: "Seller Commission",
          feeType: "percentage" as const,
          rate: 0.05,
          calculatedAmount: 500,
        },
        {
          feeName: "Seller Admin",
          feeType: "fixed" as const,
          rate: 100,
          calculatedAmount: 100,
        },
      ],
    });
    render(
      <FeeBreakdown
        auctionId={mockAuctionId}
        userId="user123"
        isWinner={false}
        isSeller={true}
      />
    );
    expect(screen.getByText(/R\s*600/)).toBeInTheDocument();
  });

  it('passes "skip" to useQuery when auctionId is undefined', () => {
    mockUseQuery.mockReturnValue({ buyerFees: [], sellerFees: [] });
    render(
      <FeeBreakdown
        auctionId={undefined}
        userId="user123"
        isWinner={true}
        isSeller={false}
      />
    );
    expect(mockUseQuery).toHaveBeenCalledWith(
      "admin:getAuctionFeesForUser",
      "skip"
    );
  });
});
