import { describe, it, expect } from "vitest";

import {
  classifyError,
  shouldReportError,
  getErrorClassification,
} from "./error-classifier";

describe("Error Classifier", () => {
  const validationErrors = [
    new Error("Not authenticated to perform this action"),
    new Error("Unauthorized access"),
    new Error("Forbidden"),
    new Error("User must be logged in"),
    new Error("Name is required"),
    new Error("Value must be between 1 and 10"),
    new Error("Invalid format for email"),
    new Error("Cannot bid on own auction"),
    new Error("KYC required before bidding"),
    new Error("Only admins can perform this action"),
    new Error("Invalid auth token"),
    new Error("Session has expired"),
    "Name is required", // test string error
  ];

  const unexpectedErrors = [
    new Error("Document not found"),
    new Error("Auction 123 not found"),
    new Error("User 123 not found"),
    new Error("Resource not found"),
    new Error("Rate limit exceeded"),
    new Error("Too many requests, try again later"),
    new Error("Cannot read properties of undefined (reading 'foo')"),
    new Error("NetworkError when attempting to fetch resource."),
    new Error("Failed to compile module"),
    new Error("process is not defined"),
    "TypeError: foo is not a function",
  ];

  describe("classifyError", () => {
    it("classifies known validation errors as 'validation'", () => {
      for (const err of validationErrors) {
        expect(classifyError(err)).toBe("validation");
      }
    });

    it("classifies unknown errors as 'unexpected'", () => {
      for (const err of unexpectedErrors) {
        expect(classifyError(err)).toBe("unexpected");
      }
    });
  });

  describe("shouldReportError", () => {
    it("returns false for validation errors", () => {
      for (const err of validationErrors) {
        expect(shouldReportError(err)).toBe(false);
      }
    });

    it("returns true for unexpected errors", () => {
      for (const err of unexpectedErrors) {
        expect(shouldReportError(err)).toBe(true);
      }
    });
  });

  describe("getErrorClassification", () => {
    it("returns the classification string", () => {
      expect(getErrorClassification(new Error("unauthorized"))).toBe(
        "validation"
      );
      expect(getErrorClassification(new Error("foo undefined"))).toBe(
        "unexpected"
      );
    });
  });
});
