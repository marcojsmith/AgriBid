import { describe, it, expect } from "vitest";

import { parseOffsetCursor } from "./pagination";

describe("parseOffsetCursor", () => {
  it("returns 0 for a missing cursor", () => {
    expect(parseOffsetCursor(null)).toBe(0);
    expect(parseOffsetCursor(undefined)).toBe(0);
  });

  it("returns 0 for an empty or whitespace-only cursor", () => {
    expect(parseOffsetCursor("")).toBe(0);
    expect(parseOffsetCursor("   ")).toBe(0);
  });

  it("parses a numeric cursor", () => {
    expect(parseOffsetCursor("0")).toBe(0);
    expect(parseOffsetCursor("42")).toBe(42);
    expect(parseOffsetCursor(" 42 ")).toBe(42);
  });

  it("truncates a trailing-garbage cursor to its leading number", () => {
    expect(parseOffsetCursor("42abc")).toBe(42);
    expect(parseOffsetCursor("3.9")).toBe(3);
  });

  it("returns 0 for a cursor with no leading number", () => {
    expect(parseOffsetCursor("abc")).toBe(0);
    expect(parseOffsetCursor("abc42")).toBe(0);
  });

  it("returns 0 for a negative cursor", () => {
    expect(parseOffsetCursor("-5")).toBe(0);
  });

  it("never returns NaN", () => {
    for (const cursor of [
      null,
      undefined,
      "",
      " ",
      "abc",
      "-5",
      "1e",
      "0x10",
    ]) {
      expect(Number.isNaN(parseOffsetCursor(cursor))).toBe(false);
    }
  });
});
