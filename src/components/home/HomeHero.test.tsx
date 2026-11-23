import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

import { HomeHero, type HeroSale } from "./HomeHero";

const NOW = Date.UTC(2026, 10, 23, 9, 0); // 11:00 SAST
const sale: HeroSale = {
  _id: "a1",
  title: "Year End Commercial Auction",
  startTime: NOW - 1000,
  endTime: NOW + 51 * 3_600_000,
  effectiveEndTime: NOW + 51 * 3_600_000,
  lotCount: 85,
  bucket: "live",
};
const deposit = { enabled: true, amount: 5000, refundDays: 3 };
const featured = {
  _id: "l1",
  title: "2016 John Deere 8370RT",
  town: "Wolmaranstad",
  price: 2_000_000,
  hasBids: false,
};

const renderHero = (
  props: Partial<React.ComponentProps<typeof HomeHero>> = {}
) =>
  render(
    <MemoryRouter>
      <HomeHero
        sale={sale}
        featured={featured}
        example={{ title: "New Holland T6070", bid: 400_000 }}
        premiumPct={12}
        deposit={deposit}
        signedIn={false}
        now={NOW}
        lotsHref="/auctions/a1"
        totalLots={85}
        onFeesClick={() => undefined}
        {...props}
      />
    </MemoryRouter>
  );

describe("HomeHero", () => {
  it("shows the live sale with its close, date and lot count from data", () => {
    renderHero();
    expect(
      screen.getByRole("heading", { level: 1, name: sale.title })
    ).toBeVisible();
    expect(screen.getByText("Live")).toBeVisible();
    expect(screen.getByText("Closes in 2d 3h")).toBeVisible();
    expect(screen.getByText("Wed 25 Nov, 14:00 · 85 lots")).toBeVisible();
    expect(
      screen.getByText("Bids in the last 2 minutes add 2 minutes.")
    ).toBeVisible();
  });

  it("shows the featured lot caption without a Most watched label", () => {
    renderHero();
    const link = screen.getByRole("link", { name: /2016 John Deere 8370RT/ });
    expect(link).toHaveAttribute("href", "/auction/l1");
    expect(link).toHaveTextContent("Wolmaranstad · Opening bid R 2 000 000");
    expect(screen.queryByText(/Most watched/)).toBeNull();
  });

  it("calls the bid Current bid once the featured lot has bids", () => {
    renderHero({ featured: { ...featured, hasBids: true } });
    expect(screen.getByRole("link", { name: /Current bid/ })).toBeVisible();
  });

  it("omits the photo when there is no featured lot", () => {
    renderHero({ featured: null });
    expect(screen.queryByRole("link", { name: /John Deere/ })).toBeNull();
  });

  it("shows the worked cost, opens Fees & rules and hides it without an example", () => {
    const onFeesClick = vi.fn();
    const { rerender } = renderHero({ onFeesClick });
    expect(screen.getByText(/Bid R 400 000 → pay R 515 200/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Fees & rules" }));
    expect(onFeesClick).toHaveBeenCalled();
    rerender(
      <MemoryRouter>
        <HomeHero
          sale={sale}
          featured={null}
          example={null}
          premiumPct={12}
          deposit={deposit}
          signedIn={false}
          now={NOW}
          lotsHref="/auctions/a1"
          totalLots={85}
          onFeesClick={onFeesClick}
        />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Bid R/)).toBeNull();
  });

  it("guests see Register to bid, the deposit lines and the trust lines", () => {
    renderHero();
    expect(
      screen.getByRole("link", { name: "Register to bid" })
    ).toHaveAttribute("href", "/login");
    expect(
      screen.getByRole("link", { name: "View all 85 lots" })
    ).toHaveAttribute("href", "/auctions/a1");
    expect(
      screen.getByText(/R 5 000 deposit, refunded within 3 working days/)
    ).toBeVisible();
    expect(
      screen.getByText(/Have ready: ID \+ proof of address/)
    ).toBeVisible();
    expect(screen.getByText("Seller ID checked (FICA)")).toBeVisible();
    expect(screen.getByText("Inspection photos on every lot")).toBeVisible();
  });

  it("signed-in visitors see My bids and no deposit or trust lines", () => {
    renderHero({ signedIn: true });
    expect(screen.getByRole("link", { name: "My bids" })).toHaveAttribute(
      "href",
      "/dashboard/bids"
    );
    expect(screen.queryByText("Register to bid")).toBeNull();
    expect(screen.queryByText(/deposit/)).toBeNull();
    expect(screen.queryByText("Seller ID checked (FICA)")).toBeNull();
  });

  it("leaves the deposit lines out when no deposit applies", () => {
    renderHero({ deposit: { ...deposit, enabled: false } });
    expect(screen.queryByText(/deposit/)).toBeNull();
    expect(screen.getByText("Seller ID checked (FICA)")).toBeVisible();
  });

  it("shows an upcoming sale by its opening time", () => {
    renderHero({
      sale: { ...sale, bucket: "upcoming", startTime: NOW + 3_600_000 },
      totalLots: 1,
    });
    expect(screen.getByText("Opens Mon 23 Nov, 12:00")).toBeVisible();
    expect(screen.queryByText(/Closes in/)).toBeNull();
    expect(screen.queryByText(/add 2 minutes/)).toBeNull();
    expect(screen.getByText("Mon 23 Nov, 12:00 · 1 lot")).toBeVisible();
  });

  it("lists the sales and drops View all lots in the multi-sale state", () => {
    const sales = [
      {
        _id: "a1",
        title: "Sale A",
        startTime: NOW - 1000,
        effectiveEndTime: NOW + 51 * 3_600_000,
        lotCount: 85,
        lotCountCapped: true,
        bucket: "live" as const,
      },
      {
        _id: "b1",
        title: "Sale B",
        startTime: NOW + 3_600_000,
        effectiveEndTime: NOW + 9 * 3_600_000,
        lotCount: 4,
        bucket: "upcoming" as const,
      },
    ];
    renderHero({ sale: null, sales, lotsHref: "/auctions", totalLots: 21 });
    expect(
      screen.getByRole("heading", { level: 1, name: /auctions/i })
    ).toBeVisible();
    expect(screen.getByText(/^1 live · 1 opens /)).toBeVisible();
    const rows = within(screen.getByRole("list", { name: "Auctions" }));
    expect(rows.getAllByRole("listitem")).toHaveLength(2);
    expect(rows.getByText(/85\+ lots/)).toBeVisible();
    expect(screen.queryByRole("link", { name: /View all/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Register to bid" })).toBeVisible();
    expect(screen.getByRole("link", { name: /John Deere/ })).toBeVisible();
  });

  it("shows no heading or list with no sale and fewer than two sales", () => {
    renderHero({ sale: null, lotsHref: "/auctions", totalLots: 21 });
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("list", { name: "Auctions" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "View all 21 lots" })
    ).toHaveAttribute("href", "/auctions");
  });

  it("counts several upcoming sales in the multi-sale summary", () => {
    const upcoming = (id: string) => ({
      _id: id,
      title: id,
      startTime: NOW + 3_600_000,
      effectiveEndTime: NOW + 9 * 3_600_000,
      lotCount: 1,
      bucket: "upcoming" as const,
    });
    renderHero({
      sale: null,
      sales: [upcoming("x"), upcoming("y")],
      totalLots: 2,
    });
    expect(screen.getByText("0 live · 2 upcoming")).toBeVisible();
  });
});
