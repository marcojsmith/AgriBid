import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { sweepOrphanedUploadsHandler } from "./storageCleanup";
import type { MutationCtx } from "./_generated/server";

describe("sweepOrphanedUploads mutation", () => {
  let mockCtx: {
    db: {
      query: ReturnType<typeof vi.fn>;
      system: {
        query: ReturnType<typeof vi.fn>;
      };
    };
    storage: {
      delete: ReturnType<typeof vi.fn>;
    };
  };

  const makeQueryChainMock = (results: Record<string, unknown>[] = []) => ({
    withIndex: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    collect: vi.fn().mockResolvedValue(results),
    take: vi.fn((n: number) => Promise.resolve(results.slice(0, n))),
    unique: vi.fn().mockResolvedValue(results[0] || null),
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T00:00:00Z"));

    vi.resetAllMocks();
    mockCtx = {
      db: {
        query: vi.fn().mockImplementation(() => makeQueryChainMock()),
        system: {
          query: vi.fn().mockImplementation(() => makeQueryChainMock()),
        },
      },
      storage: {
        delete: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should delete unreferenced files and keep referenced ones", async () => {
    const lot = {
      _id: "lot_1",
      images: { front: "img_front", additional: ["img_extra"] },
      conditionReportUrl: "report_pdf",
    };
    const legacyImagesLot = {
      _id: "lot_2",
      images: ["legacy_img_1", "legacy_img_2"],
    };
    const profile = { _id: "profile_1", kycDocuments: ["kyc_1"] };
    const auction = { _id: "auction_1", bannerImage: "banner_1" };

    mockCtx.db.query = vi.fn().mockImplementation((table: string) => {
      if (table === "lots") return makeQueryChainMock([lot, legacyImagesLot]);
      if (table === "profiles") return makeQueryChainMock([profile]);
      if (table === "auctions") return makeQueryChainMock([auction]);
      return makeQueryChainMock();
    });

    const storageFiles = [
      { _id: "img_front", _creationTime: 1000 },
      { _id: "report_pdf", _creationTime: 1000 },
      { _id: "legacy_img_1", _creationTime: 1000 },
      { _id: "kyc_1", _creationTime: 1000 },
      { _id: "banner_1", _creationTime: 1000 },
      { _id: "orphan_old", _creationTime: 1000 },
      { _id: "orphan_old_2", _creationTime: 1000 },
    ];
    mockCtx.db.system.query = vi
      .fn()
      .mockImplementation(() => makeQueryChainMock(storageFiles));

    const result = await sweepOrphanedUploadsHandler(
      mockCtx as unknown as MutationCtx
    );

    expect(result).toEqual({ scanned: 7, deleted: 2 });
    expect(mockCtx.storage.delete).toHaveBeenCalledTimes(2);
    expect(mockCtx.storage.delete).toHaveBeenCalledWith("orphan_old");
    expect(mockCtx.storage.delete).toHaveBeenCalledWith("orphan_old_2");
  });

  it("should respect the batch-size cap when scanning storage", async () => {
    const storageFiles = Array.from({ length: 600 }, (_, i) => ({
      _id: `file_${String(i)}`,
      _creationTime: 1000,
    }));
    mockCtx.db.system.query = vi
      .fn()
      .mockImplementation(() => makeQueryChainMock(storageFiles));

    const result = await sweepOrphanedUploadsHandler(
      mockCtx as unknown as MutationCtx
    );

    // STORAGE_SWEEP_BATCH_SIZE caps the scan; the backlog drains on later runs.
    expect(result.scanned).toBe(500);
    expect(result.deleted).toBe(500);
    expect(mockCtx.storage.delete).toHaveBeenCalledTimes(500);
  });

  it("should do nothing when storage has no old unreferenced files", async () => {
    mockCtx.db.system.query = vi
      .fn()
      .mockImplementation(() => makeQueryChainMock([]));

    const result = await sweepOrphanedUploadsHandler(
      mockCtx as unknown as MutationCtx
    );

    expect(result).toEqual({ scanned: 0, deleted: 0 });
    expect(mockCtx.storage.delete).not.toHaveBeenCalled();
  });

  it("should not throw when a storage delete fails", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // Intentional no-op: suppress expected safeDelete failure warnings
    });
    mockCtx.db.system.query = vi
      .fn()
      .mockImplementation(() =>
        makeQueryChainMock([{ _id: "orphan_old", _creationTime: 1000 }])
      );
    mockCtx.storage.delete.mockRejectedValue(new Error("already deleted"));

    const result = await sweepOrphanedUploadsHandler(
      mockCtx as unknown as MutationCtx
    );

    expect(result).toEqual({ scanned: 1, deleted: 1 });
    consoleSpy.mockRestore();
  });
});
