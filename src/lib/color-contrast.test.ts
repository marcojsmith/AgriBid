import { describe, it, expect } from "vitest";

import { contrastRatio, readHslTokens, type Hsl } from "./color-contrast";

const CSS = `
  :root { --background: 0 0% 100%; --foreground: 0 0% 0%; --x: not a colour; }
  .dark { --background: 0 0% 0%; }
`;

describe("readHslTokens", () => {
  it("reads HSL triples per theme block and skips other values", () => {
    const light = readHslTokens(CSS, ":root");
    expect(light.get("background")).toEqual([0, 0, 100]);
    expect(light.has("x")).toBe(false);
    expect(readHslTokens(CSS, ".dark").get("background")).toEqual([0, 0, 0]);
  });

  it("throws when the block is missing", () => {
    expect(() => readHslTokens(".dark { }", ":root")).toThrow(
      "Missing :root block"
    );
  });
});

describe("contrastRatio", () => {
  const black: Hsl = [0, 0, 0];
  const white: Hsl = [0, 0, 100];

  it("is 21:1 for black on white and symmetric", () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
  });

  it("is 1:1 for identical colours", () => {
    expect(contrastRatio([142, 30, 25], [142, 30, 25])).toBeCloseTo(1, 5);
  });

  it("handles saturated hues across the colour wheel", () => {
    expect(contrastRatio([0, 100, 50], white)).toBeGreaterThan(3);
    expect(contrastRatio([120, 100, 25], white)).toBeGreaterThan(5);
    expect(contrastRatio([240, 100, 50], black)).toBeGreaterThan(1);
  });
});
