import { describe, expect, it } from "vitest";

import { closedSummary, SORT_OPTIONS } from "./eventPage";

const SPACES = /[\u202f\u00a0]/g;
const plain = (text: string) => text.replace(SPACES, " ");

describe("closedSummary", () => {
  it("leaves out the total when nothing sold", () => {
    expect(
      closedSummary({
        sold: 0,
        total: 1,
        soldTotal: 0,
        underConsideration: 0,
      })
    ).toBe("0 of 1 lot sold");
  });

  it("words the totals", () => {
    expect(
      plain(
        closedSummary({
          sold: 5,
          total: 6,
          soldTotal: 982_000,
          underConsideration: 0,
        })
      )
    ).toBe("5 of 6 lots sold · R 982 000");
    expect(
      plain(
        closedSummary({
          sold: 4,
          total: 6,
          soldTotal: 841_000,
          underConsideration: 1,
        })
      )
    ).toBe("4 of 6 lots sold · R 841 000 · 1 under consideration");
  });
});

describe("SORT_OPTIONS", () => {
  it("lists lot number first, the default", () => {
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual([
      "lot_number",
      "price_asc",
      "most_watched",
    ]);
  });
});
