import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mutationMock, resetConvexState } from "@/pages/register/testing";

import { BidRow } from "./BidRow";
import { fixtureLotId, makeBidRow } from "./fixtures";

vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  return { useQuery: t.mockUseQuery, useMutation: t.mockUseMutation };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NOW = Date.UTC(2026, 10, 25, 6, 30); // Wed 25 Nov 2026, 08:30 SAST

/**
 * Renders a row.
 *
 * @param row - The row
 * @param props - Page-level props
 * @param props.canBid - Whether the buyer may bid
 * @param props.vatRatePct - VAT rate
 */
function renderRow(
  row: ReturnType<typeof makeBidRow>,
  props: { canBid?: boolean; vatRatePct?: number | undefined } = {}
) {
  render(
    <MemoryRouter>
      <BidRow
        row={row}
        canBid={props.canBid ?? true}
        vatRatePct={"vatRatePct" in props ? props.vatRatePct : 15}
      />
    </MemoryRouter>
  );
}

describe("BidRow", () => {
  beforeEach(() => {
    resetConvexState();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an outbid lot with both figures, the closing line and a one-tap bid", () => {
    renderRow(makeBidRow(NOW));
    expect(screen.getByText("Outbid")).toBeVisible();
    expect(screen.getByText("Lot 3")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "New Holland T6070" })
    ).toHaveAttribute("href", `/auction/${fixtureLotId("t6070")}`);
    expect(screen.getByText("2016 · 4 850 hrs · Malmesbury")).toBeVisible();
    expect(screen.getByText("Your bid")).toBeVisible();
    expect(screen.getByText("Current bid")).toBeVisible();
    expect(screen.getByRole("timer")).toHaveAttribute(
      "aria-label",
      "Closes in 2 hours 30 minutes"
    );
    expect(screen.getByRole("button", { name: /Bid R.421.000/ })).toBeVisible();
  });

  it("turns the closing line amber under an hour and red under ten minutes", () => {
    renderRow(makeBidRow(NOW, { auctionEndTime: NOW + 40 * 60_000 }));
    expect(screen.getByRole("timer")).toHaveAttribute("data-tone", "warn");
  });

  it("is red under ten minutes", () => {
    renderRow(makeBidRow(NOW, { auctionEndTime: NOW + 5 * 60_000 }));
    expect(screen.getByRole("timer")).toHaveAttribute("data-tone", "urgent");
  });

  it("hides the bid button once the closing time has passed", () => {
    renderRow(makeBidRow(NOW, { auctionEndTime: NOW - 1000 }));
    expect(screen.queryByRole("button", { name: /Bid R/ })).toBeNull();
  });

  it("shows Leading with no bid button", () => {
    renderRow(makeBidRow(NOW, { isWinning: true }));
    expect(screen.getByText("Leading")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Bid R/ })).toBeNull();
  });

  it("hides the bid button when the buyer cannot bid yet", () => {
    renderRow(makeBidRow(NOW), { canBid: false });
    expect(screen.queryByRole("button", { name: /Bid R/ })).toBeNull();
  });

  it("waits for the VAT rate before enabling the bid button", () => {
    renderRow(makeBidRow(NOW), { vatRatePct: undefined });
    expect(screen.getByRole("button", { name: /Bid R/ })).toBeDisabled();
  });

  it("explains a soft-close extension", () => {
    renderRow(
      makeBidRow(NOW, {
        isExtended: true,
        extendedEndTime: NOW + 112_000,
        auctionEndTime: NOW - 60_000,
      })
    );
    expect(screen.getByText("Extended +2 min")).toBeVisible();
    expect(
      screen.getByText("A bid in the last 2 minutes added 2 minutes.")
    ).toBeVisible();
    expect(screen.getByRole("timer")).toHaveAttribute("data-tone", "urgent");
  });

  it("opens the confirm sheet with the lot's totals and places the bid", async () => {
    const placeBid = mutationMock(api.auctions.mutations.bidding.placeBid);
    placeBid.mockResolvedValue(null);
    renderRow(makeBidRow(NOW));
    fireEvent.click(screen.getByRole("button", { name: /Bid R.421.000/ }));
    expect(screen.getByText("Confirm your bid")).toBeVisible();
    expect(screen.getByText("New Holland T6070 · Lot 3")).toBeVisible();
    // R 421 000 + 12% premium (50 520) + 15% VAT on both (70 728)
    expect(screen.getByText(/R.542.248/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Confirm bid/ }));
    await waitFor(() => {
      expect(placeBid).toHaveBeenCalledWith({
        lotId: fixtureLotId("t6070"),
        amount: 421_000,
      });
    });
  });

  it("uses the premium and VAT of a private seller", () => {
    renderRow(makeBidRow(NOW, { sellerVatKind: "private" }));
    fireEvent.click(screen.getByRole("button", { name: /Bid R.421.000/ }));
    expect(screen.getByText("VAT 15% on the premium")).toBeVisible();
  });

  it("shows a lot with the seller and their deadline", () => {
    renderRow(
      makeBidRow(NOW, {
        status: "under_consideration",
        isLeadingConsideration: true,
        reserveState: "not_met",
        considerationDeadline: Date.UTC(2026, 10, 26, 9, 0),
        myHighestBid: 64_500,
        currentPrice: 64_500,
      })
    );
    expect(screen.getByText("Under consideration")).toBeVisible();
    expect(screen.getByText("Reserve")).toBeVisible();
    expect(screen.getByText("Not met")).toBeVisible();
    expect(
      screen.getByText(
        "Your bid is with the seller. They have until Thu 26 Nov, 11:00 to accept. We'll notify you either way."
      )
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /Bid R/ })).toBeNull();
  });

  it("shows the top bid when someone else leads a lot with the seller", () => {
    renderRow(
      makeBidRow(NOW, {
        status: "under_consideration",
        isLeadingConsideration: false,
        myHighestBid: 118_000,
        currentPrice: 124_000,
      })
    );
    expect(screen.getByText("Top bid")).toBeVisible();
    expect(
      screen.getByText("The seller is deciding on the top bid.")
    ).toBeVisible();
  });

  it("copes with a lot with the seller that has no deadline", () => {
    renderRow(
      makeBidRow(NOW, {
        status: "under_consideration",
        isLeadingConsideration: true,
      })
    );
    expect(
      screen.getByText(
        "Your bid is with the seller. We'll notify you either way."
      )
    ).toBeVisible();
  });
});
