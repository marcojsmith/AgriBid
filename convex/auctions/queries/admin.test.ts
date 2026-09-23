import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getLotFlagsHandler,
  getAllPendingFlagsHandler,
  getPendingLotsHandler,
} from "./admin";
import { ADMIN_COLLECTION_CAP } from "../../constants";
import * as auth from "../../lib/auth";
import type { QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";

vi.mock("../../lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../../admin_utils", () => ({
  countQuery: vi.fn(),
}));

describe("Admin Queries - Auction Flags", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        query: vi.fn(),
      },
    };
  });

  describe("getLotFlagsHandler", () => {
    const setupDbMocks = (
      mockFlags: Doc<"lotFlags">[],
      reporterProfile: unknown
    ) => {
      const mockFlagsQuery = {
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue(mockFlags),
      };
      const mockProfileQuery = {
        withIndex: vi.fn().mockReturnThis(),
        unique: vi.fn().mockResolvedValue(reporterProfile),
      };
      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "profiles") return mockProfileQuery;
        return mockFlagsQuery;
      });
      return mockProfileQuery;
    };

    it("should return flags with reporter name when reporter found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockFlags = [
        {
          _id: "f1",
          lotId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
      ] as Doc<"lotFlags">[];

      setupDbMocks(mockFlags, {
        _id: "p2",
        userId: "u2",
        name: "John Doe",
      } as unknown as Doc<"profiles">);

      const result = await getLotFlagsHandler(mockCtx as unknown as QueryCtx, {
        lotId: "a1" as Id<"lots">,
      });

      expect(result).toHaveLength(1);
      expect(result[0].reporterName).toBe("John Doe");
    });

    it("should return Unknown User when reporter not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockFlags = [
        {
          _id: "f1",
          lotId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
      ] as Doc<"lotFlags">[];

      setupDbMocks(mockFlags, null);

      const result = await getLotFlagsHandler(mockCtx as unknown as QueryCtx, {
        lotId: "a1" as Id<"lots">,
      });

      expect(result).toHaveLength(1);
      expect(result[0].reporterName).toBe("Unknown User");
    });

    it("should return Unknown User when reporter has no name", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockFlags = [
        {
          _id: "f1",
          lotId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
      ] as Doc<"lotFlags">[];

      setupDbMocks(mockFlags, {
        _id: "p2",
        userId: "u2",
      } as unknown as Doc<"profiles">);

      const result = await getLotFlagsHandler(mockCtx as unknown as QueryCtx, {
        lotId: "a1" as Id<"lots">,
      });

      expect(result).toHaveLength(1);
      expect(result[0].reporterName).toBe("Unknown User");
    });

    it("should handle duplicate reporterIds efficiently", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockFlags = [
        {
          _id: "f1",
          lotId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
        {
          _id: "f2",
          lotId: "a1",
          reporterId: "u2",
          reason: "inappropriate",
          status: "reviewed",
          createdAt: Date.now(),
        },
      ] as Doc<"lotFlags">[];

      const mockProfileQuery = setupDbMocks(mockFlags, {
        _id: "p2",
        userId: "u2",
        name: "Reporter Name",
      } as unknown as Doc<"profiles">);

      const result = await getLotFlagsHandler(mockCtx as unknown as QueryCtx, {
        lotId: "a1" as Id<"lots">,
      });

      expect(result).toHaveLength(2);
      expect(result[0].reporterName).toBe("Reporter Name");
      expect(result[1].reporterName).toBe("Reporter Name");
      expect(mockProfileQuery.unique).toHaveBeenCalledTimes(1);
    });

    it("should throw unauthorized error when user is not admin", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValueOnce(
        new Error("unauthorized")
      );

      await expect(
        getLotFlagsHandler(mockCtx as unknown as QueryCtx, {
          lotId: "a1" as Id<"lots">,
        })
      ).rejects.toThrow("unauthorized");

      expect(auth.requireAdmin).toHaveBeenCalled();
    });
  });

  describe("getPendingLotsHandler", () => {
    it("requires admin and returns capped pending lot summaries", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockLots = [
        {
          _id: "l1",
          status: "pending_review",
          images: {},
        },
      ] as unknown as Doc<"lots">[];

      const lotsQuery = {
        withIndex: vi.fn().mockReturnThis(),
        take: vi.fn().mockResolvedValue(mockLots),
      };
      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "lots") return lotsQuery;
        return { get: vi.fn() };
      });

      const result = await getPendingLotsHandler(
        mockCtx as unknown as QueryCtx
      );

      expect(auth.requireAdmin).toHaveBeenCalled();
      // The moderation queue is capped so it can't blow up as the table grows.
      expect(lotsQuery.take).toHaveBeenCalledWith(ADMIN_COLLECTION_CAP + 1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]._id).toBe("l1");
      expect(result.isTruncated).toBe(false);
    });

    it("marks the pending lot queue as truncated without returning more than the cap", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockLots = Array.from(
        { length: ADMIN_COLLECTION_CAP + 1 },
        (_, index) => ({
          _id: `l${String(index)}`,
          status: "pending_review",
          images: {},
        })
      ) as unknown as Doc<"lots">[];
      const lotsQuery = {
        withIndex: vi.fn().mockReturnThis(),
        take: vi.fn().mockResolvedValue(mockLots),
      };
      mockCtx.db.query.mockReturnValue(lotsQuery);

      const result = await getPendingLotsHandler(
        mockCtx as unknown as QueryCtx
      );

      expect(result.items).toHaveLength(ADMIN_COLLECTION_CAP);
      expect(result.isTruncated).toBe(true);
    });

    it("throws when the caller is not an admin", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValueOnce(
        new Error("unauthorized")
      );

      await expect(
        getPendingLotsHandler(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow("unauthorized");

      expect(auth.requireAdmin).toHaveBeenCalled();
    });
  });

  describe("getAllPendingFlagsHandler", () => {
    it("should return flags with auction title when auction found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockFlags = [
        {
          _id: "f1",
          lotId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
      ] as Doc<"lotFlags">[];

      const mockQuery = {
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        take: vi.fn().mockResolvedValue(mockFlags),
        collect: vi.fn().mockResolvedValue(mockFlags),
      };
      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            unique: vi.fn().mockResolvedValue({
              _id: "p2",
              userId: "u2",
              name: "Reporter Name",
            } as unknown as Doc<"profiles">),
          };
        }
        return mockQuery;
      });

      mockCtx.db.get.mockResolvedValue({ title: "Test Auction" });

      const result = await getAllPendingFlagsHandler(
        mockCtx as unknown as QueryCtx
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].lotTitle).toBe("Test Auction");
      expect(result.items[0].reporterName).toBe("Reporter Name");
      expect(result.isTruncated).toBe(false);
    });

    it("should return Unknown Auction when auction not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockFlags = [
        {
          _id: "f1",
          lotId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
      ] as Doc<"lotFlags">[];

      const mockQuery = {
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        take: vi.fn().mockResolvedValue(mockFlags),
        collect: vi.fn().mockResolvedValue(mockFlags),
      };
      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            unique: vi.fn().mockResolvedValue({
              _id: "p2",
              userId: "u2",
              name: "Reporter Name",
            } as unknown as Doc<"profiles">),
          };
        }
        return mockQuery;
      });

      mockCtx.db.get.mockResolvedValue(null);

      const result = await getAllPendingFlagsHandler(
        mockCtx as unknown as QueryCtx
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].lotTitle).toBe("Unknown Auction");
    });

    it("marks the pending flag queue as truncated without returning more than the cap", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockFlags = Array.from(
        { length: ADMIN_COLLECTION_CAP + 1 },
        (_, index) => ({
          _id: `f${String(index)}`,
          lotId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        })
      ) as unknown as Doc<"lotFlags">[];
      const mockQuery = {
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        take: vi.fn().mockResolvedValue(mockFlags),
      };
      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            unique: vi.fn().mockResolvedValue(null),
          };
        }
        return mockQuery;
      });
      mockCtx.db.get.mockResolvedValue(null);

      const result = await getAllPendingFlagsHandler(
        mockCtx as unknown as QueryCtx
      );

      expect(mockQuery.take).toHaveBeenCalledWith(ADMIN_COLLECTION_CAP + 1);
      expect(result.items).toHaveLength(ADMIN_COLLECTION_CAP);
      expect(result.isTruncated).toBe(true);
    });

    it("should throw unauthorized error when user is not admin", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValueOnce(
        new Error("unauthorized")
      );

      await expect(
        getAllPendingFlagsHandler(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow("unauthorized");

      expect(auth.requireAdmin).toHaveBeenCalled();
    });
  });
});
