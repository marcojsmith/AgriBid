import { describe, it, expect } from "vitest";

import {
  eventGridPlan,
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
  it("gives a single event the full width, photos beside details", () => {
    const plan = eventGridPlan(1);
    expect(plan.firstClass).toContain("lg:grid-cols-[2fr_3fr]");
    expect(plan.gridClass).not.toContain("lg:grid-cols-3");
    expect(eventGridPlan(0).firstClass).toBe(plan.firstClass);
  });

  it("shares two columns between two events", () => {
    const plan = eventGridPlan(2);
    expect(plan.gridClass).toContain("md:grid-cols-2");
    expect(plan.gridClass).not.toContain("lg:grid-cols-3");
    expect(plan.firstClass).toBe("");
  });

  it("uses plain thirds for 6 and 9 events", () => {
    for (const n of [6, 12]) {
      const plan = eventGridPlan(n);
      expect(plan.gridClass).toContain("lg:grid-cols-3");
      expect(plan.firstClass).toBe("");
    }
  });

  it("spans the odd tablet row for 3 and 9 events and resets it on desktop", () => {
    expect(eventGridPlan(3).firstClass).toBe("md:col-span-2 lg:col-span-1");
    expect(eventGridPlan(9).firstClass).toBe("md:col-span-2 lg:col-span-1");
  });

  it("makes the first of 4 events full width on desktop", () => {
    const { firstClass } = eventGridPlan(4);
    expect(firstClass).toContain("lg:col-span-3");
    expect(firstClass).not.toContain("md:col-span-2");
    expect(firstClass).toContain("lg:grid-cols-[2fr_3fr]");
  });

  it("makes the first of 5 events double width on desktop and full on tablet", () => {
    const { firstClass } = eventGridPlan(5);
    expect(firstClass).toContain("md:col-span-2");
    expect(firstClass).toContain("lg:col-span-2");
    expect(firstClass).toContain("lg:grid-cols-[3fr_2fr]");
  });

  it("covers 7 (odd, one over a multiple of three) and 8", () => {
    expect(eventGridPlan(7).firstClass).toContain(
      "md:col-span-2 lg:col-span-3"
    );
    expect(eventGridPlan(8).firstClass).toBe(
      "lg:col-span-2 lg:grid lg:grid-cols-[3fr_2fr]"
    );
  });
});
