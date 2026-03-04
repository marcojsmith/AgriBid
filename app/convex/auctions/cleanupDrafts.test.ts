import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { cleanupDraftsHandler } from "./internal";
import type { MutationCtx } from "../_generated/server";
import * as auth from "../lib/auth";

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
}));

describe("cleanupDrafts mutation", () => {
  let mockCtx: {
    db: {
      query: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
    };
    storage: {
      delete: ReturnType<typeof vi.fn>;
    };
    auth: {
      getUserIdentity: ReturnType<typeof vi.fn>;
    };
    // Prewired for getAuthUser/audit logging lookups
    runQuery: ReturnType<typeof vi.fn>;
  };

  const makeQueryChainMock = <T = Record<string, unknown>>(
    results: T[] = []
  ) => ({
    withIndex: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    collect: vi.fn().mockResolvedValue(results),
    take: vi.fn().mockResolvedValue(results),
    unique: vi.fn().mockResolvedValue(results[0] || null),
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z")); // Set specific time

    vi.resetAllMocks();
    mockCtx = {
      db: {
        delete: vi.fn(),
        insert: vi.fn(),
        patch: vi.fn(),
        query: vi.fn().mockReturnValue(makeQueryChainMock()),
      },
      storage: {
        delete: vi.fn(),
      },
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue(null),
      },
      runQuery: vi.fn(),
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

    mockCtx.db.query = vi.fn().mockImplementation((table) => {
      if (table === "auctions") {
        return makeQueryChainMock([mockDraft]);
      }
      return makeQueryChainMock();
    });

    await cleanupDraftsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.storage.delete).toHaveBeenCalledWith("storage_pdf");
    expect(mockCtx.storage.delete).toHaveBeenCalledWith("storage_front");
    expect(mockCtx.storage.delete).toHaveBeenCalledWith("storage_extra1");

    expect(mockCtx.db.delete).toHaveBeenCalledWith("draft_123");
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "auditLogs",
      expect.objectContaining({
        action: "CLEANUP_DRAFT_AUCTIONS",
        adminId: "SYSTEM",
      })
    );
  });

  it("should record SYSTEM actor in audit logs when system is true and no user is authenticated", async () => {
    const mockDraft = {
      _id: "draft_123",
      status: "draft",
      _creationTime: Date.now() - 31 * 24 * 60 * 60 * 1000,
      images: { front: "storage_front" },
    };

    vi.mocked(auth.getAuthUser).mockResolvedValue(null);

    mockCtx.db.query = vi.fn().mockImplementation((table) => {
      if (table === "auctions") return makeQueryChainMock([mockDraft]);
      return makeQueryChainMock();
    });

    await cleanupDraftsHandler(mockCtx as unknown as MutationCtx, {
      system: true,
    });

    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "auditLogs",
      expect.objectContaining({
        adminId: "SYSTEM",
        action: "CLEANUP_DRAFT_AUCTIONS",
      })
    );
  });

  it("should record authenticated actor in audit logs when system is false", async () => {
    const mockDraft = {
      _id: "draft_123",
      status: "draft",
      _creationTime: Date.now() - 31 * 24 * 60 * 60 * 1000,
      images: { front: "storage_front" },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUser: any = {
      userId: "admin_user_id",
      email: "admin@example.com",
    };

    vi.mocked(auth.getAuthUser).mockResolvedValue(mockUser);

    mockCtx.db.query = vi.fn().mockImplementation((table) => {
      if (table === "auctions") return makeQueryChainMock([mockDraft]);
      return makeQueryChainMock();
    });

    await cleanupDraftsHandler(mockCtx as unknown as MutationCtx, {
      system: false,
    });

    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "auditLogs",
      expect.objectContaining({
        adminId: "admin_user_id",
        action: "CLEANUP_DRAFT_AUCTIONS",
      })
    );
  });

  it("should do nothing if no old drafts exist", async () => {
    mockCtx.db.query = vi.fn().mockImplementation((table) => {
      if (table === "auctions") {
        return makeQueryChainMock([]);
      }
      return makeQueryChainMock();
    });

    await cleanupDraftsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.storage.delete).not.toHaveBeenCalled();
    expect(mockCtx.db.delete).not.toHaveBeenCalled();
  });
});
