import { describe, expect, it } from "vitest";

import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first letters of a full name", () => {
    expect(initialsOf("Thandi Naidoo")).toBe("TN");
  });

  it("uses the first and last words of a longer name", () => {
    expect(initialsOf("Thandi Anne Naidoo")).toBe("TN");
  });

  it("uses the first letter of a single word", () => {
    expect(initialsOf("thandi")).toBe("T");
  });

  it("ignores extra whitespace", () => {
    expect(initialsOf("  thandi   naidoo  ")).toBe("TN");
  });

  it("falls back to the email when the name is empty or missing", () => {
    expect(initialsOf("   ", "marco@example.co.za")).toBe("M");
    expect(initialsOf(undefined, "marco@example.co.za")).toBe("M");
  });

  it("returns null when there is nothing to use", () => {
    expect(initialsOf()).toBeNull();
    expect(initialsOf("", " ")).toBeNull();
  });
});
