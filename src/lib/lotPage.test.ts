import { describe, expect, it } from "vitest";

import {
  buildSlides,
  classifyBidError,
  confirmBreakdown,
  formatBidTime,
  isInExtension,
  lotKeyFacts,
  lotPlace,
  meterPhotoIndex,
  nextMinimumBid,
  premiumPct,
  quickBidAmounts,
  stickyModel,
  viewerState,
} from "./lotPage";

describe("lotKeyFacts", () => {
  it("joins every known fact", () => {
    expect(
      lotKeyFacts({
        year: 2016,
        operatingHours: 4850,
        drive: "4wd",
        powerKw: 104,
        location: "Malmesbury",
        province: "Western Cape",
      })
    ).toBe("2016 · 4 850 hrs · 4WD · 104 kW · Malmesbury, Western Cape");
  });

  it("omits unknown values and handles every drive", () => {
    expect(lotKeyFacts({ year: 2010, location: "Cradock" })).toBe(
      "2010 · Cradock"
    );
    expect(lotKeyFacts({ drive: "2wd" })).toBe("2WD");
    expect(lotKeyFacts({ drive: "tracks", operatingHours: 0 })).toBe("Tracks");
    expect(lotKeyFacts({})).toBe("");
    expect(lotKeyFacts({ location: " ", province: "Free State" })).toBe(
      "Free State"
    );
  });
});

describe("nextMinimumBid and quick amounts", () => {
  it("accepts the opening price for the first bid", () => {
    expect(
      nextMinimumBid({ currentPrice: 400000, minIncrement: 3500, bidCount: 0 })
    ).toBe(400000);
  });

  it("adds one increment once there are bids", () => {
    expect(
      nextMinimumBid({ currentPrice: 410500, minIncrement: 3500, bidCount: 4 })
    ).toBe(414000);
  });

  it("offers the minimum, +1 step and +2 steps", () => {
    expect(quickBidAmounts(400000, 3500)).toEqual([400000, 403500, 407000]);
  });
});

describe("buildSlides and meterPhotoIndex", () => {
  const photos = [
    { url: "a", angle: "front" as const },
    { url: "b", angle: "hour_meter" as const },
    { url: "c" },
  ];

  it("puts the cold-start video first with its caption", () => {
    const slides = buildSlides(photos, "v.mp4");
    expect(slides[0]).toEqual({
      kind: "video",
      url: "v.mp4",
      caption: "Cold-start video",
    });
    expect(slides.map((s) => s.caption)).toEqual([
      "Cold-start video",
      "Front",
      "Hour meter",
      undefined,
    ]);
  });

  it("has no video slide when there is none", () => {
    expect(buildSlides(photos).every((s) => s.kind === "photo")).toBe(true);
  });

  it("finds the hour-meter photo, after the video", () => {
    expect(meterPhotoIndex(buildSlides(photos, "v.mp4"))).toBe(2);
    expect(meterPhotoIndex(buildSlides([{ url: "x" }]))).toBe(-1);
  });
});

describe("confirmBreakdown", () => {
  it("adds fixed buyer fees before VAT, as their own row", () => {
    const result = confirmBreakdown({
      bid: 100_000,
      premiumFraction: 0.1,
      fixedFees: 500,
      vatRatePct: 15,
      seller: "vat",
    });
    expect(result.rows.map((r) => r.label)).toContain("Other buyer fees");
    expect(
      result.rows.find((r) => r.label === "Other buyer fees")?.amount
    ).toBe(500);
    // (100 000 + 10 000 + 500) * 1.15
    expect(result.total).toBe(127_075);
  });

  it("VAT seller: VAT on bid plus premium (R 400 000 -> R 515 200)", () => {
    const result = confirmBreakdown({
      bid: 400000,
      premiumFraction: 0.12,
      vatRatePct: 15,
      seller: "vat",
    });
    expect(result.rows).toEqual([
      { label: "Your bid", amount: 400000 },
      { label: "Buyer's premium 12%", amount: 48000 },
      { label: "VAT 15%", amount: 67200 },
    ]);
    expect(result.total).toBe(515200);
  });

  it("private seller: VAT on the premium only (R 400 000 -> R 455 200)", () => {
    const result = confirmBreakdown({
      bid: 400000,
      premiumFraction: 0.12,
      vatRatePct: 15,
      seller: "private",
    });
    expect(result.rows[2]).toEqual({
      label: "VAT 15% on the premium",
      amount: 7200,
    });
    expect(result.total).toBe(455200);
  });

  it("matches the mockup's R 417 500 confirm sheet", () => {
    const result = confirmBreakdown({
      bid: 417500,
      premiumFraction: 0.12,
      vatRatePct: 15,
      seller: "vat",
    });
    expect(result.rows.map((r) => r.amount)).toEqual([417500, 50100, 70140]);
    expect(result.total).toBe(537740);
  });

  it("follows the lot's own premium and an admin VAT rate", () => {
    const result = confirmBreakdown({
      bid: 100000,
      premiumFraction: 0.05,
      vatRatePct: 10,
      seller: "any",
    });
    expect(result.rows[1].label).toBe("Buyer's premium 5%");
    expect(result.rows[2].label).toBe("VAT 10%");
    expect(result.total).toBe(115500);
  });

  it("shows fractional premiums without float noise", () => {
    expect(premiumPct(0.125)).toBe(12.5);
    expect(premiumPct(0.07)).toBe(7);
  });
});

