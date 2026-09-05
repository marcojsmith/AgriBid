import { describe, it, expect, vi, beforeEach } from "vitest";

import { getAuctionFlagsHandler, getAllPendingFlagsHandler } from "./admin";
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

  describe("getAuctionFlagsHandler", () => {
    const setupDbMocks = (
      mockFlags: Doc<"auctionFlags">[],
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
          auctionId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
      ] as Doc<"auctionFlags">[];

      setupDbMocks(mockFlags, {
        _id: "p2",
        userId: "u2",
        name: "John Doe",
      } as unknown as Doc<"profiles">);

      const result = await getAuctionFlagsHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result).toHaveLength(1);
      expect(result[0].reporterName).toBe("John Doe");
    });

    it("should return Unknown User when reporter not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockFlags = [
        {
          _id: "f1",
          auctionId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
      ] as Doc<"auctionFlags">[];

      setupDbMocks(mockFlags, null);

      const result = await getAuctionFlagsHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result).toHaveLength(1);
      expect(result[0].reporterName).toBe("Unknown User");
    });

    it("should return Unknown User when reporter has no name", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockFlags = [
        {
          _id: "f1",
          auctionId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
      ] as Doc<"auctionFlags">[];

      setupDbMocks(mockFlags, {
        _id: "p2",
        userId: "u2",
      } as unknown as Doc<"profiles">);

      const result = await getAuctionFlagsHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result).toHaveLength(1);
      expect(result[0].reporterName).toBe("Unknown User");
    });

    it("should handle duplicate reporterIds efficiently", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockFlags = [
        {
          _id: "f1",
          auctionId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
        {
          _id: "f2",
          auctionId: "a1",
          reporterId: "u2",
          reason: "inappropriate",
          status: "reviewed",
          createdAt: Date.now(),
        },
      ] as Doc<"auctionFlags">[];

      const mockProfileQuery = setupDbMocks(mockFlags, {
        _id: "p2",
        userId: "u2",
        name: "Reporter Name",
      } as unknown as Doc<"profiles">);

      const result = await getAuctionFlagsHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

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
        getAuctionFlagsHandler(mockCtx as unknown as QueryCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
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
          auctionId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
      ] as Doc<"auctionFlags">[];

      const mockQuery = {
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
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

      expect(result).toHaveLength(1);
      expect(result[0].auctionTitle).toBe("Test Auction");
      expect(result[0].reporterName).toBe("Reporter Name");
    });

    it("should return Unknown Auction when auction not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "u1" });

      const mockFlags = [
        {
          _id: "f1",
          auctionId: "a1",
          reporterId: "u2",
          reason: "misleading",
          status: "pending",
          createdAt: Date.now(),
        },
      ] as Doc<"auctionFlags">[];

      const mockQuery = {
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
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

      expect(result).toHaveLength(1);
      expect(result[0].auctionTitle).toBe("Unknown Auction");
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
