import { describe, it, expect } from "vitest";

import {
  DEFAULT_STATUS_FILTER,
  buildYearOptions,
  getDefaultFilters,
  hasActiveFilters,
  isStatusFilterValue,
  mergePreferencesWithUrlFilters,
  normalizeStatusFilter,
  parseUrlFilters,
  toFilterNumberString,
  toPreferenceUpdate,
} from "./filterHelpers";
import type { LocalFilters } from "./filterTypes";

/**
 * Builds a complete filter state for tests.
 *
 * @param overrides - Fields to override on the default filter set.
 * @returns Complete filter values.
 */
const makeFilters = (overrides: Partial<LocalFilters> = {}): LocalFilters => ({
  ...getDefaultFilters(),
  ...overrides,
});

describe("getDefaultFilters", () => {
  it("starts on active auctions with no other filters", () => {
    expect(getDefaultFilters()).toEqual({
      status: "active",
      make: "",
      minYear: "",
      maxYear: "",
      minPrice: "",
      maxPrice: "",
      maxHours: "",
    });
  });

  it("returns a fresh object each call", () => {
    expect(getDefaultFilters()).not.toBe(getDefaultFilters());
  });
});

describe("isStatusFilterValue / normalizeStatusFilter", () => {
  it("accepts only the three known statuses", () => {
    expect(isStatusFilterValue("closed")).toBe(true);
    expect(isStatusFilterValue("all")).toBe(true);
    expect(isStatusFilterValue("ACTIVE")).toBe(false);
  });

  it("falls back to the default status", () => {
    expect(normalizeStatusFilter("all")).toBe("all");
    expect(normalizeStatusFilter("nonsense")).toBe(DEFAULT_STATUS_FILTER);
    expect(normalizeStatusFilter(null)).toBe(DEFAULT_STATUS_FILTER);
    expect(normalizeStatusFilter(undefined)).toBe(DEFAULT_STATUS_FILTER);
  });
});

describe("parseUrlFilters", () => {
  it("normalizes valid params", () => {
    const params = new URLSearchParams({
      status: "closed",
      make: "  John Deere  ",
      minYear: "2018",
      maxPrice: "250000",
    });

    expect(parseUrlFilters(params)).toEqual({
      status: "closed",
      make: "John Deere",
      minYear: "2018",
      maxYear: "",
      minPrice: "",
      maxPrice: "250000",
      maxHours: "",
    });
  });

  it("rejects an unknown status", () => {
    expect(parseUrlFilters(new URLSearchParams("status=bogus")).status).toBe(
      DEFAULT_STATUS_FILTER
    );
  });

  it("discards unparseable numbers and keeps parseInt prefixes", () => {
    const params = new URLSearchParams("minYear=20o4&maxHours=abc");

    // parseInt stops at the first non-digit, so "20o4" yields 20.
    expect(parseUrlFilters(params).minYear).toBe("20");
    expect(parseUrlFilters(params).maxHours).toBe("");
    expect(
      parseUrlFilters(new URLSearchParams("minYear=2018abc")).minYear
    ).toBe("2018");
  });
});

describe("toFilterNumberString", () => {
  it("stringifies finite numbers only", () => {
    expect(toFilterNumberString(2020)).toBe("2020");
    expect(toFilterNumberString(Number.NaN)).toBe("");
    expect(toFilterNumberString(null)).toBe("");
    expect(toFilterNumberString(undefined)).toBe("");
  });
});

describe("mergePreferencesWithUrlFilters", () => {
  it("prefers URL params over saved preferences", () => {
    const merged = mergePreferencesWithUrlFilters(
      makeFilters({ status: "closed", make: "John Deere", minYear: "2020" }),
      {
        defaultStatusFilter: "all",
        defaultMake: "Case IH",
        defaultMinYear: 2015,
        defaultMaxYear: 2025,
      },
      false
    );

    expect(merged).toEqual(
      makeFilters({
        status: "closed",
        make: "John Deere",
        minYear: "2020",
        maxYear: "2025",
      })
    );
  });

  it("applies saved preferences where the URL is empty", () => {
    const merged = mergePreferencesWithUrlFilters(
      getDefaultFilters(),
      {
        defaultStatusFilter: "closed",
        defaultMake: " Case IH ",
        defaultMinPrice: 50000,
        defaultMaxPrice: 500000,
        defaultMaxHours: 3500,
      },
      false
    );

    expect(merged).toEqual(
      makeFilters({
        status: "closed",
        make: "Case IH",
        minPrice: "50000",
        maxPrice: "500000",
        maxHours: "3500",
      })
    );
  });

  it("tolerates null preference values", () => {
    const merged = mergePreferencesWithUrlFilters(
      getDefaultFilters(),
      {
        defaultStatusFilter: null,
        defaultMake: null,
        defaultMinYear: null,
        defaultMaxYear: null,
        defaultMinPrice: null,
        defaultMaxPrice: null,
        defaultMaxHours: null,
      },
      false
    );

    expect(merged).toEqual(getDefaultFilters());
  });

  it("keeps the URL status untouched when status is hidden", () => {
    const merged = mergePreferencesWithUrlFilters(
      getDefaultFilters(),
      { defaultStatusFilter: "closed" },
      true
    );

    expect(merged.status).toBe(DEFAULT_STATUS_FILTER);
  });
});

describe("toPreferenceUpdate", () => {
  it("parses filter strings into the saved numeric fields", () => {
    expect(
      toPreferenceUpdate(
        makeFilters({
          status: "closed",
          make: "  John Deere  ",
          minYear: "2020",
          maxHours: "1000",
        }),
        false
      )
    ).toEqual({
      defaultStatusFilter: "closed",
      defaultMake: "John Deere",
      defaultMinYear: 2020,
      defaultMaxYear: undefined,
      defaultMinPrice: undefined,
      defaultMaxPrice: undefined,
      defaultMaxHours: 1000,
    });
  });

  it("omits the status when it is hidden and drops blank values", () => {
    const update = toPreferenceUpdate(
      makeFilters({ status: "closed", make: "   " }),
      true
    );

    expect(update).not.toHaveProperty("defaultStatusFilter");
    expect(update.defaultMake).toBeUndefined();
  });

  it("drops an unsupported status", () => {
    expect(
      toPreferenceUpdate(makeFilters({ status: "bogus" }), false)
        .defaultStatusFilter
    ).toBeUndefined();
  });

  it("drops a non-numeric year or price", () => {
    const update = toPreferenceUpdate(
      makeFilters({ minYear: "abc", maxPrice: "R5M" }),
      false
    );

    expect(update.defaultMinYear).toBeUndefined();
    expect(update.defaultMaxPrice).toBeUndefined();
  });
});

describe("hasActiveFilters", () => {
  it("is false for the default filters", () => {
    expect(hasActiveFilters(getDefaultFilters())).toBe(false);
  });

  it("is true for a non-default status or any set filter", () => {
    expect(hasActiveFilters(makeFilters({ status: "all" }))).toBe(true);
    expect(hasActiveFilters(makeFilters({ maxHours: "1000" }))).toBe(true);
  });
});

describe("buildYearOptions", () => {
  it("lists years newest first", () => {
    expect(buildYearOptions(3, 2026)).toEqual(["2026", "2025", "2024"]);
  });

  it("defaults to 30 years back from the current year", () => {
    const years = buildYearOptions();

    expect(years).toHaveLength(30);
    expect(years[0]).toBe(new Date().getFullYear().toString());
  });
});
