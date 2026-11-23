import { describe, it, expect } from "vitest";

import {
  AUCTION_STATUS_BADGE_VARIANTS,
  FLAG_REASON_BADGE_VARIANTS,
  isEditableStatus,
  getAuctionStatusLabel,
  deriveDisplayStatus,
} from "./auction-badges";

describe("AUCTION_STATUS_BADGE_VARIANTS", () => {
  it("maps draft to secondary", () => {
    expect(AUCTION_STATUS_BADGE_VARIANTS.draft).toBe("secondary");
  });

  it("maps approved to default", () => {
    expect(AUCTION_STATUS_BADGE_VARIANTS.approved).toBe("default");
  });

  it("maps assigned to default", () => {
    expect(AUCTION_STATUS_BADGE_VARIANTS.assigned).toBe("default");
  });

  it("maps sold to default", () => {
    expect(AUCTION_STATUS_BADGE_VARIANTS.sold).toBe("default");
  });

  it("maps unsold to destructive", () => {
    expect(AUCTION_STATUS_BADGE_VARIANTS.unsold).toBe("destructive");
  });
});

describe("FLAG_REASON_BADGE_VARIANTS", () => {
  it("maps misleading to destructive", () => {
    expect(FLAG_REASON_BADGE_VARIANTS.misleading).toBe("destructive");
  });

  it("maps inappropriate to secondary", () => {
    expect(FLAG_REASON_BADGE_VARIANTS.inappropriate).toBe("secondary");
  });
});

describe("isEditableStatus", () => {
  it("returns true for draft", () => {
    expect(isEditableStatus("draft")).toBe(true);
  });

  it("returns true for pending_review", () => {
    expect(isEditableStatus("pending_review")).toBe(true);
  });

  it("returns false for active", () => {
    expect(isEditableStatus("active")).toBe(false);
  });

  it("returns false for sold", () => {
    expect(isEditableStatus("sold")).toBe(false);
  });

  it("returns false for unknown status", () => {
    expect(isEditableStatus("unknown")).toBe(false);
  });
});

describe("getAuctionStatusLabel", () => {
  it("replaces underscores with spaces", () => {
    expect(getAuctionStatusLabel("pending_review")).toBe("pending review");
  });

  it("handles status without underscores", () => {
    expect(getAuctionStatusLabel("active")).toBe("active");
  });

  it("handles multiple underscores", () => {
    expect(getAuctionStatusLabel("pending_review_again")).toBe(
      "pending review again"
    );
  });
});

describe("deriveDisplayStatus", () => {
  const now = Date.UTC(2026, 10, 21, 10, 0);
  const H = 3_600_000;
  const TEN_MIN = 600_000;

  it("outcome wins over time", () => {
    expect(
      deriveDisplayStatus({ now, endTime: now + H, outcome: "sold" })
    ).toEqual({ kind: "sold" });
    expect(deriveDisplayStatus({ now, outcome: "passed" })).toEqual({
      kind: "passed",
    });
  });

  it("reports a lot under consideration from its outcome", () => {
    expect(
      deriveDisplayStatus({ now, outcome: "under-consideration" })
    ).toEqual({ kind: "under-consideration" });
  });

  it("is opens before the start time", () => {
    expect(
      deriveDisplayStatus({ now, startTime: now + 1, endTime: now + 5 * H })
    ).toEqual({ kind: "opens", startTime: now + 1 });
  });

  it("is passed once ended without an outcome", () => {
    expect(deriveDisplayStatus({ now, endTime: now })).toEqual({
      kind: "passed",
    });
  });

  it("is closing soon under 24h and urgent under 10 minutes", () => {
    expect(deriveDisplayStatus({ now, endTime: now + 24 * H - 1 })).toEqual({
      kind: "closing-soon",
      urgent: false,
    });
    expect(deriveDisplayStatus({ now, endTime: now + TEN_MIN - 1 })).toEqual({
      kind: "closing-soon",
      urgent: true,
    });
    expect(deriveDisplayStatus({ now, endTime: now + TEN_MIN })).toEqual({
      kind: "closing-soon",
      urgent: false,
    });
  });

  it("is live otherwise, including with no end time", () => {
    expect(
      deriveDisplayStatus({ now, startTime: now - H, endTime: now + 24 * H })
    ).toEqual({ kind: "live" });
    expect(deriveDisplayStatus({ now })).toEqual({ kind: "live" });
  });
});
