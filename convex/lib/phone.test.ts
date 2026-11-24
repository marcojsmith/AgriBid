import { describe, expect, it } from "vitest";

import { normalizeSaPhone } from "./phone";

describe("normalizeSaPhone", () => {
  it.each([
    "083 700 0000",
    "+27837000000",
    "27837000000",
    "(083) 700-0000",
    "083.700.0000",
    "  +27 83 700 0000 ",
  ])("normalises %s", (raw) => {
    expect(normalizeSaPhone(raw)).toBe("+27837000000");
  });

  it.each([
    "083 700 000",
    "083 700 00000",
    "08370abc00",
    "0937000000",
    "",
    "+1 555 555 5555",
  ])("rejects %s", (raw) => {
    expect(normalizeSaPhone(raw)).toBeNull();
  });
});
