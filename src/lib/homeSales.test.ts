import { describe, it, expect } from "vitest";

import { pickHomeSales, telLink, whatsappLink } from "./homeSales";

const NOW = 1_000_000;
const sale = (
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
  startTime: NOW - 10,
  endTime: NOW + 100,
  effectiveEndTime: NOW + 100,
  ...over,
});

describe("pickHomeSales", () => {
  it("returns none when nothing is open", () => {
    const result = pickHomeSales(
      [sale("a", { endTime: NOW - 1, effectiveEndTime: NOW - 1 })],
      NOW
    );
    expect(result).toEqual({ hero: null, open: [], mode: "none" });
  });

  it("is single mode with one live sale as the hero", () => {
    const result = pickHomeSales([sale("a")], NOW);
    expect(result.mode).toBe("single");
    expect(result.hero?.id).toBe("a");
    expect(result.hero?.bucket).toBe("live");
  });

  it("is multi mode, live sales first by close, then upcoming by opening", () => {
    const result = pickHomeSales(
      [
        sale("later-upcoming", {
          startTime: NOW + 500,
          endTime: NOW + 900,
          effectiveEndTime: NOW + 900,
        }),
        sale("live-late", { effectiveEndTime: NOW + 300 }),
        sale("soon-upcoming", {
          startTime: NOW + 200,
          endTime: NOW + 900,
          effectiveEndTime: NOW + 900,
        }),
        sale("live-soon", { effectiveEndTime: NOW + 50 }),
        sale("ended", { endTime: NOW - 1, effectiveEndTime: NOW - 1 }),
        sale("draft", { status: "draft" }),
      ],
      NOW
    );
    expect(result.mode).toBe("multi");
    expect(result.open.map((s) => s.id)).toEqual([
      "live-soon",
      "live-late",
      "soon-upcoming",
      "later-upcoming",
    ]);
    expect(result.hero?.id).toBe("live-soon");
  });

  it("uses the next upcoming sale as the hero when none is live", () => {
    const result = pickHomeSales(
      [
        sale("up", {
          startTime: NOW + 10,
          endTime: NOW + 90,
          effectiveEndTime: NOW + 90,
        }),
      ],
      NOW
    );
    expect(result.hero?.bucket).toBe("upcoming");
  });
});

describe("whatsappLink / telLink", () => {
  it("keeps digits only for wa.me", () => {
    expect(whatsappLink("+27 83 700 0000")).toBe("https://wa.me/27837000000");
  });
  it("returns undefined for empty input", () => {
    expect(whatsappLink("")).toBeUndefined();
    expect(whatsappLink(null)).toBeUndefined();
    expect(telLink(undefined)).toBeUndefined();
  });
  it("builds a tel link", () => {
    expect(telLink("083 7 000 000")).toBe("tel:0837000000");
  });
});
