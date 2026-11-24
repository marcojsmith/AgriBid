import { render, screen } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterLayout } from "./RegisterLayout";
import { resetConvexState, setQuery } from "./testing";

vi.mock("convex/react", async () => {
  const t = await import("./testing");
  return { useQuery: t.mockUseQuery };
});

const LOT_ID = "k57abcdefghjkmnpqrstvwxyz2345678";
// Testing Library collapses non-breaking spaces in rendered text, so match plain spaces.
const SP = String.fromCharCode(32);

/**
 * Renders the layout with a body.
 *
 * @param callbackUrl - The callback URL
 * @param deposit - The deposit setting
 * @param deposit.amount - Deposit in rand
 * @param deposit.refundDays - Refund window in working days
 */
function renderLayout(
  callbackUrl: string | null,
  deposit?: { amount: number; refundDays: number }
) {
  render(
    <MemoryRouter>
      <RegisterLayout
        callbackUrl={callbackUrl}
        title="Your details"
        intro="As they appear on your ID."
        progress={{ step: 1, total: 4, label: "Details" }}
        deposit={deposit}
      >
        <p>Body</p>
      </RegisterLayout>
    </MemoryRouter>
  );
}

describe("RegisterLayout", () => {
  beforeEach(() => {
    resetConvexState();
  });

  it("without a callback: Auctions back link, no side card", () => {
    renderLayout(null);
    expect(screen.getByRole("link", { name: "Auctions" })).toHaveAttribute(
      "href",
      "/"
    );
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Your details" })
    ).toBeInTheDocument();
    expect(screen.getByText("As they appear on your ID.")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("with a lot callback: back link, and a side card with photo, title and deposit lines", () => {
    setQuery(api.auctions.getLotHeadline, {
      lotNumber: 3,
      title: "New Holland T6070",
      closesAt: Date.UTC(2026, 10, 25, 9, 0),
      photoUrl: "https://img.test/t6070.jpg",
    });
    renderLayout(`/auction/${LOT_ID}`, { amount: 5000, refundDays: 3 });

    expect(
      screen.getByRole("link", { name: "Lot 3 · New Holland T6070" })
    ).toHaveAttribute("href", `/auction/${LOT_ID}`);
    const card = screen.getByRole("complementary", {
      name: "Registering to bid on",
    });
    expect(card).toHaveTextContent("New Holland T6070");
    expect(card).toHaveTextContent("Lot 3 · Wed 25 Nov, 11:00");
    expect(card.querySelector("img")).toHaveAttribute(
      "src",
      "https://img.test/t6070.jpg"
    );
    expect(card).toHaveTextContent(
      `R${SP}5${SP}000 deposit, refunded within 3 working days if you don't buy`
    );
    expect(card).toHaveTextContent("Have ready: ID + proof of address");
  });

  it("never shows the FICA or inspection lines", () => {
    setQuery(api.auctions.getLotHeadline, { lotNumber: 3, title: "T6070" });
    renderLayout(`/auction/${LOT_ID}`, { amount: 5000, refundDays: 3 });
    expect(screen.queryByText(/Seller ID checked/)).toBeNull();
    expect(screen.queryByText(/Inspection photos/)).toBeNull();
  });

  it("leaves out the deposit lines when the deposit is off", () => {
    setQuery(api.auctions.getLotHeadline, {
      title: "Baler",
      closesAt: Date.UTC(2026, 10, 25, 9, 0),
    });
    renderLayout(`/auction/${LOT_ID}`);
    const card = screen.getByRole("complementary");
    expect(card).toHaveTextContent("Baler");
    expect(card).toHaveTextContent("Wed 25 Nov, 11:00");
    expect(card).not.toHaveTextContent("deposit");
    expect(card.querySelector("img")).toBeNull();
  });

  it("labels a non-lot callback 'Back' with no side card", () => {
    renderLayout("/watchlist");
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/watchlist"
    );
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("shows the progress bar", () => {
    renderLayout(null);
    expect(
      screen.getByRole("group", { name: "Step 1 of 4, Details" })
    ).toBeInTheDocument();
  });
});
