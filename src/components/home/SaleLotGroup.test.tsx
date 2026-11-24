import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SaleLotGroup } from "./SaleLotGroup";

const data = vi.hoisted<{ home: unknown }>(() => ({ home: undefined }));

vi.mock("convex/react", () => ({
  useQuery: () => data.home,
}));
vi.mock("convex/_generated/api", () => ({
  api: { auctions: { getHomeLots: "homeLots" } },
}));

const NOW = Date.UTC(2026, 10, 23, 9, 0);
const sale = {
  _id: "a",
  title: "Tractor & TLB Clearance",
  effectiveEndTime: NOW + 27 * 3_600_000,
  lotCount: 5,
};
const lot = (id: string, endsIn = 3_600_000) => ({
  _id: id,
  title: "JCB 3CX 4x4 TLB",
  make: "Other",
  model: "",
  year: 0,
  operatingHours: 0,
  location: "Mthatha",
  lotNumber: 1,
  startingPrice: 80000,
  currentPrice: 80000,
  reserveState: "applies" as const,
  watchers: 3,
  bids: 0,
  effectiveEndTime: NOW + endsIn,
});

const renderGroup = () =>
  render(
    <MemoryRouter>
      <SaleLotGroup
        sale={sale}
        now={NOW}
        watchedIds={new Set()}
        onToggleWatch={() => undefined}
      />
    </MemoryRouter>
  );

describe("SaleLotGroup", () => {
  beforeEach(() => {
    data.home = undefined;
  });

  it("shows the sale heading, close, lot count, View all and its lots", () => {
    data.home = { matched: 5, lots: [lot("l1"), lot("l2")] };
    renderGroup();
    expect(
      screen.getByRole("heading", { level: 2, name: "Tractor & TLB Clearance" })
    ).toBeVisible();
    expect(screen.getByText("Closes in 1d 3h · 5 lots")).toBeVisible();
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/auctions/a"
    );
    // Falls back to the lot title when the model is unknown.
    expect(screen.getAllByText("JCB 3CX 4x4 TLB")).toHaveLength(2);
  });

  it("says 20+ lots when the count is a lower bound", () => {
    data.home = { matched: 20, lots: [lot("l1")] };
    render(
      <MemoryRouter>
        <SaleLotGroup
          sale={{ ...sale, lotCount: 20, lotCountCapped: true }}
          now={NOW}
          watchedIds={new Set()}
          onToggleWatch={() => undefined}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/20\+ lots/)).toBeVisible();
  });

  it("renders nothing while loading or when every lot has closed", () => {
    const { container } = renderGroup();
    expect(container).toBeEmptyDOMElement();
    data.home = { matched: 1, lots: [lot("l1", -1000)] };
    const second = renderGroup();
    expect(second.container).toBeEmptyDOMElement();
  });
});
