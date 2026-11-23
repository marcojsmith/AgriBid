import { beforeEach, describe, expect, it, vi } from "vitest";

import { COLD_START_VIDEO_MAX_BYTES } from "../../constants";
import { saveDraftHandler } from "./create";
import { adminUpdateLotHandler } from "./update";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/**
 * Handler-level coverage for replacing a lot's cold start video. convex-test
 * does not record a stored file's content type, so the replace path (which has
 * to validate a new video file) is exercised with a mocked context here; the
 * removal and same-id paths are covered in lotSpecs.integration.test.ts.
 */

const OLD_ID = "oldVideo" as Id<"_storage">;
const NEW_ID = "newVideo" as Id<"_storage">;
const LOT_ID = "lot1" as Id<"lots">;

vi.mock("../../lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(undefined),
  requireVerified: vi.fn().mockResolvedValue({ userId: "seller" }),
  getAuthenticatedUserId: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("../../admin/platformSettings", () => ({
  getMinPhotosPerLot: vi.fn().mockResolvedValue(1),
}));

vi.mock("../../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

interface MockCtx {
  db: {
    get: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    normalizeId: ReturnType<typeof vi.fn>;
    system: { get: ReturnType<typeof vi.fn> };
  };
  storage: { delete: ReturnType<typeof vi.fn> };
}

let ctx: MockCtx;

/**
 * Builds a mock ctx holding a lot (draft, owned by `seller`) with the old video
 * and a `_storage` table that knows the new file.
 *
 * @param newFile - Metadata of the new storage file (null = missing)
 * @returns The mock context
 */
function makeCtx(newFile: { contentType?: string; size: number } | null) {
  return {
    db: {
      get: vi.fn().mockResolvedValue({
        _id: LOT_ID,
        sellerId: "seller",
        status: "draft",
        images: { front: "img" },
        coldStartVideo: OLD_ID,
      }),
      patch: vi.fn().mockResolvedValue(undefined),
      normalizeId: vi.fn().mockReturnValue(LOT_ID),
      system: { get: vi.fn().mockResolvedValue(newFile) },
    },
    storage: { delete: vi.fn().mockResolvedValue(undefined) },
  };
}

const asCtx = () => ctx as unknown as MutationCtx;

describe("cold start video replacement", () => {
  beforeEach(() => {
    ctx = makeCtx({ contentType: "video/mp4", size: 1024 });
  });

  it("saveDraft deletes the old file after patching a replacement", async () => {
    await saveDraftHandler(asCtx(), {
      lotId: LOT_ID,
      coldStartVideo: NEW_ID,
    });

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "lots",
      LOT_ID,
      expect.objectContaining({ coldStartVideo: NEW_ID })
    );
    expect(ctx.storage.delete).toHaveBeenCalledWith(OLD_ID);
    expect(ctx.db.patch.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.storage.delete.mock.invocationCallOrder[0]
    );
  });

  it("saveDraft with null unsets the field and deletes the file", async () => {
    await saveDraftHandler(asCtx(), { lotId: LOT_ID, coldStartVideo: null });

    const patch = ctx.db.patch.mock.calls[0][2] as Record<string, unknown>;
    expect("coldStartVideo" in patch).toBe(true);
    expect(patch.coldStartVideo).toBeUndefined();
    expect(ctx.storage.delete).toHaveBeenCalledWith(OLD_ID);
    expect(ctx.db.system.get).not.toHaveBeenCalled();
  });

  it("saveDraft with the same id neither revalidates nor deletes", async () => {
    await saveDraftHandler(asCtx(), { lotId: LOT_ID, coldStartVideo: OLD_ID });

    expect(ctx.db.system.get).not.toHaveBeenCalled();
    expect(ctx.storage.delete).not.toHaveBeenCalled();
  });

  it("saveDraft rejects an oversize replacement and keeps the old file", async () => {
    ctx = makeCtx({
      contentType: "video/mp4",
      size: COLD_START_VIDEO_MAX_BYTES + 1,
    });
    await expect(
      saveDraftHandler(asCtx(), { lotId: LOT_ID, coldStartVideo: NEW_ID })
    ).rejects.toThrow("Cold start video must be at most 50 MB");
    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.storage.delete).not.toHaveBeenCalled();
  });

  it("saveDraft rejects a missing replacement", async () => {
    ctx = makeCtx(null);
    await expect(
      saveDraftHandler(asCtx(), { lotId: LOT_ID, coldStartVideo: NEW_ID })
    ).rejects.toThrow("Cold start video file not found");
    expect(ctx.storage.delete).not.toHaveBeenCalled();
  });

  it("adminUpdateLot deletes the old file after patching a replacement", async () => {
    await adminUpdateLotHandler(asCtx(), {
      lotId: LOT_ID,
      updates: { coldStartVideo: NEW_ID },
    });

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "lots",
      LOT_ID,
      expect.objectContaining({ coldStartVideo: NEW_ID })
    );
    expect(ctx.storage.delete).toHaveBeenCalledWith(OLD_ID);
  });

  it("adminUpdateLot with null unsets the field and deletes the file", async () => {
    await adminUpdateLotHandler(asCtx(), {
      lotId: LOT_ID,
      updates: { coldStartVideo: null },
    });

    const patch = ctx.db.patch.mock.calls[0][2] as Record<string, unknown>;
    expect("coldStartVideo" in patch).toBe(true);
    expect(patch.coldStartVideo).toBeUndefined();
    expect(ctx.storage.delete).toHaveBeenCalledWith(OLD_ID);
  });

  it("adminUpdateLot rejects an oversize or non-video replacement", async () => {
    ctx = makeCtx({
      contentType: "video/mp4",
      size: COLD_START_VIDEO_MAX_BYTES + 1,
    });
    await expect(
      adminUpdateLotHandler(asCtx(), {
        lotId: LOT_ID,
        updates: { coldStartVideo: NEW_ID },
      })
    ).rejects.toThrow("Cold start video must be at most 50 MB");

    ctx = makeCtx({ contentType: "image/png", size: 10 });
    await expect(
      adminUpdateLotHandler(asCtx(), {
        lotId: LOT_ID,
        updates: { coldStartVideo: NEW_ID },
      })
    ).rejects.toThrow("Cold start video must be a video file");
    expect(ctx.storage.delete).not.toHaveBeenCalled();
  });

  it("adminUpdateLot leaves the video alone when the field is omitted", async () => {
    await adminUpdateLotHandler(asCtx(), {
      lotId: LOT_ID,
      updates: { serialNumber: "SN1" },
    });
    expect(ctx.storage.delete).not.toHaveBeenCalled();
    const patch = ctx.db.patch.mock.calls[0][2] as Record<string, unknown>;
    expect("coldStartVideo" in patch).toBe(false);
  });
});
