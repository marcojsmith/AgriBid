import { describe, expect, it, vi } from "vitest";

import { assertValidColdStartVideo } from "./lotSpecs";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const VIDEO_ID = "video1" as Id<"_storage">;

/**
 * Builds a ctx whose `_storage` system table returns the given file.
 *
 * @param file - The storage metadata to return, or null when missing.
 * @returns The mock ctx and its `system.get` spy.
 */
function makeCtx(file: { contentType?: string } | null) {
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
