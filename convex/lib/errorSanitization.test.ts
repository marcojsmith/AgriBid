import { describe, it, expect } from "vitest";

import {
  truncate,
  sanitizeText,
  sanitizeAdditionalInfo,
  sanitizeBreadcrumbMetadata,
} from "./errorSanitization";

describe("errorSanitization", () => {
  describe("truncate", () => {
    it("returns string unchanged if within limit", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("truncates and adds ellipsis if over limit", () => {
      expect(truncate("hello world", 8)).toBe("hello...");
    });

    it("handles exact length", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });
  });

  describe("sanitizeText", () => {
    it("redacts email addresses", () => {
      expect(sanitizeText("failed for user@example.com during signup")).toBe(
        "failed for [redacted-email] during signup"
      );
    });

    it("redacts JWT tokens", () => {
      const jwt = ["a".repeat(25), "b".repeat(25), "c".repeat(25)].join(".");
      expect(sanitizeText(`auth error: ${jwt}`)).toBe(
        "auth error: [redacted-token]"
      );
    });

    it("redacts sk_live API keys", () => {
      const key = `sk_live_${"a".repeat(25)}`;
      expect(sanitizeText(`stripe error ${key}`)).toBe(
        "stripe error [redacted-token]"
      );
    });

    it("redacts Bearer tokens", () => {
      const token = "a".repeat(25);
      expect(sanitizeText(`Bearer ${token}`)).toBe("[redacted-token]");
    });

    it("redacts card numbers", () => {
      expect(sanitizeText("payment failed for 4111 1111 1111 1111")).toBe(
        "payment failed for [redacted-card]"
      );
      expect(sanitizeText("payment failed for 4111-1111-1111-1111")).toBe(
        "payment failed for [redacted-card]"
      );
    });

    it("leaves clean text unchanged", () => {
      const clean =
        "Cannot read properties of undefined (reading 'foo') at Object.<anonymous> (/app/src/test.ts:10:15)";
      expect(sanitizeText(clean)).toBe(clean);
    });
  });

  describe("sanitizeAdditionalInfo", () => {
    it("sanitizes string values and passes numbers through", () => {
      expect(
        sanitizeAdditionalInfo({
          note: "retry for user@example.com",
          attemptCount: 3,
        })
      ).toEqual({
        note: "retry for [redacted-email]",
        attemptCount: 3,
      });
    });

    it("returns undefined as-is", () => {
      expect(sanitizeAdditionalInfo(undefined)).toBeUndefined();
    });
  });

  describe("sanitizeBreadcrumbMetadata", () => {
    it("returns breadcrumb unchanged if no metadata", () => {
      const breadcrumb = {
        timestamp: 123,
        type: "click",
        description: "clicked button",
      };
      expect(sanitizeBreadcrumbMetadata(breadcrumb)).toEqual(breadcrumb);
    });

    it("sanitizes metadata to allowed keys only", () => {
      const breadcrumb = {
        timestamp: 123,
        type: "navigation",
        description: "navigated",
        metadata: {
          action: "submit",
          path: "/home",
          invalid: "should be removed",
          count: 5,
        },
      };
      const result = sanitizeBreadcrumbMetadata(breadcrumb);
      expect(result.metadata).toEqual({
        action: "submit",
        path: "/home",
      });
    });

    it("removes metadata if no valid keys", () => {
      const breadcrumb = {
        timestamp: 123,
        type: "click",
        description: "clicked",
        metadata: {
          invalid: "value",
        },
      };
      const result = sanitizeBreadcrumbMetadata(breadcrumb);
      expect(result.metadata).toBeUndefined();
    });
  });
});
