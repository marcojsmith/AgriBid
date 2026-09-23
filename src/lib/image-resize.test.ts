import { describe, it, expect } from "vitest";

import {
  computeTargetDimensions,
  resizeImageFile,
  MAX_UPLOAD_IMAGE_DIMENSION,
} from "./image-resize";

describe("computeTargetDimensions", () => {
  it("scales a landscape image to fit the max dimension", () => {
    expect(computeTargetDimensions(3200, 1600, 1600)).toEqual({
      width: 1600,
      height: 800,
    });
  });

  it("scales a portrait image to fit the max dimension", () => {
    expect(computeTargetDimensions(1200, 2400, 1600)).toEqual({
      width: 800,
      height: 1600,
    });
  });

  it("leaves images already within the limit unchanged", () => {
    expect(computeTargetDimensions(800, 600, 1600)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("rounds fractional results", () => {
    expect(computeTargetDimensions(1000, 1501, 1000)).toEqual({
      width: 666,
      height: 1000,
    });
  });

  it("handles a zero-sized image without dividing by zero", () => {
    expect(computeTargetDimensions(0, 0, MAX_UPLOAD_IMAGE_DIMENSION)).toEqual({
      width: 0,
      height: 0,
    });
  });
});

describe("resizeImageFile", () => {
  it("returns non-image files untouched", async () => {
    const pdf = new File(["%PDF-1.4"], "report.pdf", {
      type: "application/pdf",
    });

    await expect(resizeImageFile(pdf)).resolves.toBe(pdf);
  });

  it("falls back to the original file when canvas rendering is unavailable", async () => {
    // jsdom has no real canvas implementation, so the resize path cannot
    // complete; the helper must fall back to the original file.
    const image = new File(["jpeg-bytes"], "photo.jpg", {
      type: "image/jpeg",
    });

    await expect(resizeImageFile(image)).resolves.toBe(image);
  });
});
