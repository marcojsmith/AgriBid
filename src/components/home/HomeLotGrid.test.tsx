import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { HomeLotGrid, type HomeGridLot } from "./HomeLotGrid";

const NOW = 1_000_000;
const lot = (over: Partial<HomeGridLot> = {}): HomeGridLot => ({
  _id: "l1",
  make: "New Holland",
  model: "T6070",
  year: 2016,
  operatingHours: 4850,
  location: "Malmesbury",
  lotNumber: 3,
  startingPrice: 400_000,
  currentPrice: 400_000,
  reserveState: "applies",
  watchers: 8,
  bids: 0,
  effectiveEndTime: NOW + 3 * 3_600_000,
  ...over,
});

const renderGrid = (
  lots: HomeGridLot[],
  extra: Partial<React.ComponentProps<typeof HomeLotGrid>> = {}
) =>
  render(
    <HomeLotGrid
      lots={lots}
      watchedIds={new Set()}
      onToggleWatch={() => undefined}
      showCloses={false}
      now={NOW}
      {...extra}
    />
  );

describe("HomeLotGrid", () => {
  it("shows the lot chip, specs, opening bid and watchers for a lot with no bids", () => {
    renderGrid([lot()]);
    expect(screen.getByText("Lot 3")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "New Holland T6070" })
    ).toHaveAttribute("href", "/auction/l1");
    expect(screen.getByText(/2016 · 4 850 hrs/)).toBeVisible();
    expect(screen.getByText("Malmesbury", { exact: false })).toBeVisible();
    expect(screen.getByText("Opening bid")).toBeVisible();
    expect(screen.getByText("R 400 000")).toBeVisible();
    expect(screen.getByText("8 watching")).toBeVisible();
    expect(screen.getByText("Reserve applies")).toBeVisible();
  });

  it("shows the current bid, bid count and reserve result once there are bids", () => {
    renderGrid([
      lot({ bids: 3, currentPrice: 450_000, reserveState: "not_met" }),
      lot({
        _id: "l2",
        bids: 2,
        currentPrice: 900_000,
        reserveState: "met",
      }),
    ]);
    expect(screen.getAllByText("Current bid")).toHaveLength(2);
    expect(screen.getByText("3 bids")).toBeVisible();
    expect(screen.getByText("Reserve not met")).toBeVisible();
    expect(screen.getByText("Reserve met")).toBeVisible();
  });

  it("shows No reserve and falls back to a dash for a missing lot number", () => {
    renderGrid([lot({ reserveState: "none", lotNumber: undefined })]);
    expect(screen.getByText("No reserve")).toBeVisible();
    expect(screen.getByText("Lot –")).toBeVisible();
  });

  it("shows Closes in only when asked and the lot is still open", () => {
    const { rerender } = renderGrid([lot()], { showCloses: true });
    expect(screen.getByText(/Closes in 3h 0m/)).toBeVisible();
    rerender(
      <HomeLotGrid
        lots={[lot({ effectiveEndTime: NOW - 1 })]}
        watchedIds={new Set()}
        onToggleWatch={() => undefined}
        showCloses
        now={NOW}
      />
    );
    expect(screen.queryByText(/Closes in/)).toBeNull();
  });

  it("toggles the heart for the lot and reflects watched lots", () => {
    const onToggleWatch = vi.fn();
    renderGrid([lot()], { onToggleWatch, watchedIds: new Set(["l1"]) });
    const heart = screen.getByRole("button", { name: /Watching lot 3/ });
    expect(heart).toHaveAttribute("data-watching", "true");
    fireEvent.click(heart);
    expect(onToggleWatch).toHaveBeenCalledWith("l1");
  });

  it("shows final outcomes with the sold price and bids, and no heart or reserve", () => {
    renderGrid([
      lot({ _id: "s", status: "sold", bids: 9, currentPrice: 52_000 }),
      lot({ _id: "n", status: "unsold", bids: 4, currentPrice: 24_000 }),
      lot({
        _id: "c",
        status: "under_consideration",
        bids: 14,
        currentPrice: 138_000,
      }),
    ]);
    expect(screen.getByText("Sold for")).toBeVisible();
    expect(screen.getByText("R 52 000")).toBeVisible();
    expect(screen.getByText("9 bids")).toBeVisible();
    expect(screen.getByText("Highest bid")).toBeVisible();
    expect(screen.getByText("Top bid")).toBeVisible();
    expect(screen.getByText("Under consideration")).toBeVisible();
    expect(screen.queryByText("Reserve applies")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /watch/i })
    ).not.toBeInTheDocument();
  });
});
