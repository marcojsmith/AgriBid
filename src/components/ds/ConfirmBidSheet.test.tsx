import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { confirmBreakdown, type BidError } from "@/lib/lotPage";

import { ConfirmBidSheet } from "./ConfirmBidSheet";

const SPACES = /[\u202f\u00a0]/g;
const clean = (s: string | null) => (s ?? "").replace(SPACES, " ");

function renderSheet(
  over: {
    seller?: "vat" | "private";
    error?: BidError | null;
    busy?: boolean;
    bid?: number;
  } = {}
) {
  const onConfirm = vi.fn();
  const onReviseBid = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmBidSheet
      open
      onOpenChange={onOpenChange}
      lotLabel="New Holland T6070 · Lot 3"
      breakdown={confirmBreakdown({
        bid: over.bid ?? 417_500,
        premiumFraction: 0.12,
        vatRatePct: 15,
        seller: over.seller ?? "vat",
      })}
      onConfirm={onConfirm}
      onReviseBid={onReviseBid}
      busy={over.busy ?? false}
      error={over.error ?? null}
    />
  );
  return { onConfirm, onReviseBid, onOpenChange };
}

describe("ConfirmBidSheet", () => {
  it("shows your bid, premium, VAT and what you pay if you win", () => {
    renderSheet();
    const sheet = screen.getByRole("dialog", { name: "Confirm your bid" });
    const body = clean(sheet.textContent);
    expect(body).toContain("New Holland T6070 · Lot 3");
    expect(body).toContain("Your bid");
    expect(body).toContain("R 417 500");
    expect(body).toContain("Buyer's premium 12%");
    expect(body).toContain("R 50 100");
    expect(body).toContain("VAT 15%");
    expect(body).toContain("R 70 140");
    expect(body).toContain("If you win, you pay");
    expect(body).toContain("R 537 740");
    expect(body).toContain(
      "Your bid is binding. If you win, pay by EFT within 48 hours."
    );
  });

  it("private seller: VAT on the premium only", () => {
    renderSheet({ seller: "private", bid: 400_000 });
    const body = clean(screen.getByRole("dialog").textContent);
    expect(body).toContain("VAT 15% on the premium");
    expect(body).toContain("R 455 200");
  });

  it("Confirm bid R x submits; Cancel closes", () => {
    const { onConfirm, onOpenChange } = renderSheet();
    const confirm = screen.getByRole("button", { name: /Confirm bid R\s417/ });
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows progress and blocks a second tap while sending", () => {
    renderSheet({ busy: true });
    expect(
      screen.getByRole("button", { name: "Placing your bid…" })
    ).toBeDisabled();
  });

  it("outbid while confirming: says so and offers the new minimum", () => {
    const { onReviseBid } = renderSheet({
      error: {
        kind: "outbid",
        minimum: 421_000,
        message: "Someone bid before you. The minimum is now R 421 000.",
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Someone bid before you"
    );
    expect(screen.queryByRole("button", { name: /Confirm bid/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Bid R\s421/ }));
    expect(onReviseBid).toHaveBeenCalledWith(421_000);
  });

  it("below minimum offers the minimum too", () => {
    renderSheet({
      error: {
        kind: "below-minimum",
        minimum: 414_000,
        message: "The minimum bid is R 414 000.",
      },
    });
    expect(screen.getByRole("button", { name: /^Bid R\s414/ })).toBeVisible();
  });

  it.each([
    ["closed", "Bidding on this lot has closed."],
    ["unverified", "Verify your account before you bid."],
  ] as const)(
    "%s: shows the reason and disables confirming",
    (kind, message) => {
      renderSheet({ error: { kind, message } });
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(
        screen.getByRole("button", { name: /Confirm bid/ })
      ).toBeDisabled();
    }
  );

  it("a generic failure keeps the confirm button usable", () => {
    renderSheet({ error: { kind: "other", message: "Something went wrong" } });
    expect(screen.getByRole("button", { name: /Confirm bid/ })).toBeEnabled();
  });
});
