import { describe, it, expect } from "vitest";

import { getEventBucket, normalizeAuctionImages } from "./auction-utils";

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

describe("getEventBucket", () => {
  const event = {
    status: "published" as const,
    startTime: 1000,
    endTime: 2000,
    effectiveEndTime: 2000,
  };

  it("is upcoming before the start", () => {
    expect(getEventBucket(event, 999)).toBe("upcoming");
  });

  it("is live from the start until the end (exclusive)", () => {
    expect(getEventBucket(event, 1000)).toBe("live");
    expect(getEventBucket(event, 1999)).toBe("live");
    expect(getEventBucket(event, 2000)).toBe("closed");
  });

  it("stays live until a soft-close extension ends", () => {
    const extended = { ...event, effectiveEndTime: 3000 };
    expect(getEventBucket(extended, 2500)).toBe("live");
    expect(getEventBucket(extended, 3000)).toBe("closed");
  });

  it("falls back to endTime without an effective end", () => {
    const bare = {
      status: event.status,
      startTime: event.startTime,
      endTime: event.endTime,
    };
    expect(getEventBucket(bare, 1500)).toBe("live");
    expect(getEventBucket(bare, 2000)).toBe("closed");
  });

  it("is closed for closed and draft containers regardless of time", () => {
    expect(getEventBucket({ ...event, status: "closed" }, 1500)).toBe("closed");
    expect(getEventBucket({ ...event, status: "draft" }, 500)).toBe("closed");
  });
});
