import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  computeTargetDimensions,
  resizeImageFile,
  MAX_UPLOAD_IMAGE_DIMENSION,
  RESIZE_JPEG_QUALITY,
} from "./image-resize";

/**
 * Copies the real `document` onto a plain object so it can be spread without
 * losing `Document`'s prototype (spreading a class instance trips
 * `no-misused-spread`).
 *
 * @returns A plain object mirroring the ambient document
 */
function toPlainDocument(): Record<string, unknown> {
  const plain: Record<string, unknown> = {};
  const source = document as unknown as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(document)) {
    plain[key] = source[key];
  }
  return plain;
}

describe("image-resize", () => {
  describe("constants", () => {
    it("exports MAX_UPLOAD_IMAGE_DIMENSION as 1600", () => {
      expect(MAX_UPLOAD_IMAGE_DIMENSION).toBe(1600);
    });

    it("exports RESIZE_JPEG_QUALITY as 0.8", () => {
      expect(RESIZE_JPEG_QUALITY).toBe(0.8);
    });
  });

  describe("computeTargetDimensions", () => {
    it("returns unchanged dimensions when within limit", () => {
      expect(computeTargetDimensions(800, 600, 1600)).toEqual({
        width: 800,
        height: 600,
      });
    });

    it("returns unchanged dimensions when exactly at limit", () => {
      expect(computeTargetDimensions(1600, 1200, 1600)).toEqual({
        width: 1600,
        height: 1200,
      });
    });

    it("scales down landscape image preserving aspect ratio", () => {
      const result = computeTargetDimensions(3200, 1600, 1600);
      expect(result).toEqual({ width: 1600, height: 800 });
    });

    it("scales down portrait image preserving aspect ratio", () => {
      const result = computeTargetDimensions(1600, 3200, 1600);
      expect(result).toEqual({ width: 800, height: 1600 });
    });

    it("scales down square image", () => {
      const result = computeTargetDimensions(2000, 2000, 1000);
      expect(result).toEqual({ width: 1000, height: 1000 });
    });

    it("returns unchanged when largest dimension is 0", () => {
      expect(computeTargetDimensions(0, 0, 1600)).toEqual({
        width: 0,
        height: 0,
      });
    });

    it("uses custom maxDimension", () => {
      const result = computeTargetDimensions(2000, 1000, 500);
      expect(result).toEqual({ width: 500, height: 250 });
    });
  });

  describe("resizeImageFile", () => {
    let mockBitmap: {
      width: number;
      height: number;
      close: ReturnType<typeof vi.fn>;
    };
    let mockContext: {
      fillStyle: string;
      fillRect: ReturnType<typeof vi.fn>;
      drawImage: ReturnType<typeof vi.fn>;
    };
    let mockCanvas: {
      width: number;
      height: number;
      getContext: ReturnType<typeof vi.fn>;
      toBlob: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockBitmap = {
        width: 3200,
        height: 1600,
        close: vi.fn(),
      };

      mockContext = {
        fillStyle: "",
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      };

      mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockContext),
        toBlob: vi.fn((callback) => {
          callback(new Blob(["compressed"], { type: "image/jpeg" }));
        }),
      };

      vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(mockBitmap));
      vi.stubGlobal("document", {
        ...toPlainDocument(),
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("returns original file for non-image types", async () => {
      const file = new File(["content"], "doc.pdf", {
        type: "application/pdf",
      });
      const result = await resizeImageFile(file);
      expect(result).toBe(file);
    });

    it("resizes an image file to JPEG", async () => {
      const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
      const result = await resizeImageFile(file);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe("image/jpeg");
      expect(mockBitmap.close).toHaveBeenCalled();
      expect(mockContext.fillStyle).toBe("#ffffff");
      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 1600, 800);
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        mockBitmap,
        0,
        0,
        1600,
        800
      );
    });

    it("uses custom maxDimension", async () => {
      const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
      await resizeImageFile(file, 800);

      expect(mockCanvas.width).toBe(800);
      expect(mockCanvas.height).toBe(400);
    });

    it("returns original file when canvas context is null", async () => {
      mockCanvas.getContext.mockReturnValue(null);
      const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
      const result = await resizeImageFile(file);
      expect(result).toBe(file);
      expect(mockBitmap.close).toHaveBeenCalled();
    });

    it("returns original file when bitmap dimensions are 0", async () => {
      mockBitmap.width = 0;
      mockBitmap.height = 0;
      const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
      const result = await resizeImageFile(file);
      expect(result).toBe(file);
      expect(mockBitmap.close).toHaveBeenCalled();
    });

    it("returns original file when toBlob returns null", async () => {
      mockCanvas.toBlob.mockImplementation(
        (callback: (b: Blob | null) => void) => {
          callback(null);
        }
      );
      const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
      const result = await resizeImageFile(file);
      expect(result).toBe(file);
    });

    it("returns original file on createImageBitmap failure", async () => {
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn().mockRejectedValue(new Error("unsupported"))
      );
      const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
      const result = await resizeImageFile(file);
      expect(result).toBe(file);
    });

    it("returns original file on unexpected error", async () => {
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn().mockImplementation(() => {
          throw new Error("unexpected");
        })
      );
      const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
      const result = await resizeImageFile(file);
      expect(result).toBe(file);
    });

    it("does not resize when image is already within limits", async () => {
      mockBitmap.width = 800;
      mockBitmap.height = 600;
      const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
      await resizeImageFile(file);

      expect(mockCanvas.width).toBe(800);
      expect(mockCanvas.height).toBe(600);
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        mockBitmap,
        0,
        0,
        800,
        600
      );
    });
  });
});
