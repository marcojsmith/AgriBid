import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { selectOpenLots, type ClosingSoonLot } from "@/lib/closingSoon";

import { ClosingSoonStrip } from "./ClosingSoonStrip";

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

/**
 * Builds a strip lot.
 *
 * @param id - Lot id
 * @param over - Fields to override
 * @returns A lot as `getClosingSoonLots` returns it
 */
const makeLot = (id: string, over: Partial<ClosingSoonLot> = {}) =>
  ({
    _id: id,
    title: `Title ${id}`,
    make: "John Deere",
    model: "8R 370",
    year: 2020,
    lotNumber: 7,
    auctionId: "auction1",
    auctionTitle: "Material Handling Sale",
    currentPrice: 500_000,
    startingPrice: 450_000,
    hasBids: true,
    effectiveEndTime: NOW + 30 * 60 * 1000,
    location: "Bothaville",
    ...over,
  }) as unknown as ClosingSoonLot;

const renderStrip = (lots: ClosingSoonLot[] | undefined, now = NOW) =>
  render(
    <MemoryRouter>
      <ClosingSoonStrip lots={lots} now={now} />
    </MemoryRouter>
  );

describe("selectOpenLots", () => {
  it("drops lots whose end time has passed or is now", () => {
    const lots = [
      makeLot("a", { effectiveEndTime: NOW - 1 }),
      makeLot("b", { effectiveEndTime: NOW }),
      makeLot("c", { effectiveEndTime: NOW + 1 }),
    ];
    expect(selectOpenLots(lots, NOW).map((lot) => lot._id)).toEqual(["c"]);
  });
});

describe("ClosingSoonStrip", () => {
  it("renders the section heading and one list item per lot", () => {
    renderStrip([makeLot("a"), makeLot("b")]);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Closing in the next 24 hours",
      })
    ).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("labels the section by its heading", () => {
    renderStrip([makeLot("a")]);
    expect(
      screen.getByRole("region", { name: "Closing in the next 24 hours" })
    ).toBeInTheDocument();
  });

  it("shows lot number, sale, name, place, price label and countdown", () => {
    renderStrip([makeLot("a", { province: "free_state" })]);
    expect(
      screen.getByText("Lot 7 · Material Handling Sale")
    ).toBeInTheDocument();
    expect(screen.getByText("Free State")).toBeInTheDocument();
    expect(screen.getByText("Current bid")).toBeInTheDocument();
    expect(screen.getByText("R 500 000")).toBeInTheDocument();
    expect(screen.getByText("Closes in")).toBeInTheDocument();
  });

  it("links the lot name to the lot page", () => {
    renderStrip([makeLot("lot42")]);
    const link = screen.getByRole("link", { name: "2020 John Deere 8R 370" });
    expect(link).toHaveAttribute("href", "/auction/lot42");
    // The whole card is the tap target (see the stretched-link test).
    expect(link.className).toContain("after:inset-0");
  });

  it("shows the opening bid when there are no bids", () => {
    renderStrip([makeLot("a", { hasBids: false })]);
    expect(screen.getByText("Opening bid")).toBeInTheDocument();
    expect(screen.getByText("R 450 000")).toBeInTheDocument();
  });

  it("still says Current bid when the first bid equals the starting price", () => {
    renderStrip([
      makeLot("a", {
        hasBids: true,
        currentPrice: 450_000,
        startingPrice: 450_000,
      }),
    ]);
    expect(screen.getByText("Current bid")).toBeInTheDocument();
  });

  it("omits the lot number and falls back to the location", () => {
    renderStrip([makeLot("a", { lotNumber: undefined })]);
    expect(screen.getByText("Material Handling Sale")).toBeInTheDocument();
    expect(screen.getByText("Bothaville")).toBeInTheDocument();
  });

  it("renders nothing when the list is empty", () => {
    const { container } = renderStrip([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when every lot has already ended", () => {
    const { container } = renderStrip([
      makeLot("a", { effectiveEndTime: NOW - HOUR }),
    ]);
    expect(container).toBeEmptyDOMElement();
  });

  it("filters out an ended lot on the client but keeps the others", () => {
    renderStrip([
      makeLot("gone", { year: 1999, effectiveEndTime: NOW - 1 }),
      makeLot("here", { year: 2021 }),
    ]);
    expect(screen.queryByText(/1999/)).not.toBeInTheDocument();
    expect(screen.getByText(/2021/)).toBeInTheDocument();
  });

  it("shows a skeleton and a busy section while loading", () => {
    renderStrip(undefined);
    expect(screen.getAllByTestId("closing-soon-skeleton")).toHaveLength(4);
    expect(
      screen.getByRole("status", { name: "Loading closing soon lots" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Closing in the next 24 hours" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("is a horizontal snap scroller whatever the number of lots", () => {
    const five = ["a", "b", "c", "d", "e"].map((id) => makeLot(id));
    renderStrip(five);
    const list = screen.getByRole("list");
    expect(list.className).toContain("overflow-x-auto");
    expect(list.className).toContain("snap-x");
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.className).toContain("shrink-0");
      expect(item.className).toContain("w-[260px]");
      expect(item.className).toContain("lg:w-[calc((100%-3rem)/4)]");
    }
  });

  it("describes each link by its lot and sale line", () => {
    renderStrip([makeLot("a"), makeLot("b")]);
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAccessibleDescription(
        "Lot 7 · Material Handling Sale"
      );
    }
  });

  it("keeps list semantics explicit for Safari", () => {
    renderStrip([makeLot("a")]);
    expect(screen.getByRole("list")).toHaveAttribute("role", "list");
  });

  it("stretches the lot link over the whole card", () => {
    renderStrip([makeLot("a")]);
    const item = screen.getByRole("listitem");
    expect(item.className).toContain("relative");
    expect(screen.getByRole("link").className).toContain("after:absolute");
    expect(screen.getByRole("link").className).toContain("after:inset-0");
  });

  it("names the empty photo state and leaves a real photo decorative", () => {
    renderStrip([
      makeLot("nophoto", { year: 2018 }),
      makeLot("photo", { year: 2022, leadImageUrl: "https://cdn/a.jpg" }),
    ]);
    expect(
      screen.getByRole("img", { name: "2018 John Deere 8R 370, no photo yet" })
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("drops a lot live once the clock passes its end time", () => {
    const lots = [
      makeLot("soon", { year: 2001, effectiveEndTime: NOW + 1000 }),
      makeLot("later", { year: 2002 }),
    ];
    const { rerender } = renderStrip(lots);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    rerender(
      <MemoryRouter>
        <ClosingSoonStrip lots={lots} now={NOW + 2000} />
      </MemoryRouter>
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText(/2001/)).not.toBeInTheDocument();
  });
});
