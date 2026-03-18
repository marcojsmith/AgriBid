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

  it("should handle array with non-string first element", () => {
    const input = [null, "extra.jpg"];
    expect(normalizeListingImages(input).front).toBe("");
    expect(normalizeListingImages(input).additional).toEqual(["extra.jpg"]);
  });

  it("should handle object input", () => {
    const input = {
      front: "  front.jpg  ",
      engine: "engine.jpg",
      cabin: "cabin.jpg",
      rear: "rear.jpg",
      additional: ["  extra1.jpg  ", " "],
    };
    const expected = {
      front: "front.jpg",
      engine: "engine.jpg",
      cabin: "cabin.jpg",
      rear: "rear.jpg",
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

  it("should handle object where additional is not an array", () => {
    const input = { additional: "not-an-array" };
    expect(normalizeListingImages(input).additional).toEqual([]);
  });

  it("should handle non-object non-array input", () => {
    expect(normalizeListingImages(123)).toEqual({ additional: [] });
  });
});
