import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LotStickyBar } from "./LotStickyBar";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

vi.mock("@/hooks/useNow", () => ({ useNow: () => NOW }));

const clean = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");

describe("LotStickyBar", () => {
  it("guest: price and time, opening bid, WhatsApp and Register to bid", () => {
    render(
      <LotStickyBar
        price={400_000}
        hasBids={false}
        closesAt={NOW + 51 * HOUR}
        viewer="guest"
        action={{ kind: "link", href: "/login", label: "Register to bid" }}
        whatsappHref="https://wa.me/27837000000"
      />
    );
    const bar = screen.getByRole("region", { name: "Bidding" });
    expect(clean(bar.textContent)).toContain("R 400 000 · 2d 3h");
    expect(bar).toHaveTextContent("Opening bid");
    expect(
      screen.getByRole("link", { name: "WhatsApp us" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Register to bid" })
    ).toHaveAttribute("href", "/login");
  });

  it("registered: Bid R x calls the handler", () => {
    const onBid = vi.fn();
    render(
      <LotStickyBar
        price={410_500}
        hasBids
        closesAt={NOW + 5 * HOUR}
        viewer="registered"
        action={{ kind: "bid", amount: 414_000, onBid }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Bid R\s414/ }));
    expect(onBid).toHaveBeenCalledOnce();
    expect(screen.getByText("Current bid")).toBeInTheDocument();
  });

  it("leading: green state and an outline Raise my bid", () => {
    const onRaise = vi.fn();
    render(
      <LotStickyBar
        price={410_500}
        hasBids
        closesAt={NOW + 5 * HOUR}
        viewer="leading"
        action={{ kind: "raise", onRaise }}
      />
    );
    expect(screen.getByText("You're leading")).toHaveClass("text-ok-fg");
    fireEvent.click(screen.getByRole("button", { name: "Raise my bid" }));
    expect(onRaise).toHaveBeenCalledOnce();
  });

  it("outbid under 10 minutes: the countdown leads, in red", () => {
    render(
      <LotStickyBar
        price={428_000}
        hasBids
        closesAt={NOW + 112_000}
        viewer="outbid"
        action={{ kind: "bid", amount: 431_500, onBid: vi.fn() }}
      />
    );
    expect(screen.getByText("1m 52s left")).toHaveClass("text-urgent-fg");
    expect(clean(screen.getByText(/· Outbid/).textContent)).toBe(
      "R 428 000 · Outbid"
    );
  });

  it("registration: shows the state instead of the price, with an outline link", () => {
    render(
      <LotStickyBar
        price={400_000}
        hasBids={false}
        closesAt={NOW + 51 * HOUR}
        viewer="registered"
        registration={{ kind: "under_review", depositReceived: false }}
        action={{
          kind: "link",
          href: "/register/status?callbackUrl=%2Fauction%2Fl1",
          label: "Details",
          ctaVariant: "outline",
        }}
        whatsappHref="https://wa.me/27837000000"
      />
    );
    const bar = screen.getByRole("region", { name: "Bidding" });
    expect(bar).toHaveTextContent("Under review");
    expect(bar).toHaveTextContent("Bidding opens when approved");
    expect(clean(bar.textContent)).not.toContain("R 400 000");
    expect(screen.getByRole("link", { name: "WhatsApp us" })).toBeVisible();
    const cta = screen.getByRole("link", { name: "Details" });
    expect(cta).toHaveAttribute(
      "href",
      "/register/status?callbackUrl=%2Fauction%2Fl1"
    );
    expect(cta).toHaveClass("bg-card");
  });

  it("a primary link keeps the default look", () => {
    render(
      <LotStickyBar
        price={1}
        hasBids={false}
        closesAt={NOW + HOUR}
        viewer="registered"
        registration={{ kind: "incomplete", step: 2, totalSteps: 4 }}
        action={{ kind: "link", href: "/register", label: "Continue" }}
      />
    );
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).not.toHaveClass(
      "bg-card"
    );
  });

  it("can be hidden", () => {
    render(
      <LotStickyBar
        price={1}
        hasBids={false}
        closesAt={NOW + HOUR}
        viewer="guest"
        action={{ kind: "link", href: "/login", label: "Register to bid" }}
        hidden
      />
    );
    expect(screen.queryByRole("region")).toBeNull();
  });
});
