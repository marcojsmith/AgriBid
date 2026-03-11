import { describe, it, expect } from "vitest";

import { normalizeListingImages } from "./normalize-images";

describe("normalizeListingImages", () => {
  it("should handle null or undefined input", () => {
    expect(normalizeListingImages(null)).toEqual({ additional: [] });
    expect(normalizeListingImages(undefined)).toEqual({ additional: [] });
  });

  it("should handle array input", () => {
    const input = ["  front.jpg  ", "  extra1.jpg  ", "", "  extra2.jpg  "];
    const expected = {
      front: "front.jpg",
      additional: ["extra1.jpg", "extra2.jpg"],
    };
    expect(normalizeListingImages(input)).toEqual(expected);
  });

  it("should handle object input", () => {
    const input = {
      front: "  front.jpg  ",
      engine: "engine.jpg",
      additional: ["  extra1.jpg  ", " "],
    };
    const expected = {
      front: "front.jpg",
      engine: "engine.jpg",
      cabin: "",
      rear: "",
      additional: ["extra1.jpg"],
    };
    expect(normalizeListingImages(input)).toEqual(expected);
  });

  it("should handle empty object", () => {
    expect(normalizeListingImages({})).toEqual({
      front: "",
      engine: "",
      cabin: "",
      rear: "",
      additional: [],
    });
  });

  it("should handle non-string values in additional array", () => {
    const input = {
      additional: ["valid.jpg", null, 123, " "],
    };
    expect(normalizeListingImages(input).additional).toEqual(["valid.jpg"]);
  });
});
