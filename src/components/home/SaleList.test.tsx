import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import { SaleList, type SaleListItem } from "./SaleList";

const NOW = Date.UTC(2026, 10, 23, 9, 0);
const sales: SaleListItem[] = [
  {
    _id: "a",
    title: "Tractor & TLB Clearance",
    startTime: NOW - 1,
    effectiveEndTime: NOW + 27 * 3_600_000,
    lotCount: 5,
    bucket: "live",
  },
  {
    _id: "b",
    title: "Implements and Trailers",
    startTime: NOW + 3_600_000,
    effectiveEndTime: NOW + 9 * 3_600_000,
    lotCount: 1,
    bucket: "upcoming",
  },
];

describe("SaleList", () => {
  it("lists each sale with its status, close and lot count", () => {
    render(
      <MemoryRouter>
        <SaleList sales={sales} now={NOW} />
      </MemoryRouter>
    );
    const items = within(
      screen.getByRole("list", { name: "Auctions" })
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Live");
    expect(items[0]).toHaveTextContent("Closes in 1d 3h · 5 lots");
    expect(within(items[0]).getByRole("link")).toHaveAttribute(
      "href",
      "/auctions/a"
    );
    expect(items[1]).toHaveTextContent("Upcoming");
    expect(items[1]).toHaveTextContent("Opens Mon 23 Nov, 12:00");
    expect(items[1]).toHaveTextContent("1 lot");
    expect(items[1]).not.toHaveTextContent("Closes in");
  });
});
