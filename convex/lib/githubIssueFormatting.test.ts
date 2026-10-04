import { describe, it, expect } from "vitest";

import { formatIssueBody, formatCommentBody } from "./githubIssueFormatting";

describe("githubIssueFormatting", () => {
  const now = Date.now();

  describe("formatIssueBody", () => {
    it("formats a complete error report", () => {
      const report = {
        errorType: "TypeError",
        errorMessage: "Cannot read properties of undefined",
        stackTrace: "Error: boom\n    at fn (file.ts:1:1)",
        userId: "u1",
        userRole: "admin",
        additionalInfo: { retries: 2 },
        breadcrumbs: [
          { timestamp: now, type: "click", description: "clicked button" },
        ],
        metadata: { url: "https://example.com", userAgent: "ua", timestamp: now },
        instanceCount: 1,
      };

      const body = formatIssueBody(report);

      expect(body).toContain("## Production Error Report");
      expect(body).toContain("**Error Type:** TypeError");
      expect(body).toContain("**Error Message:** Cannot read properties of undefined");
      expect(body).toContain("**Instance Count:** 1");
      expect(body).toContain("Error: boom");
      expect(body).toContain("**User ID:** u1");
      expect(body).toContain("**User Role:** admin");
      expect(body).toContain("**retries:** 2");
    });

    it("handles missing optional fields", () => {
      const report = {
        errorType: "Error",
        errorMessage: "Something went wrong",
        breadcrumbs: [],
        metadata: { url: "https://example.com", userAgent: "ua", timestamp: now },
        instanceCount: 1,
      };

      const body = formatIssueBody(report);

      expect(body).toContain("No stack trace available");
      expect(body).toContain("**User ID:** Anonymous");
      expect(body).toContain("**User Role:** N/A");
      expect(body).toContain("No breadcrumbs recorded");
    });

    it("formats breadcrumbs with metadata", () => {
      const report = {
        errorType: "Error",
        errorMessage: "Test",
        breadcrumbs: [
          {
            timestamp: now,
            type: "navigation",
            description: "navigated",
            metadata: { path: "/home", action: "click" },
          },
        ],
        metadata: { url: "u", userAgent: "ua", timestamp: now },
        instanceCount: 1,
      };

      const body = formatIssueBody(report);
      expect(body).toContain("path=/home, action=click");
    });
  });

  describe("formatCommentBody", () => {
    it("formats a comment for an existing issue", () => {
      const report = {
        errorMessage: "Test error message",
        userId: "u1",
        metadata: { url: "https://example.com" },
        instanceCount: 5,
        lastOccurredAt: now,
      };

      const body = formatCommentBody(report);

      expect(body).toContain("## New Error Instance");
      expect(body).toContain("**Instance Count:** 5");
      expect(body).toContain("**User ID:** u1");
      expect(body).toContain("**URL:** https://example.com");
      expect(body).toContain("> Test error message");
    });

    it("handles missing user ID", () => {
      const report = {
        errorMessage: "Error",
        metadata: { url: "u" },
        instanceCount: 1,
        lastOccurredAt: now,
      };

      const body = formatCommentBody(report);
      expect(body).toContain("**User ID:** Anonymous");
    });
  });
});
