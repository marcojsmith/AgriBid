import { describe, it, expect } from "vitest";

import type { LotSummary } from "@/types/auction";

import {
  buildFilterChips,
  parseEventFilters,
  parseEventSort,
  sortLots,
} from "./eventFilters";

const params = (q: string) => new URLSearchParams(q);

describe("parseEventFilters", () => {
  it("reads every filter", () => {
    expect(
      parseEventFilters(
        new URLSearchParams({
          make: "Fendt",
          minYear: "2018",
          maxYear: "2022",
          minPrice: "1",
          maxPrice: "9",
          maxHours: "5000",
        })
      )
    ).toEqual({
      make: "Fendt",
      minYear: 2018,
      maxYear: 2022,
      minPrice: 1,
      maxPrice: 9,
      maxHours: 5000,
    });
  });

  it("treats empty and non-numeric values as unset", () => {
    expect(parseEventFilters(params("make=&minYear=abc&maxHours="))).toEqual({
      make: undefined,
      minYear: undefined,
      maxYear: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      maxHours: undefined,
    });
  });
});

describe("buildFilterChips", () => {
  it("is empty with no filters", () => {
    expect(buildFilterChips({})).toEqual([]);
  });

  it("builds one chip per filter group with the params that clear it", () => {
    const chips = buildFilterChips({
      make: "Fendt",
      minYear: 2018,
      maxYear: 2022,
      minPrice: 100000,
      maxPrice: 200000,
      maxHours: 5000,
    });
    expect(chips.map((c) => c.key)).toEqual(["make", "year", "price", "hours"]);
    expect(chips[1]).toMatchObject({
      label: "Year: 2018–2022",
      paramKeys: ["minYear", "maxYear"],
    });
    expect(chips[2].label).toBe("Price: R 100 000–R 200 000");
    expect(chips[3].label).toMatch(/^Hours: up to 5\s000$/);
  });

  it("uses from / up to phrasing for one-sided ranges", () => {
    expect(buildFilterChips({ minYear: 2020 })[0].label).toBe(
      "Year: from 2020"
    );
    expect(buildFilterChips({ maxPrice: 5000 })[0].label).toBe(
      "Price: up to R 5 000"
    );
  });
});

describe("parseEventSort", () => {
  it("accepts known sorts and falls back to lot number", () => {
    expect(parseEventSort(params("sort=price-asc"))).toBe("price-asc");
    expect(parseEventSort(params("sort=nope"))).toBe("lot");
    expect(parseEventSort(params(""))).toBe("lot");
  });
});

describe("sortLots", () => {
  const lot = (id: string, price: number, end?: number, ext?: number) =>
    ({
      _id: id,
      currentPrice: price,
      auctionEndTime: end,
      extendedEndTime: ext,
    }) as unknown as LotSummary;
  const lots = [lot("a", 300, 30), lot("b", 100, 20, 50), lot("c", 200)];
  const ids = (l: LotSummary[]) => l.map((x) => x._id);

  it("keeps server order for lot number and does not mutate the input", () => {
    expect(ids(sortLots(lots, "lot"))).toEqual(["a", "b", "c"]);
    sortLots(lots, "price-asc");
    expect(ids(lots)).toEqual(["a", "b", "c"]);
  });

  it("sorts by price", () => {
    expect(ids(sortLots(lots, "price-asc"))).toEqual(["b", "c", "a"]);
    expect(ids(sortLots(lots, "price-desc"))).toEqual(["a", "c", "b"]);
  });

  it("sorts by closing time using extensions, with unknown last", () => {
    expect(ids(sortLots(lots, "closing"))).toEqual(["a", "b", "c"]);
  });
});
