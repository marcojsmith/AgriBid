import { describe, it, expect, vi, beforeEach } from "vitest";

import { resolveUrlCached } from "./image_cache";
import type { QueryCtx } from "./_generated/server";

/**
 * Tests for the image cache utility functions
 */
describe("image_cache", () => {
  let mockStorage: {
    getUrl: ReturnType<typeof vi.fn>;
    getMetadata: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockStorage = {
      getUrl: vi.fn(),
      getMetadata: vi.fn(),
    };
  });

  describe("resolveUrlCached", () => {
    it("should return undefined when storageId is undefined", async () => {
      const result = await resolveUrlCached(
        mockStorage as unknown as QueryCtx["storage"],
        undefined
      );
      expect(result).toBeUndefined();
    });

    it("should return undefined when storageId is empty string", async () => {
      const result = await resolveUrlCached(
        mockStorage as unknown as QueryCtx["storage"],
        ""
      );
      expect(result).toBeUndefined();
    });

    it("should return storageId as-is when it starts with http", async () => {
      const result = await resolveUrlCached(
        mockStorage as unknown as QueryCtx["storage"],
        "https://example.com/image.jpg"
      );
      expect(result).toBe("https://example.com/image.jpg");
      expect(mockStorage.getUrl).not.toHaveBeenCalled();
    });

    it("should return storageId as-is when it starts with https", async () => {
      const result = await resolveUrlCached(
        mockStorage as unknown as QueryCtx["storage"],
        "https://storage.example.com/image.jpg"
      );
      expect(result).toBe("https://storage.example.com/image.jpg");
      expect(mockStorage.getUrl).not.toHaveBeenCalled();
    });

    it("should call storage.getUrl when storageId does not start with http", async () => {
      mockStorage.getUrl.mockResolvedValue(
        "https://convex.cloud/storage/abc123"
      );
      const result = await resolveUrlCached(
        mockStorage as unknown as QueryCtx["storage"],
        "abc123"
      );
      expect(mockStorage.getUrl).toHaveBeenCalledWith("abc123");
      expect(result).toBe("https://convex.cloud/storage/abc123");
    });

    it("should return undefined when getUrl returns null", async () => {
      mockStorage.getUrl.mockResolvedValue(null);
      const result = await resolveUrlCached(
        mockStorage as unknown as QueryCtx["storage"],
        "abc123"
      );
      expect(result).toBeUndefined();
    });

    it("should return undefined when getUrl returns undefined", async () => {
      mockStorage.getUrl.mockResolvedValue(undefined);
      const result = await resolveUrlCached(
        mockStorage as unknown as QueryCtx["storage"],
        "abc123"
      );
      expect(result).toBeUndefined();
    });

    it("should handle storageId with special characters", async () => {
      mockStorage.getUrl.mockResolvedValue(
        "https://convex.cloud/storage/xyz789"
      );
      const result = await resolveUrlCached(
        mockStorage as unknown as QueryCtx["storage"],
        "xyz789"
      );
      expect(mockStorage.getUrl).toHaveBeenCalledWith("xyz789");
      expect(result).toBe("https://convex.cloud/storage/xyz789");
    });
  });
});
