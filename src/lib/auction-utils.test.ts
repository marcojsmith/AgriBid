import { describe, it, expect } from "vitest";

import { normalizeAuctionImages } from "./auction-utils";

describe("normalizeAuctionImages", () => {
  it("returns empty object for undefined", () => {
    const result = normalizeAuctionImages(undefined);
    expect(result).toEqual({ additional: [] });
  });

  it("normalizes string array", () => {
    const result = normalizeAuctionImages(["img1.jpg", "img2.jpg", "img3.jpg"]);
    expect(result).toEqual({
      front: "img1.jpg",
      additional: ["img2.jpg", "img3.jpg"],
    });
  });

  it("normalizes AuctionImages object", () => {
    const input = {
      front: "front.jpg",
      engine: "engine.jpg",
      cabin: "cabin.jpg",
      rear: "rear.jpg",
      additional: ["add1.jpg", "add2.jpg"],
    };
    const result = normalizeAuctionImages(input);
    expect(result).toEqual(input);
  });

  it("handles partial AuctionImages object", () => {
    const result = normalizeAuctionImages({ front: "front.jpg" });
    expect(result).toEqual({ front: "front.jpg", additional: [] });
  });

  it("defaults additional to empty array when not provided", () => {
    const result = normalizeAuctionImages({
      front: "front.jpg",
      engine: "engine.jpg",
    });
    expect(result.additional).toEqual([]);
  });
});
