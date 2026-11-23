import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { BidPanel } from "./BidPanel";

type Props = Parameters<typeof BidPanel>[0];

const NOW = Date.now();

const base: Props = {
  viewer: "registered",
  price: 400_000,
  bidCount: 0,
  watchers: 8,
  closesAt: NOW + 51 * 3_600_000,
  extended: false,
  reserve: "applies",
  cost: {
    bid: 400_000,
    seller: "vat",
    premiumPct: 12,
    vatRatePct: 15,
    onFeesClick: vi.fn(),
  },
  deposit: { amount: 5000, refundDays: 3 },
  minimum: 400_000,
  quickAmounts: [400_000, 403_500, 407_000],
  amount: 400_000,
  onAmountChange: vi.fn(),
  onBid: vi.fn(),
  registerHref: "/login?callbackUrl=%2Fauction%2Fl1",
  eligibility: "ok",
};

const SPACES = /[\u202f\u00a0]/g;
const text = (node: HTMLElement) => node.textContent.replace(SPACES, " ");

function renderPanel(over: Partial<Props> = {}) {
  const props = { ...base, onBid: vi.fn(), onAmountChange: vi.fn(), ...over };
  render(
    <MemoryRouter>
      <BidPanel {...props} />
    </MemoryRouter>
  );
  return props;
}

describe("BidPanel", () => {
  it("guest: opening bid, worked total, Register to bid and the deposit lines", () => {
    renderPanel({ viewer: "guest" });
    const panel = screen.getByRole("region", { name: "Bidding" });
    expect(text(panel)).toContain("Opening bid");
    expect(text(panel)).toContain("R 400 000");
    expect(text(panel)).toContain("No bids yet");
    expect(text(panel)).toContain("8 watching");
    expect(text(panel)).toContain("Bid R 400 000 → pay R 515 200");
    expect(text(panel)).toContain("Bids in the last 2 minutes add 2 minutes");
    expect(
      screen.getByRole("link", { name: "Register to bid" })
    ).toHaveAttribute("href", "/login?callbackUrl=%2Fauction%2Fl1");
    expect(text(panel)).toContain("R 5 000 deposit");
    expect(screen.queryByLabelText("Your bid")).toBeNull();
  });

  it("shows the private-seller total for a private seller's lot", () => {
    renderPanel({
      viewer: "guest",
      cost: { ...base.cost, seller: "private" },
    });
    expect(text(screen.getByRole("region"))).toContain(
      "Bid R 400 000 → pay R 455 200"
    );
  });

  it("guest without a deposit setting shows no deposit lines", () => {
    renderPanel({ viewer: "guest", deposit: undefined });
    expect(text(screen.getByRole("region"))).not.toContain("deposit");
  });

  it("registered: prefilled field, three quick amounts and Bid R x", () => {
    const props = renderPanel();
    expect(screen.getByLabelText("Your bid")).toHaveValue("R 400 000");
    const quick = screen.getByRole("group", { name: "Quick bid amounts" });
    expect(
      Array.from(quick.querySelectorAll("button")).map((b) => text(b))
    ).toEqual(["R 400 000", "R 403 500", "R 407 000"]);
    fireEvent.click(screen.getByRole("button", { name: /^Bid R\s400/ }));
    expect(props.onBid).toHaveBeenCalledOnce();
  });

  it("quick amounts and typing change the amount", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /R\s403/ }));
    expect(props.onAmountChange).toHaveBeenCalledWith(403_500);
    fireEvent.change(screen.getByLabelText("Your bid"), {
      target: { value: "R 4a12 000" },
    });
    expect(props.onAmountChange).toHaveBeenLastCalledWith(412_000);
    fireEvent.change(screen.getByLabelText("Your bid"), {
      target: { value: "" },
    });
    expect(props.onAmountChange).toHaveBeenLastCalledWith(0);
  });

  it("disables the bid below the minimum and says what the minimum is", () => {
    renderPanel({ amount: 100_000 });
    expect(screen.getByRole("alert")).toHaveTextContent(/The minimum bid is R/);
    expect(screen.getByRole("button", { name: /^Bid R\s100/ })).toBeDisabled();
  });

  it("has no maximum (proxy) bid field and no increment table", () => {
    renderPanel();
    expect(screen.queryByText(/maximum/i)).toBeNull();
    expect(screen.queryByText(/auto-bid/i)).toBeNull();
    expect(screen.queryByText(/increment/i)).toBeNull();
  });

  it("leading: green banner, reserve explainer and an outline Raise my bid", () => {
    renderPanel({
      viewer: "leading",
      bidCount: 4,
      price: 410_500,
      reserve: "not-met",
    });
    expect(screen.getByRole("status")).toHaveTextContent("You're leading");
    expect(
      screen.getByText(/Reserve not met\. If bidding ends below it/)
    ).toBeInTheDocument();
    expect(text(screen.getByRole("region"))).toContain("Current bid");
    expect(text(screen.getByRole("region"))).toContain("4 bids");
    expect(screen.getByRole("button", { name: "Raise my bid" })).toBeEnabled();
  });

  it("outbid: warning banner with the reserve explainer", () => {
    renderPanel({ viewer: "outbid", bidCount: 5, reserve: "not-met" });
    expect(screen.getByRole("alert")).toHaveTextContent("You've been outbid");
    expect(screen.getByText(/Reserve not met/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Bid R/ })).toBeInTheDocument();
  });

  it("leading with the reserve met says so; with no reserve says nothing", () => {
    const { unmount } = render(
      <MemoryRouter>
        <BidPanel {...base} viewer="leading" bidCount={1} reserve="met" />
      </MemoryRouter>
    );
    expect(screen.getByText("Reserve met.")).toBeInTheDocument();
    unmount();
    renderPanel({ viewer: "outbid", bidCount: 1, reserve: "none" });
    expect(screen.queryByText(/Reserve/)).toBeNull();
  });

  it("does not show a reserve explainer to a registered viewer who has not bid", () => {
    renderPanel({ reserve: "not-met", bidCount: 2 });
    expect(screen.queryByText(/If bidding ends below it/)).toBeNull();
  });

  it("extended: urgent banner, no soft-close rule line", () => {
    renderPanel({ extended: true, closesAt: NOW + 112_000, bidCount: 9 });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Extended: a bid in the last 2 minutes added 2 minutes"
    );
    expect(text(screen.getByRole("region"))).not.toContain(
      "Bids in the last 2 minutes add"
    );
    expect(text(screen.getByRole("region"))).toMatch(/Closes in 1m \d+s/);
  });

  it("a signed-in viewer who is not verified is sent to verify", () => {
    renderPanel({ eligibility: "needs-verification" });
    expect(screen.getByRole("link", { name: "Verify to bid" })).toHaveAttribute(
      "href",
      "/kyc"
    );
    expect(screen.queryByLabelText("Your bid")).toBeNull();
  });

  it("a pending verification explains the wait and offers no bid", () => {
    renderPanel({ eligibility: "verification-pending" });
    expect(screen.getByRole("status")).toHaveTextContent(/being reviewed/);
    expect(screen.queryByRole("link", { name: "Verify to bid" })).toBeNull();
    expect(screen.queryByLabelText("Your bid")).toBeNull();
  });

  it("opens Fees & rules from the cost box", () => {
    const props = renderPanel({ viewer: "guest" });
    fireEvent.click(screen.getByRole("button", { name: "Fees & rules" }));
    expect(props.cost.onFeesClick).toHaveBeenCalledOnce();
  });
});
