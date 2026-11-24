// @vitest-environment node
import { describe, expect, it } from "vitest";

import { formatSastDate } from "../../src/lib/dates";
import { formatRand } from "../../src/lib/currency";
import {
  buildHomeMeta,
  buildLotMeta,
  buildSaleMeta,
  lotShareState,
  type HomeShareData,
  type LotShareData,
  type SaleShareData,
} from "./shareMeta";

const ORIGIN = "https://agribid.test";
const NOW = Date.UTC(2026, 10, 24, 8, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const CLOSE = NOW + DAY;

const LOT: LotShareData = {
  id: "lot12345678901234567890",
  make: "New Holland",
  model: "T6070",
  title: "T6070",
  lotNumber: 3,
  status: "assigned",
  startingPrice: 400_000,
  currentPrice: 414_000,
  bidCount: 2,
  place: "Malmesbury, Western Cape",
  auctionStartTime: NOW - HOUR,
  closeTime: CLOSE,
};

const SALE: SaleShareData = {
  id: "sale1234567890123456789",
  title: "Year End Commercial & Agricultural Auction",
  status: "published",
  startTime: NOW - HOUR,
  effectiveEndTime: CLOSE,
  lotCount: 85,
  imageUrls: [],
};

const HOME: HomeShareData = {
  title: "Year End Auction",
  phase: "live",
  startTime: NOW - HOUR,
  effectiveEndTime: CLOSE,
  lotCount: 85,
};

const D = formatSastDate(CLOSE);

/**
 * Builds lot meta with overrides.
 *
 * @param over - Lot overrides
 * @returns The meta
 */
function lotMeta(over: Partial<LotShareData>) {
  return buildLotMeta({ ...LOT, ...over }, "/auction/x", NOW, ORIGIN);
}

describe("buildLotMeta", () => {
  it("shows the current bid", () => {
    const m = lotMeta({});
    expect(m.title).toBe("New Holland T6070 · Lot 3 · AgriBid");
    expect(m.description).toBe(
      `Current bid ${formatRand(414_000)} · Closes ${D} · Malmesbury, Western Cape`
    );
    expect(m.url).toBe(`${ORIGIN}/auction/x`);
    expect(m.imageAlt).toBe(
      `New Holland T6070: Current bid ${formatRand(414_000)}`
    );
  });

  it("shows the opening bid when there are no bids", () => {
    const m = lotMeta({ bidCount: 0, currentPrice: 400_000 });
    expect(m.description).toContain(`Opening bid ${formatRand(400_000)}`);
    expect(m.description).toContain(`Closes ${D}`);
  });

  it("shows an upcoming lot", () => {
    const start = NOW + DAY;
    const m = lotMeta({ auctionStartTime: start, closeTime: start + DAY });
    expect(m.description).toBe(
      `Opening bid ${formatRand(400_000)} · Opens ${formatSastDate(start)} · Malmesbury, Western Cape`
    );
  });

  it("shows a sold lot", () => {
    const m = lotMeta({ status: "sold", closeTime: NOW - HOUR });
    expect(m.description).toBe(
      `Sold for ${formatRand(414_000)} · Closed ${formatSastDate(NOW - HOUR)} · Malmesbury, Western Cape`
    );
  });

  it.each([
    ["unsold", { status: "unsold" as const }],
    ["under consideration", { status: "under_consideration" as const }],
    ["past close", { closeTime: NOW - HOUR }],
  ])("shows bidding closed when %s", (_name, over) => {
    const m = lotMeta(over);
    expect(m.description).toMatch(/^Bidding closed · Closed /);
    expect(m.description).not.toContain("R ");
  });

  it("drops the lot number and the place when missing", () => {
    const m = lotMeta({ lotNumber: undefined, place: "" });
    expect(m.title).toBe("New Holland T6070 · AgriBid");
    expect(m.description).toBe(
      `Current bid ${formatRand(414_000)} · Closes ${D}`
    );
  });

  it("falls back to the home tags on the lot path for a null lot", () => {
    const m = buildLotMeta(null, "/auction/gone", NOW, ORIGIN);
    expect(m.title).toBe("AgriBid · Farm equipment auctions");
    expect(m.url).toBe(`${ORIGIN}/auction/gone`);
    expect(m.imageUrl).toContain("kind=home");
  });

  it("changes the image key when the price changes", () => {
    const a = lotMeta({}).imageUrl;
    const b = lotMeta({ currentPrice: 420_000 }).imageUrl;
    expect(a).not.toBe(b);
    expect(a).toMatch(
      /^https:\/\/agribid\.test\/api\/og\?kind=lot&id=lot\w+&v=/
    );
  });

  it("works out the state", () => {
    expect(lotShareState(LOT, NOW)).toBe("current");
    expect(lotShareState({ ...LOT, closeTime: undefined }, NOW)).toBe(
      "current"
    );
  });
});

describe("buildSaleMeta", () => {
  it("describes a live sale", () => {
    const m = buildSaleMeta(SALE, "/auctions/x", NOW, ORIGIN);
    expect(m.title).toBe(SALE.title);
    expect(m.description).toBe(`85 lots · Closes ${D} · Online`);
    expect(m.imageUrl).toContain("kind=sale");
  });

  it("describes an upcoming sale", () => {
    const start = NOW + DAY;
    const m = buildSaleMeta(
      { ...SALE, startTime: start, effectiveEndTime: start + DAY },
      "/auctions/x",
      NOW,
      ORIGIN
    );
    expect(m.description).toBe(
      `85 lots · Opens ${formatSastDate(start)} · Online`
    );
  });

  it("describes a closed sale", () => {
    const end = NOW - DAY;
    const m = buildSaleMeta(
      { ...SALE, status: "closed", effectiveEndTime: end, soldCount: 71 },
      "/auctions/x",
      NOW,
      ORIGIN
    );
    expect(m.description).toBe(
      `85 lots · Closed ${formatSastDate(end).split(",")[0]} · 71 sold`
    );
  });

  it("falls back to the home tags for a null sale", () => {
    const m = buildSaleMeta(null, "/auctions/gone", NOW, ORIGIN);
    expect(m.url).toBe(`${ORIGIN}/auctions/gone`);
    expect(m.title).toBe("AgriBid · Farm equipment auctions");
  });
});

describe("buildHomeMeta", () => {
  it("describes a live sale", () => {
    const m = buildHomeMeta(HOME, "/", NOW, ORIGIN);
    expect(m.title).toBe("AgriBid · Farm equipment auctions");
    expect(m.description).toBe(
      `Year End Auction is live · 85 lots · Closes ${D}`
    );
  });

  it("describes the next sale", () => {
    const start = NOW + DAY;
    const m = buildHomeMeta(
      { ...HOME, phase: "upcoming", startTime: start },
      "/sell",
      NOW,
      ORIGIN
    );
    expect(m.description).toBe(
      `Next sale: Year End Auction · Opens ${formatSastDate(start)}`
    );
    expect(m.url).toBe(`${ORIGIN}/sell`);
  });

  it("has a plain description with no sale", () => {
    const m = buildHomeMeta(null, "/", NOW, ORIGIN);
    expect(m.description).toBe(
      "Online farm equipment auctions in South Africa"
    );
  });
});

describe("all builders", () => {
  it("emit absolute URLs and no tagline", () => {
    const all = [
      lotMeta({}),
      buildLotMeta(null, "/auction/x", NOW, ORIGIN),
      buildSaleMeta(SALE, "/auctions/x", NOW, ORIGIN),
      buildHomeMeta(HOME, "/", NOW, ORIGIN),
      buildHomeMeta(null, "/", NOW, ORIGIN),
    ];
    for (const m of all) {
      expect(m.url).toMatch(/^https:\/\//);
      expect(m.imageUrl).toMatch(/^https:\/\//);
      expect(JSON.stringify(m)).not.toMatch(/built for farmers/i);
    }
  });
});
