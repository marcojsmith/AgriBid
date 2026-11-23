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
  api: {
    admin: {
      getLotFeesForUser: "admin:getLotFeesForUser",
      getVatRate: "admin:getVatRate",
    },
  },
}));

import { FeeBreakdown } from "./FeeBreakdown";

const mockLotId = "lot123" as Id<"lots">;

const buyerPremiumFees = {
  buyerFees: [
    {
      feeName: "Buyer's Premium",
      feeType: "percentage" as const,
      rate: 0.05,
      calculatedAmount: 10_000,
    },
  ],
  sellerFees: [],
};

describe("FeeBreakdown VAT and estimated total", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Routes the two queries FeeBreakdown makes to their mocked results.
   *
   * @param fees - Result of `getLotFeesForUser`
   * @param vat - Result of `getVatRate`
   */
  const mockQueries = (fees: unknown, vat: unknown) => {
    mockUseQuery.mockImplementation((ref: string) =>
      ref === "admin:getVatRate" ? vat : fees
    );
  };

  it("shows VAT and the estimated total for the winner at the configured rate", () => {
    mockQueries(buyerPremiumFees, { vatRatePct: 15 });
    render(
      <FeeBreakdown
        lotId={mockLotId}
        isWinner={true}
        isSeller={false}
        hammerPrice={100_000}
      />
    );
    expect(screen.getByText("VAT (15% on bid + fees)")).toBeInTheDocument();
    // VAT = (100 000 + 10 000) * 15% = 16 500; total = 126 500.
    expect(screen.getByText(/R\s*16\s*500/)).toBeInTheDocument();
    expect(screen.getByText("Estimated total incl. VAT")).toBeInTheDocument();
    expect(screen.getByText(/R\s*126\s*500/)).toBeInTheDocument();
    expect(screen.getByText("Total fees")).toBeInTheDocument();
    // The hammer price is shown so the lines visibly add up to the total.
    expect(screen.getByText("Hammer price")).toBeInTheDocument();
    expect(screen.getAllByText(/R\s*100\s*000/)).toHaveLength(1);
    expect(screen.getAllByText(/R\s*10\s*000/)).toHaveLength(2);
  });

  it("a private seller's lot charges VAT on the fees only", () => {
    mockQueries(buyerPremiumFees, { vatRatePct: 15 });
    render(
      <FeeBreakdown
        lotId={mockLotId}
        isWinner={true}
        isSeller={false}
        hammerPrice={100_000}
        sellerVatKind="private"
      />
    );
    expect(screen.getByText("VAT (15% on fees)")).toBeInTheDocument();
    // VAT = 10 000 * 15% = 1 500; total = 111 500.
    expect(screen.getByText(/R\s*1\s*500/)).toBeInTheDocument();
    expect(screen.getByText(/R\s*111\s*500/)).toBeInTheDocument();
  });

  it("still shows VAT and the total for a winner when there are no buyer fees", () => {
    mockQueries({ buyerFees: [], sellerFees: [] }, { vatRatePct: 15 });
    render(
      <FeeBreakdown
        lotId={mockLotId}
        isWinner={true}
        isSeller={false}
        hammerPrice={1_000}
      />
    );
    expect(screen.getByText("Hammer price")).toBeInTheDocument();
    expect(screen.getByText("Total fees")).toBeInTheDocument();
    expect(screen.getByText("VAT (15% on bid + fees)")).toBeInTheDocument();
    // VAT = 150, total = 1 150.
    expect(screen.getByText(/R\s*1\s*150/)).toBeInTheDocument();
  });

  it("renders nothing for a winner with no buyer fees while the rate is loading", () => {
    mockQueries({ buyerFees: [], sellerFees: [] }, undefined);
    const { container } = render(
      <FeeBreakdown
        lotId={mockLotId}
        isWinner={true}
        isSeller={false}
        hammerPrice={1_000}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("rounds each fee first so the rows add up to Total fees", () => {
    const fee = (feeName: string, calculatedAmount: number) => ({
      feeName,
      feeType: "fixed" as const,
      rate: 0,
      calculatedAmount,
    });
    // Rounded separately: 100.4 -> 100, 100.4 -> 100 (sum 200). Rounding the
    // raw sum (200.8) would give 201 and break the visible addition.
    mockQueries(
      { buyerFees: [fee("Fee A", 100.4), fee("Fee B", 100.4)], sellerFees: [] },
      { vatRatePct: 0 }
    );
    render(
      <FeeBreakdown
        lotId={mockLotId}
        isWinner={true}
        isSeller={false}
        hammerPrice={1_000}
      />
    );
    expect(screen.getAllByText(/R\s*100$/)).toHaveLength(2);
    expect(screen.getByText("Total fees").nextSibling).toHaveTextContent(
      /R\s*200$/
    );
    expect(screen.getByText(/R\s*1\s*200$/)).toBeInTheDocument();
  });

  it("shows fees in whole rand next to the estimate", () => {
    mockQueries(
      {
        buyerFees: [
          {
            feeName: "Buyer's Premium",
            feeType: "percentage" as const,
            rate: 0.05,
            calculatedAmount: 10_000.4,
          },
        ],
        sellerFees: [],
      },
      { vatRatePct: 0 }
    );
    render(
      <FeeBreakdown
        lotId={mockLotId}
        isWinner={true}
        isSeller={false}
        hammerPrice={100_000}
      />
    );
    expect(screen.queryByText(/,40/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/R\s*10\s*000/)).toHaveLength(2);
  });

  it("uses an admin-changed rate", () => {
    mockQueries(buyerPremiumFees, { vatRatePct: 10 });
    render(
      <FeeBreakdown
        lotId={mockLotId}
        isWinner={true}
        isSeller={false}
        hammerPrice={100_000}
      />
    );
    expect(screen.getByText("VAT (10% on bid + fees)")).toBeInTheDocument();
    expect(screen.getByText(/R\s*121\s*000/)).toBeInTheDocument();
  });

  it("shows a zero-VAT line at a 0% rate", () => {
    mockQueries(buyerPremiumFees, { vatRatePct: 0 });
    render(
      <FeeBreakdown
        lotId={mockLotId}
        isWinner={true}
        isSeller={false}
        hammerPrice={100_000}
      />
    );
    expect(screen.getByText("VAT (0% on bid + fees)")).toBeInTheDocument();
    expect(screen.getByText(/R\s*110\s*000/)).toBeInTheDocument();
  });

  it("works without a buyer's premium (no buyer fee besides others)", () => {
    mockQueries(
      {
        buyerFees: [
          {
            feeName: "Admin",
            feeType: "fixed" as const,
            rate: 0,
            calculatedAmount: 0,
          },
        ],
        sellerFees: [],
      },
      { vatRatePct: 15 }
    );
    render(
      <FeeBreakdown
        lotId={mockLotId}
        isWinner={true}
        isSeller={false}
        hammerPrice={1_000}
      />
    );
    expect(screen.getByText(/R\s*1\s*150/)).toBeInTheDocument();
  });

  it("hides VAT rows until the rate has loaded", () => {
    mockQueries(buyerPremiumFees, undefined);
    render(
      <FeeBreakdown
        lotId={mockLotId}
        isWinner={true}
        isSeller={false}
        hammerPrice={100_000}
      />
    );
    expect(screen.queryByText(/VAT/)).not.toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("hides VAT rows when no hammer price is supplied", () => {
    mockQueries(buyerPremiumFees, { vatRatePct: 15 });
    render(<FeeBreakdown lotId={mockLotId} isWinner={true} isSeller={false} />);
    expect(screen.queryByText(/VAT/)).not.toBeInTheDocument();
  });

  it("never shows VAT in the seller-only view", () => {
    mockQueries(
      {
        buyerFees: [],
        sellerFees: [
          {
            feeName: "Seller Commission",
            feeType: "percentage" as const,
            rate: 0.05,
            calculatedAmount: 500,
          },
        ],
      },
      { vatRatePct: 15 }
    );
    render(
      <FeeBreakdown
        lotId={mockLotId}
        isWinner={false}
        isSeller={true}
        hammerPrice={10_000}
      />
    );
    expect(screen.queryByText(/VAT/)).not.toBeInTheDocument();
  });
});

describe("FeeBreakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when fees is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(
      <FeeBreakdown lotId={mockLotId} isWinner={true} isSeller={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when both fee arrays are empty", () => {
    mockUseQuery.mockReturnValue({ buyerFees: [], sellerFees: [] });
    const { container } = render(
      <FeeBreakdown lotId={mockLotId} isWinner={true} isSeller={false} />
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
      <FeeBreakdown lotId={mockLotId} isWinner={false} isSeller={false} />
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
    render(<FeeBreakdown lotId={mockLotId} isWinner={true} isSeller={false} />);
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
    render(<FeeBreakdown lotId={mockLotId} isWinner={false} isSeller={true} />);
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
    render(<FeeBreakdown lotId={mockLotId} isWinner={true} isSeller={true} />);
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
    render(<FeeBreakdown lotId={mockLotId} isWinner={true} isSeller={false} />);
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
    render(<FeeBreakdown lotId={mockLotId} isWinner={false} isSeller={true} />);
    expect(screen.getByText(/R\s*600/)).toBeInTheDocument();
  });

  it('passes "skip" to useQuery when lotId is undefined', () => {
    mockUseQuery.mockReturnValue({ buyerFees: [], sellerFees: [] });
    render(<FeeBreakdown lotId={undefined} isWinner={true} isSeller={false} />);
    expect(mockUseQuery).toHaveBeenCalledWith(
      "admin:getLotFeesForUser",
      "skip"
    );
  });
});
