import { describe, expect, it, vi } from "vitest";

import { COLD_START_VIDEO_MAX_BYTES } from "../constants";
import {
  assertValidColdStartVideo,
  deleteReplacedColdStartVideo,
} from "./lotSpecs";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const VIDEO_ID = "video1" as Id<"_storage">;

/**
 * Builds a ctx whose `_storage` system table returns the given file.
 *
 * @param file - The storage metadata to return, or null when missing.
 * @returns The mock ctx and its `system.get` spy.
 */
function makeCtx(file: { contentType?: string; size?: number } | null) {
  const get = vi.fn().mockResolvedValue(file);
  return { ctx: { db: { system: { get } } } as unknown as MutationCtx, get };
}

describe("assertValidColdStartVideo", () => {
  it("does nothing when no video is provided", async () => {
    const { ctx, get } = makeCtx(null);
    await expect(
      assertValidColdStartVideo(ctx, undefined)
    ).resolves.toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });

  it("accepts an existing file with a video content type", async () => {
    const { ctx, get } = makeCtx({ contentType: "video/mp4" });
    await expect(
      assertValidColdStartVideo(ctx, VIDEO_ID)
    ).resolves.toBeUndefined();
    expect(get).toHaveBeenCalledWith("_storage", VIDEO_ID);
  });

  it("rejects a missing file", async () => {
    const { ctx } = makeCtx(null);
    await expect(assertValidColdStartVideo(ctx, VIDEO_ID)).rejects.toThrow(
      "Cold start video file not found"
    );
  });

  it.each([{ contentType: "image/png" }, {}])(
    "rejects a file that is not a video (%o)",
    async (file) => {
      const { ctx } = makeCtx(file);
      await expect(assertValidColdStartVideo(ctx, VIDEO_ID)).rejects.toThrow(
        "Cold start video must be a video file"
      );
    }
  );
});

describe("assertValidColdStartVideo size and removal", () => {
  it("does nothing when removing the video with null", async () => {
    const { ctx, get } = makeCtx(null);
    await expect(assertValidColdStartVideo(ctx, null)).resolves.toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });

  it("accepts a video of exactly the maximum size", async () => {
    const { ctx } = makeCtx({
      contentType: "video/mp4",
      size: COLD_START_VIDEO_MAX_BYTES,
    });
    await expect(
      assertValidColdStartVideo(ctx, VIDEO_ID)
    ).resolves.toBeUndefined();
  });

  it("rejects a video over 50 MB", async () => {
    expect(COLD_START_VIDEO_MAX_BYTES).toBe(50 * 1024 * 1024);
    const { ctx } = makeCtx({
      contentType: "video/mp4",
      size: COLD_START_VIDEO_MAX_BYTES + 1,
    });
    await expect(assertValidColdStartVideo(ctx, VIDEO_ID)).rejects.toThrow(
      "Cold start video must be at most 50 MB"
    );
  });

  it("trusts only the stored content type, not the size of a non-video", async () => {
    const { ctx } = makeCtx({
      contentType: "application/zip",
      size: COLD_START_VIDEO_MAX_BYTES + 1,
    });
    await expect(assertValidColdStartVideo(ctx, VIDEO_ID)).rejects.toThrow(
      "Cold start video must be a video file"
    );
  });
});

describe("deleteReplacedColdStartVideo", () => {
  const OLD_ID = "old1" as Id<"_storage">;
  const NEW_ID = "new1" as Id<"_storage">;

  /**
   * Builds a ctx exposing only `storage.delete`.
   *
   * @returns The ctx and the delete spy
   */
  function makeStorageCtx() {
    const del = vi.fn().mockResolvedValue(undefined);
    return {
      ctx: { storage: { delete: del } } as unknown as MutationCtx,
      del,
    };
  }

  it("deletes the old file when replaced by a different id", async () => {
    const { ctx, del } = makeStorageCtx();
    await deleteReplacedColdStartVideo(ctx, OLD_ID, NEW_ID);
    expect(del).toHaveBeenCalledWith(OLD_ID);
  });

  it("deletes the old file when removed with null", async () => {
    const { ctx, del } = makeStorageCtx();
    await deleteReplacedColdStartVideo(ctx, OLD_ID, null);
    expect(del).toHaveBeenCalledWith(OLD_ID);
  });

  it("keeps the file for the same id, an untouched field or no previous video", async () => {
    const { ctx, del } = makeStorageCtx();
    await deleteReplacedColdStartVideo(ctx, OLD_ID, OLD_ID);
    await deleteReplacedColdStartVideo(ctx, OLD_ID, undefined);
    await deleteReplacedColdStartVideo(ctx, undefined, NEW_ID);
    await deleteReplacedColdStartVideo(ctx, undefined, null);
    expect(del).not.toHaveBeenCalled();
  });

  it("does not fail the update when the old file is already gone", async () => {
    const del = vi.fn().mockRejectedValue(new Error("missing"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ctx = { storage: { delete: del } } as unknown as MutationCtx;
    await expect(
      deleteReplacedColdStartVideo(ctx, OLD_ID, NEW_ID)
    ).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