describe("classifyBidError", () => {
  it("is outbid when someone raised past the minimum the user saw", () => {
    const error = classifyBidError(
      "Bid amount must be at least R417500",
      414000,
      414000
    );
    expect(error.kind).toBe("outbid");
    expect(error.minimum).toBe(417500);
    expect(error.message).toContain("Someone bid before you");
  });

  it("is below the minimum when the bid was under what the user saw", () => {
    const error = classifyBidError(
      "Bid amount must be at least R414000",
      400000,
      414000
    );
    expect(error.kind).toBe("below-minimum");
    expect(error.message).toContain("minimum bid");
  });

  it("reads the first-bid message too", () => {
    expect(
      classifyBidError("First bid must be at least R1000", 500, 1000).kind
    ).toBe("below-minimum");
  });

  it("recognises a closed or unopened sale", () => {
    expect(classifyBidError("Auction ended", 1, 1).message).toContain("closed");
    expect(classifyBidError("Auction has not started", 1, 1).message).toContain(
      "hasn't opened"
    );
    expect(classifyBidError("Auction not active", 1, 1).kind).toBe("closed");
    expect(
      classifyBidError("Lot is not assigned to an auction", 1, 1).kind
    ).toBe("closed");
  });

  it("recognises an unverified account", () => {
    expect(
      classifyBidError(
        "Account verification required. Please complete KYC verification.",
        1,
        1
      ).kind
    ).toBe("unverified");
  });

  it("passes a cooldown message through and falls back for the rest", () => {
    const cooldown = classifyBidError("You're bidding too fast. Wait.", 1, 1);
    expect(cooldown.kind).toBe("cooldown");
    expect(cooldown.message).toBe("You're bidding too fast. Wait.");
    expect(classifyBidError("boom", 1, 1)).toEqual({
      kind: "other",
      message: "boom",
    });
    expect(classifyBidError("", 1, 1).message).toBe("Couldn't place your bid.");
  });
});

describe("viewerState", () => {
  it("maps sign-in and the server answer", () => {
    expect(viewerState(false, "leading")).toBe("guest");
    expect(viewerState(true, undefined)).toBe("registered");
    expect(viewerState(true, "none")).toBe("registered");
    expect(viewerState(true, "leading")).toBe("leading");
    expect(viewerState(true, "outbid")).toBe("outbid");
  });
});

describe("stickyModel", () => {
  const HOUR = 3_600_000;

  it("shows price and time on line 1, the opening bid on line 2", () => {
    expect(
      stickyModel({
        price: 400000,
        remainingMs: 51 * HOUR,
        hasBids: false,
        viewer: "guest",
      })
    ).toEqual({
      title: expect.stringMatching(/^R\s400\s000 · 2d 3h$/),
      sub: "Opening bid",
      subTone: "default",
      urgent: false,
    });
  });

  it("says Current bid once there are bids", () => {
    expect(
      stickyModel({
        price: 1,
        remainingMs: HOUR,
        hasBids: true,
        viewer: "registered",
      }).sub
    ).toBe("Current bid");
  });

  it("colours leading green and outbid amber", () => {
    const base = { price: 1, remainingMs: 5 * HOUR, hasBids: true };
    expect(stickyModel({ ...base, viewer: "leading" })).toMatchObject({
      sub: "You're leading",
      subTone: "ok",
    });
    expect(stickyModel({ ...base, viewer: "outbid" })).toMatchObject({
      sub: "Outbid",
      subTone: "warn",
    });
  });

  it("leads with a red countdown under 10 minutes", () => {
    const model = stickyModel({
      price: 428000,
      remainingMs: 112_000,
      hasBids: true,
      viewer: "outbid",
    });
    expect(model.urgent).toBe(true);
    expect(model.title).toBe("1m 52s left");
    expect(model.sub).toMatch(/^R\s428\s000 · Outbid$/);
  });

  it("shows only the price once time has run out", () => {
    expect(
      stickyModel({
        price: 5,
        remainingMs: 0,
        hasBids: false,
        viewer: "guest",
      }).title
    ).toMatch(/^R\s5$/);
  });
});

describe("isInExtension", () => {
  it("is true only for an extended lot that is still open", () => {
    expect(isInExtension({ isExtended: true, extendedEndTime: 200 }, 100)).toBe(
      true
    );
    expect(isInExtension({ isExtended: true, extendedEndTime: 50 }, 100)).toBe(
      false
    );
    expect(
      isInExtension({ isExtended: false, extendedEndTime: 200 }, 100)
    ).toBe(false);
    expect(isInExtension({ isExtended: true }, 100)).toBe(false);
  });
});

describe("formatBidTime", () => {
  const now = Date.UTC(2026, 10, 25, 9, 0);

  it("reads recent bids as relative times", () => {
    expect(formatBidTime(now - 20_000, now)).toBe("just now");
    expect(formatBidTime(now - 3 * 60_000, now)).toBe("3 min ago");
    expect(formatBidTime(now - 90 * 60_000, now)).toBe("1 h ago");
  });

  it("falls back to the date after a day", () => {
    expect(formatBidTime(now - 25 * 3_600_000, now)).toMatch(/Tue 24 Nov/);
  });
});

describe("lotPlace", () => {
  it("joins town and province and drops a trailing country", () => {
    expect(lotPlace("Malmesbury, ZA", "Western Cape")).toBe(
      "Malmesbury, Western Cape"
    );
    expect(lotPlace("Cradock, South Africa")).toBe("Cradock");
    expect(lotPlace(undefined, "Gauteng")).toBe("Gauteng");
    expect(lotPlace(null, null)).toBe("");
  });
});
