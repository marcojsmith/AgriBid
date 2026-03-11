
import { describe, it, expect, vi, beforeEach } from "vitest";

import { cleanupDraftsHandler } from "./internal";
import type { MutationCtx } from "../_generated/server";

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

type MockCtxType = {
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
};

describe("Internal Logic Coverage", () => {
  let mockCtx: MockCtxType;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue([]),
        })),
        delete: vi.fn(),
        insert: vi.fn(),
        patch: vi.fn(),
      },
      storage: {
        delete: vi.fn(),
      },
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue(null),
      },
    };
  });

  describe("cleanupDraftsHandler errors", () => {
    it("should handle storage.delete failure", async () => {
      const mockDraft = {
        _id: "d1",
        status: "draft",
        conditionReportUrl: "s1",
        images: {},
      };
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([mockDraft]),
      });
      mockCtx.storage.delete.mockRejectedValue(new Error("Storage delete failed"));
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await cleanupDraftsHandler(mockCtx as unknown as MutationCtx);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Failed to delete condition report"), expect.anything());
      expect(mockCtx.db.delete).toHaveBeenCalledWith("d1");
      
      spy.mockRestore();
    });

    it("should handle db.delete failure", async () => {
      const mockDraft = {
        _id: "d1",
        status: "draft",
        images: {},
      };
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([mockDraft]),
      });
      mockCtx.db.delete.mockRejectedValue(new Error("DB delete failed"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await cleanupDraftsHandler(mockCtx as unknown as MutationCtx);

      expect(result.errors).toBe(1);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Failed to delete draft auction"), expect.anything());
      
      spy.mockRestore();
    });
  });

});
