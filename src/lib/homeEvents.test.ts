import { describe, it, expect } from "vitest";

import {
  eventGridPlan,
  HOME_OPEN_SALES_CAP,
  parseHomeSort,
  parseHomeView,
  selectEvents,
} from "./homeEvents";

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

const event = (
  id: string,
  over: Partial<{
    status: "draft" | "published" | "closed";
    startTime: number;
    endTime: number;
    effectiveEndTime: number;
  }> = {}
) => ({
  id,
  status: "published" as const,
  startTime: NOW - HOUR,
  endTime: NOW + 48 * HOUR,
  effectiveEndTime: NOW + 48 * HOUR,
  ...over,
});

describe("parseHomeView", () => {
  it("accepts the three views", () => {
    expect(parseHomeView("live", null)).toBe("live");
    expect(parseHomeView("soon", null)).toBe("soon");
    expect(parseHomeView("results", null)).toBe("results");
  });

  it("defaults to live for unknown input", () => {
    expect(parseHomeView(null, null)).toBe("live");
    expect(parseHomeView("bogus", "all")).toBe("live");
  });

  it("maps the retired status=closed param to results", () => {
    expect(parseHomeView(null, "closed")).toBe("results");
  });
});

describe("parseHomeSort", () => {
  it("returns newest only when asked", () => {
    expect(parseHomeSort("newest")).toBe("newest");
    expect(parseHomeSort("soonest")).toBe("soonest");
    expect(parseHomeSort("x")).toBe("soonest");
    expect(parseHomeSort(null)).toBe("soonest");
  });
});

describe("selectEvents", () => {
  const live = event("live", { effectiveEndTime: NOW + 30 * HOUR });
  const soon = event("soon", { effectiveEndTime: NOW + 5 * HOUR });
  const upcoming = event("up", {
    startTime: NOW + 10 * HOUR,
    endTime: NOW + 80 * HOUR,
    effectiveEndTime: NOW + 80 * HOUR,
  });
  const ended = event("ended", {
    endTime: NOW - HOUR,
    effectiveEndTime: NOW - HOUR,
  });
  const closed = event("closed", {
    status: "closed",
    effectiveEndTime: NOW - 5 * HOUR,
  });

  it("live view keeps open and upcoming sales, soonest end first", () => {
    const ids = selectEvents(
      [upcoming, live, ended, soon],
      "live",
      "soonest",
      NOW
    ).map((e) => e.id);
    expect(ids).toEqual(["soon", "live", "up"]);
  });

  it("live view can sort newest start first", () => {
    const ids = selectEvents([live, upcoming], "live", "newest", NOW).map(
      (e) => e.id
    );
    expect(ids).toEqual(["up", "live"]);
  });

  it("soon view keeps only open sales closing within 24 hours", () => {
    const ids = selectEvents(
      [live, soon, upcoming],
      "soon",
      "soonest",
      NOW
    ).map((e) => e.id);
    expect(ids).toEqual(["soon"]);
  });

  it("soon view is empty when nothing closes within 24 hours", () => {
    expect(selectEvents([live, upcoming], "soon", "soonest", NOW)).toEqual([]);
  });

  it("results view lists ended sales, most recently closed first", () => {
    const ids = selectEvents(
      [closed, live, ended],
      "results",
      "soonest",
      NOW
    ).map((e) => e.id);
    expect(ids).toEqual(["ended", "closed"]);
  });

  it("does not mutate its input", () => {
    const input = [upcoming, soon];
    selectEvents(input, "live", "soonest", NOW);
    expect(input.map((e) => e.id)).toEqual(["up", "soon"]);
  });
});

describe("eventGridPlan", () => {
  it("features a single event (and treats none the same)", () => {
    const plan = eventGridPlan(1);
    expect(plan.featuredFirst).toBe(true);
    expect(plan.gridClass).not.toContain("md:grid-cols-2");
    expect(eventGridPlan(0)).toEqual(plan);
  });

  it("uses two columns for 2 events and a 2x2 grid for 4", () => {
    for (const n of [2, 4]) {
      const plan = eventGridPlan(n);
      expect(plan.gridClass).toContain("md:grid-cols-2");
      expect(plan.gridClass).not.toContain("lg:grid-cols-3");
      expect(plan.firstClass).toBe("");
      expect(plan.featuredFirst).toBe(false);
    }
  });

  it("uses three columns for 3 events and for 5 or more", () => {
    for (const n of [3, 5, 6, 7, 12, 36]) {
      const plan = eventGridPlan(n);
      expect(plan.gridClass).toContain("lg:grid-cols-3");
      expect(plan.featuredFirst).toBe(false);
    }
  });

  it("spans the first card across the tablet row when the count is odd", () => {
    for (const n of [3, 5, 7, 9]) {
      expect(eventGridPlan(n).firstClass).toBe("md:col-span-2 lg:col-span-1");
    }
    for (const n of [6, 8, 12]) {
      expect(eventGridPlan(n).firstClass).toBe("");
    }
  });

  it("caps the open sales Home loads at 3 pages of 12", () => {
    expect(HOME_OPEN_SALES_CAP).toBe(36);
  });
});
