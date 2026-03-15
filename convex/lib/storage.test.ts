import { describe, it, expect, vi, beforeEach } from "vitest";

import { normalizeImages, deleteAuctionImages } from "./storage";
import type { MutationCtx } from "../_generated/server";

describe("Storage Utilities", () => {
  describe("normalizeImages", () => {
    it("should ensure additional array exists", () => {
      const images = { front: "f1" };
      const normalized = normalizeImages(images);
      expect(normalized).toEqual({ front: "f1", additional: [] });
    });

    it("should keep existing additional array", () => {
      const images = { additional: ["a1"] };
      const normalized = normalizeImages(images);
      expect(normalized).toEqual({ additional: ["a1"] });
    });
  });

  describe("deleteAuctionImages", () => {
    let mockCtx: {
      storage: {
        delete: ReturnType<typeof vi.fn>;
      };
    };

    beforeEach(() => {
      mockCtx = {
        storage: {
          delete: vi.fn().mockResolvedValue(undefined),
        },
      };
    });

    it("should handle legacy array of IDs", async () => {
      const images = ["id1", "id2", ""];
      await deleteAuctionImages(mockCtx as unknown as MutationCtx, images);
      expect(mockCtx.storage.delete).toHaveBeenCalledTimes(2);
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("id1");
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("id2");
    });

    it("should handle images object", async () => {
      const images = {
        front: "f1",
        engine: "e1",
        additional: ["a1", "a2"],
      };
      await deleteAuctionImages(mockCtx as unknown as MutationCtx, images);
      expect(mockCtx.storage.delete).toHaveBeenCalledTimes(4);
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("f1");
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("e1");
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("a1");
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("a2");
    });

    it("should handle empty or null images", async () => {
      await deleteAuctionImages(
        mockCtx as unknown as MutationCtx,
        null as unknown as Parameters<typeof deleteAuctionImages>[1]
      );
      await deleteAuctionImages(
        mockCtx as unknown as MutationCtx,
        {} as unknown as Parameters<typeof deleteAuctionImages>[1]
      );
      expect(mockCtx.storage.delete).not.toHaveBeenCalled();
    });

    it("should handle deletion failures gracefully", async () => {
      mockCtx.storage.delete.mockRejectedValue(new Error("Storage Error"));
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const images = { front: "f1" };
      await deleteAuctionImages(mockCtx as unknown as MutationCtx, images);

      expect(mockCtx.storage.delete).toHaveBeenCalledWith("f1");
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete storage item"),
        expect.any(Error)
      );
      spy.mockRestore();
    });
  });
});
