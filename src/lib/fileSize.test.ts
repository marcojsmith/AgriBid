import { describe, it, expect } from "vitest";

import { formatFileSize } from "./fileSize";

describe("formatFileSize", () => {
  it.each([
    [0, "0.0 KB"],
    [512, "0.5 KB"],
    [153_600, "150.0 KB"],
    [1_258_291, "1.2 MB"],
    [10_485_760, "10.0 MB"],
  ])("formats %i bytes as %s", (bytes, text) => {
    expect(formatFileSize(bytes)).toBe(text);
  });
});
