import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanupDraftsHandler } from "./internal";
import type { MutationCtx } from "../_generated/server";

describe("cleanupDrafts mutation", () => {
  let mockCtx: {
    db: {
      query: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    storage: {
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z")); // Set specific time

    vi.resetAllMocks();
    mockCtx = {
      db: {
        delete: vi.fn(),
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            filter: vi.fn().mockReturnValue({
              collect: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      },
      storage: {
        delete: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should delete old drafts and their associated storage items", async () => {
    const mockDraft = {
      _id: "draft_123",
      status: "draft",
      _creationTime: Date.now() - 31 * 24 * 60 * 60 * 1000,
      conditionReportUrl: "storage_pdf",
      images: {
        front: "storage_front",
        additional: ["storage_extra1"],
      },
    };

    mockCtx.db.query = vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          collect: vi.fn().mockResolvedValue([mockDraft]),
        }),
      }),
    });

    await cleanupDraftsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.storage.delete).toHaveBeenCalledWith("storage_pdf");
    expect(mockCtx.storage.delete).toHaveBeenCalledWith("storage_front");
    expect(mockCtx.storage.delete).toHaveBeenCalledWith("storage_extra1");
    expect(mockCtx.storage.delete).toHaveBeenCalledTimes(3);

    expect(mockCtx.db.delete).toHaveBeenCalledWith("draft_123");
  });

  it("should do nothing if no old drafts exist", async () => {
    mockCtx.db.query = vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          collect: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    await cleanupDraftsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.storage.delete).not.toHaveBeenCalled();
    expect(mockCtx.db.delete).not.toHaveBeenCalled();
  });
});
