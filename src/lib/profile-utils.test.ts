import { describe, it, expect } from "vitest";

import {
  formatPrice,
  formatMemberSince,
  getInitials,
  formatActivityDate,
  getTrustItems,
  ACTIVITY_META,
} from "./profile-utils";

describe("profile-utils", () => {
  describe("formatPrice", () => {
    it("returns em dash for undefined price", () => {
      expect(formatPrice(undefined)).toBe("—");
    });

    it("formats a number as currency", () => {
      const result = formatPrice(485000);
      expect(result).toContain("R");
      expect(result).toContain("485");
    });
  });

  describe("formatMemberSince", () => {
    it("returns empty string for undefined timestamp", () => {
      expect(formatMemberSince(undefined)).toBe("");
    });

    it("formats timestamp as month and year", () => {
      const timestamp = new Date("2026-01-15").getTime();
      const result = formatMemberSince(timestamp);
      expect(result).toContain("January");
      expect(result).toContain("2026");
    });
  });

  describe("getInitials", () => {
    it("returns ?? for undefined name", () => {
      expect(getInitials(undefined)).toBe("??");
    });

    it("returns ?? for empty string", () => {
      expect(getInitials("")).toBe("??");
    });

    it("returns first two characters for single-word name", () => {
      expect(getInitials("Bob")).toBe("BO");
    });

    it("returns first and last initials for two-word name", () => {
      expect(getInitials("John Dippenaar")).toBe("JD");
    });

    it("returns first and last initials for multi-word name", () => {
      expect(getInitials("John Michael Dippenaar")).toBe("JD");
    });
  });

  describe("formatActivityDate", () => {
    it("returns Unknown for undefined timestamp", () => {
      expect(formatActivityDate(undefined)).toBe("Unknown");
    });

    it("formats timestamp as abbreviated month and year", () => {
      const timestamp = new Date("2026-02-10").getTime();
      const result = formatActivityDate(timestamp);
      expect(result).toBe("Feb 2026");
    });
  });

  describe("getTrustItems", () => {
    it("returns correct items for verified user", () => {
      const items = getTrustItems(
        true,
        "verified",
        {},
        { avgRating: 4.5, reviewCount: 2 }
      );
      const identity = items.find((i) => i.id === "identity");
      expect(identity?.verified).toBe(true);
      expect(identity?.value).toBe("Verified");
    });

    it("returns pending for unverified user", () => {
      const items = getTrustItems(
        false,
        undefined,
        {},
        { avgRating: undefined, reviewCount: 0 }
      );
      const identity = items.find((i) => i.id === "identity");
      expect(identity?.verified).toBe(false);
      expect(identity?.value).toBe("Pending");
    });

    it("returns banking verified status", () => {
      const items = getTrustItems(
        false,
        undefined,
        { bankingVerified: true },
        { reviewCount: 0 }
      );
      const banking = items.find((i) => i.id === "banking");
      expect(banking?.verified).toBe(true);
      expect(banking?.value).toBe("Linked");
    });

    it("returns correct seller rating with average and count", () => {
      const items = getTrustItems(
        true,
        "verified",
        {},
        { avgRating: 4.5, reviewCount: 2 }
      );
      const rating = items.find((i) => i.id === "rating");
      expect(rating?.value).toBe("4.5 (2)");
      expect(rating?.verified).toBe(true);
    });

    it("returns no reviews for zero review count", () => {
      const items = getTrustItems(
        true,
        "verified",
        {},
        { avgRating: undefined, reviewCount: 0 }
      );
      const rating = items.find((i) => i.id === "rating");
      expect(rating?.value).toBe("No reviews");
      expect(rating?.verified).toBe(false);
    });
  });

  describe("ACTIVITY_META", () => {
    it("contains all activity types", () => {
      const types = Object.keys(ACTIVITY_META);
      expect(types).toContain("account_created");
      expect(types).toContain("verification_requested");
      expect(types).toContain("verification_approved");
      expect(types).toContain("verification_rejected");
      expect(types).toContain("role_changed");
      expect(types).toContain("listing_created");
      expect(types).toContain("listing_sold");
      expect(types).toContain("bid_placed");
      expect(types).toContain("bid_won");
    });

    it("has required properties for each type", () => {
      for (const [, meta] of Object.entries(ACTIVITY_META)) {
        expect(meta).toHaveProperty("icon");
        expect(meta).toHaveProperty("bgClass");
        expect(meta).toHaveProperty("iconColor");
        expect(meta).toHaveProperty("title");
        expect(typeof meta.title).toBe("string");
      }
    });
  });
});
