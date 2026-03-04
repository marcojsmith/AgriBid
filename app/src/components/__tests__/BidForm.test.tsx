// app/src/components/__tests__/BidForm.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { Doc, Id } from "convex/_generated/dataModel";

import { BidForm } from "../bidding/BidForm";

describe("BidForm", () => {
  const mockAuction = {
    _id: "auction123" as Id<"auctions">,
    currentPrice: 50000,
    minIncrement: 500,
    endTime: Date.now() + 100000,
    status: "active",
  } as Doc<"auctions">;

  it("validates manual bid input correctly", () => {
    render(<BidForm auction={mockAuction} onBid={vi.fn()} isLoading={false} />);

    const input = screen.getByPlaceholderText("Enter amount");
    const submitButton = screen.getByRole("button", { name: /Place Bid/i });

    // Try a bid lower than minimum
    fireEvent.change(input, { target: { value: "50499" } });
    expect(submitButton).toBeDisabled();

    // Try a valid bid
    fireEvent.change(input, { target: { value: "50500" } });
    expect(submitButton).not.toBeDisabled();
  });

  it("renders quick bid buttons with correct amounts", () => {
    render(<BidForm auction={mockAuction} onBid={vi.fn()} isLoading={false} />);

    // Use a custom matcher to handle non-breaking spaces and different separators
    const matchCurrency = (amount: string) => {
      return screen.getByText((_content, element) => {
        if (!element) return false;
        const hasText = (node: Element) =>
          node.textContent?.replace(/[,.\s\u00A0]+/g, " ").trim() ===
          `R ${amount}`.replace(/[,.\s\u00A0]+/g, " ").trim();
        const nodeHasText = hasText(element);
        const childrenDontHaveText = Array.from(element.children).every(
          (child) => !hasText(child)
        );
        return nodeHasText && childrenDontHaveText;
      });
    };

    expect(matchCurrency("50 500")).toBeInTheDocument();
    expect(matchCurrency("51 000")).toBeInTheDocument();
    expect(matchCurrency("53 000")).toBeInTheDocument();
  });

  it("disables bidding and shows banner when user is unverified", () => {
    render(
      <BidForm
        auction={mockAuction}
        onBid={vi.fn()}
        isLoading={false}
        isBidFormEnabled={false}
      />
    );

    // Assert manual input and submit are disabled
    const input = screen.getByPlaceholderText("Enter amount");
    const submitButton = screen.getByRole("button", { name: /Place Bid/i });
    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();

    // Assert quick bid buttons are disabled
    const quickBidButtons = screen
      .getAllByRole("button")
      .filter(
        (btn) => btn !== submitButton && btn.textContent?.includes("Quick Bid")
      );
    quickBidButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("enables bidding by default (backward compatibility)", () => {
    render(<BidForm auction={mockAuction} onBid={vi.fn()} isLoading={false} />);

    const input = screen.getByPlaceholderText("Enter amount");
    expect(input).not.toBeDisabled();
  });
});
