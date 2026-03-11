import { describe, it, expect } from "vitest";

import {
  AUCTION_STATUS_BADGE_VARIANTS,
  FLAG_REASON_BADGE_VARIANTS,
  isEditableStatus,
  getAuctionStatusLabel,
} from "./auction-badges";

describe("AUCTION_STATUS_BADGE_VARIANTS", () => {
  it("maps draft to secondary", () => {
    expect(AUCTION_STATUS_BADGE_VARIANTS.draft).toBe("secondary");
  });

  it("maps active to default", () => {
    expect(AUCTION_STATUS_BADGE_VARIANTS.active).toBe("default");
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
