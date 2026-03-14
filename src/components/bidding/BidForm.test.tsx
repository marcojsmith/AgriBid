import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Doc } from "convex/_generated/dataModel";

import { BidForm } from "./BidForm";

const mockAuction = {
  _id: "a1",
  currentPrice: 1000,
  minIncrement: 100,
  status: "active",
} as unknown as Doc<"auctions">;

describe("BidForm", () => {
  const mockOnBid = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders manual bid input correctly", () => {
    render(
      <BidForm
        auction={mockAuction}
        onBid={mockOnBid}
        isLoading={false}
      />
    );
    expect(screen.getByPlaceholderText(/enter amount/i)).toHaveValue(1100);
  });

  it("validates manual bid input correctly", () => {
    render(
      <BidForm
        auction={mockAuction}
        onBid={mockOnBid}
        isLoading={false}
      />
    );
    const input = screen.getByPlaceholderText(/enter amount/i);
    
    // Valid bid
    fireEvent.change(input, { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: /place bid/i }));
    expect(mockOnBid).toHaveBeenCalledWith(1200);

    // Invalid bid
    fireEvent.change(input, { target: { value: "1050" } });
    expect(screen.getByText(/minimum bid required/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /place bid/i })).toBeDisabled();
  });

  it("handles quick bid buttons", () => {
    render(
      <BidForm
        auction={mockAuction}
        onBid={mockOnBid}
        isLoading={false}
      />
    );
    const quickBidBtn = screen.getByRole("button", { name: /quick bid.*1,?100/i });
    fireEvent.click(quickBidBtn);
    expect(mockOnBid).toHaveBeenCalledWith(1100);
  });

  it("enables and validates proxy bidding", async () => {
    render(
      <BidForm
        auction={mockAuction}
        onBid={mockOnBid}
        isLoading={false}
      />
    );

    // Enable proxy
    const proxyCheckbox = screen.getByLabelText(/enable auto-bid/i);
    fireEvent.click(proxyCheckbox);

    expect(screen.getByPlaceholderText(/enter max amount/i)).toBeInTheDocument();

    const maxBidInput = screen.getByPlaceholderText(/enter max amount/i);
    
    // Set invalid max bid (below minimum)
    fireEvent.change(maxBidInput, { target: { value: "1050" } });
    expect(screen.getByText(/max bid must be at least r1,100/i)).toBeInTheDocument();

    // Set valid max bid
    fireEvent.change(maxBidInput, { target: { value: "2000" } });
    
    const placeBidBtn = screen.getByRole("button", { name: /place bid/i });
    fireEvent.click(placeBidBtn);

    expect(mockOnBid).toHaveBeenCalledWith(1100, 2000, true);
  });

  it("filters quick bids when proxy max bid is set", () => {
    render(
      <BidForm
        auction={mockAuction}
        onBid={mockOnBid}
        isLoading={false}
      />
    );

    // Enable proxy and set max bid to 1150
    fireEvent.click(screen.getByLabelText(/enable auto-bid/i));
    fireEvent.change(screen.getByPlaceholderText(/enter max amount/i), {
      target: { value: "1150" },
    });

    // Only 1100 quick bid should be available, 1200 and 1600 should be filtered
    expect(screen.getByRole("button", { name: /quick bid.*1,?100/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /quick bid.*1,?200/i })).not.toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(
      <BidForm
        auction={mockAuction}
        onBid={mockOnBid}
        isLoading={true}
      />
    );
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /processing/i })).toBeDisabled();
  });

  it("updates manual bid when auction price changes", () => {
    const { rerender } = render(
      <BidForm
        auction={mockAuction}
        onBid={mockOnBid}
        isLoading={false}
      />
    );
    expect(screen.getByPlaceholderText(/enter amount/i)).toHaveValue(1100);

    const updatedAuction = { ...mockAuction, currentPrice: 1500 };
    rerender(
      <BidForm
        auction={updatedAuction as unknown as Doc<"auctions">}
        onBid={mockOnBid}
        isLoading={false}
      />
    );
    expect(screen.getByPlaceholderText(/enter amount/i)).toHaveValue(1600);
  });

  it("syncs with currentUserMaxBid prop", () => {
    const { rerender } = render(
      <BidForm
        auction={mockAuction}
        onBid={mockOnBid}
        isLoading={false}
        currentUserMaxBid={2000}
        isProxyActive={true}
      />
    );
    
    expect(screen.getByPlaceholderText(/enter max amount/i)).toHaveValue(2000);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/current: r2,000/i)).toBeInTheDocument();

    // Rerender with new max bid
    rerender(
      <BidForm
        auction={mockAuction}
        onBid={mockOnBid}
        isLoading={false}
        currentUserMaxBid={2500}
        isProxyActive={true}
      />
    );
    expect(screen.getByPlaceholderText(/enter max amount/i)).toHaveValue(2500);
  });

  it("should validate max bid amount", () => {
    render(
      <BidForm
        auction={mockAuction}
        onBid={mockOnBid}
        isLoading={false}
      />
    );
    
    fireEvent.click(screen.getByLabelText(/enable auto-bid/i));
    const manualInput = screen.getByPlaceholderText(/enter amount/i);
    const maxBidInput = screen.getByPlaceholderText(/enter max amount/i);

    fireEvent.change(manualInput, { target: { value: "1500" } });
    fireEvent.change(maxBidInput, { target: { value: "1400" } });

    expect(screen.getByText(/max bid must be at least the manual amount of r 1,500/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /place bid/i })).toBeDisabled();
  });
});
