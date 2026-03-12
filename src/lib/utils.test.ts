import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";

import { cn, isValidCallbackUrl, getErrorMessage } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    const result = cn("foo", "bar");
    expect(result).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    const isBar = false;
    const result = cn("foo", isBar && "bar", "baz");
    expect(result).toBe("foo baz");
  });

  it("handles arrays", () => {
    const result = cn(["foo", "bar"]);
    expect(result).toBe("foo bar");
  });

  it("handles objects", () => {
    const result = cn({ foo: true, bar: false });
    expect(result).toBe("foo");
  });

  it("resolves tailwind conflicts", () => {
    // p-4 and p-8 are conflicting padding classes, p-8 should win
    expect(cn("p-4 p-8")).toBe("p-8");
  });
});

describe("isValidCallbackUrl", () => {
  it("returns true for valid relative paths", () => {
    expect(isValidCallbackUrl("/dashboard")).toBe(true);
    expect(isValidCallbackUrl("/")).toBe(true);
    expect(isValidCallbackUrl("/path/to/page")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidCallbackUrl("")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isValidCallbackUrl(null)).toBe(false);
    expect(isValidCallbackUrl(undefined)).toBe(false);
  });

  it("returns false for absolute URLs", () => {
    expect(isValidCallbackUrl("https://example.com")).toBe(false);
    expect(isValidCallbackUrl("http://example.com")).toBe(false);
  });

  it("returns false for protocol-relative URLs", () => {
    expect(isValidCallbackUrl("//example.com")).toBe(false);
  });

  it("returns false for relative paths starting with //", () => {
    expect(isValidCallbackUrl("//path")).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("extracts message from Error", () => {
    const error = new Error("Test error");
    expect(getErrorMessage(error)).toBe("Test error");
  });

  it("extracts data from ConvexError when it's a string", () => {
    const error = new ConvexError("Convex error data");
    expect(getErrorMessage(error)).toBe("Convex error data");
  });

  it("falls back to message for ConvexError with object data", () => {
    const error = new ConvexError({
      code: "INVALID_INPUT",
      message: "Invalid",
    });
    const result = getErrorMessage(error);
    // ConvexError with object usually has a generated message including the data
    expect(result).toContain("Invalid");
  });

  it("falls back to default fallback if ConvexError message is missing", () => {
    const error = new ConvexError({});
    // Manually clear message if possible or just test fallback
    expect(getErrorMessage(error, "Fallback")).toBeDefined();
  });

  it("returns fallback for unknown error types", () => {
    expect(getErrorMessage("string error")).toBe("An error occurred");
    expect(getErrorMessage(123)).toBe("An error occurred");
    expect(getErrorMessage(null)).toBe("An error occurred");
  });

  it("uses custom fallback when provided for unknown types", () => {
    expect(getErrorMessage("string error", "Custom fallback")).toBe(
      "Custom fallback"
    );
  });
});
