import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../../lib/auth";
import {
  publishAuctionHandler,
  flagAuctionHandler,
  dismissFlagHandler,
  approveAuctionHandler,
  rejectAuctionHandler,
  closeAuctionEarlyHandler,
} from "./publish";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

// helper types for mocking
interface MockCtxType {
  db: {
    get: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    normalizeId: ReturnType<typeof vi.fn>;
  };
  storage: {
    generateUploadUrl: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getUrl: ReturnType<typeof vi.fn>;
  };
}

let mockCtx: MockCtxType;

vi.mock("../../lib/auth", () => {
  class UnauthorizedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnauthorizedError";
    }
  }
  return {
    getAuthenticatedUserId: vi.fn(),
    requireAdmin: vi.fn(),
    tryRequireAdmin: vi.fn(),
    requireAuth: vi.fn(),
    requireVerified: vi.fn(),
    getCallerRole: vi.fn(),
    getAuthUser: vi.fn(),
    resolveUserId: vi.fn(),
    UnauthorizedError,
  };
});

vi.mock("../../admin_utils", () => ({
  updateCounter: vi.fn(),
  adjustStatusCounters: vi.fn(),
  logAudit: vi.fn(),
}));

const createMockProfile = (userId: string, role: string) => ({
  userId,
  role,
  _id: "p1" as Id<"profiles">,
  _creationTime: Date.now(),
  isVerified: role === "verified" || role === "admin",
});

describe("Publish Mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        insert: vi.fn().mockResolvedValue("id"),
        patch: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(),
        normalizeId: vi.fn().mockImplementation((_table, id) => id),
      },
      storage: {
        generateUploadUrl: vi.fn().mockResolvedValue("url"),
        delete: vi.fn().mockResolvedValue(undefined),
        getUrl: vi.fn().mockResolvedValue("url"),
      },
    };

    // Default auth mocks
    vi.mocked(auth.requireAuth).mockResolvedValue({
      userId: "u1",
      _id: "u1",
    } as {
      userId: string;
      _id: string;
    });
    vi.mocked(auth.requireVerified).mockResolvedValue({
      userId: "u1",
      profile: createMockProfile("u1", "verified") as Doc<"profiles">,
    });
    vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
      authorized: true,
      user: { userId: "u1", _id: "u1" },
    });
  });

  describe("publishAuctionHandler", () => {
    it("should throw if auction not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        publishAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("should publish draft successfully", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        title: "Title",
        description: "Desc",
        startingPrice: 100,
        reservePrice: 200,
        images: { front: "img1" },
      } as Doc<"auctions">);

      const result = await publishAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("a1", {
        status: "pending_review",
      });
    });

    it("should handle array-based image validation in publish", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        title: "Title",
        description: "Desc",
        startingPrice: 100,
        reservePrice: 200,
        images: ["img1"], // Legacy array format
      } as unknown as Doc<"auctions">);

      const result = await publishAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
    });

    it("should throw if not draft", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "active",
      } as Doc<"auctions">);

      await expect(
        publishAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only draft auctions can be published");
    });
  });

  describe("flagAuctionHandler", () => {
    it("should flag auction", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", sellerId: "u2" });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([]),
      });

      const result = await flagAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auctionFlags",
        expect.objectContaining({ reason: "misleading" })
      );
    });

    it("should throw if flagging own auction", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", sellerId: userId });
      await expect(
        flagAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        })
      ).rejects.toThrow("You cannot flag your own auction");
    });

    it("should throw if already flagged", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", sellerId: "u2" });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi
          .fn()
          .mockResolvedValue([{ reporterId: userId, status: "pending" }]),
      });
      await expect(
        flagAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        })
      ).rejects.toThrow("You have already flagged this auction");
    });

    it("should auto-hide if threshold reached", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "u2",
        status: "active",
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { reporterId: "u3", status: "pending" },
          { reporterId: "u4", status: "pending" },
        ]),
      });

      const result = await flagAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        }
      );
      expect(result.hideTriggered).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("a1", {
        status: "pending_review",
        hiddenByFlags: true,
      });
    });
  });

  describe("dismissFlagHandler", () => {
    it("should dismiss flag", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue("admin-id");
      mockCtx.db.get.mockResolvedValue({
        _id: "f1",
        status: "pending",
        auctionId: "a1",
        reason: "other",
      });

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        { flagId: "f1" as Id<"auctionFlags"> }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("f1", {
        status: "dismissed",
      });
    });

    it("should restore auction if flags below threshold", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get
        .mockResolvedValueOnce({
          _id: "f1",
          status: "pending",
          auctionId: "a1",
          reason: "other",
        }) // flag
        .mockResolvedValueOnce({
          _id: "a1",
          status: "pending_review",
          hiddenByFlags: true,
        }); // auction

      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([]), // no more pending flags
      });

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        { flagId: "f1" as Id<"auctionFlags"> }
      );
      expect(result.auctionRestored).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("a1", {
        status: "active",
        hiddenByFlags: false,
      });
    });

    it("should throw if not admin", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("user");
      await expect(
        dismissFlagHandler(mockCtx as unknown as MutationCtx, {
          flagId: "f1" as Id<"auctionFlags">,
        })
      ).rejects.toThrow("Admin privileges required");
    });
  });

  describe("approveAuctionHandler", () => {
    it("should approve auction", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
        durationDays: 7,
      });

      const result = await approveAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          status: "active",
        })
      );
    });
  });

  describe("rejectAuctionHandler", () => {
    it("should reject auction", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
      });

      const result = await rejectAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          status: "rejected",
        })
      );
    });
  });

  describe("closeAuctionEarlyHandler", () => {
    it("should close auction and determine winner", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "active",
        reservePrice: 1000,
        title: "Test",
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { amount: 1500, bidderId: "u2", status: "valid", timestamp: 100 },
          { amount: 1200, bidderId: "u3", status: "valid", timestamp: 110 },
        ]),
      });

      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(true);
      expect(result.finalStatus).toBe("sold");
      expect(result.winnerId).toBe("u2");
      expect(result.winningAmount).toBe(1500);
    });

    it("should close as unsold if no bids", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "active",
        reservePrice: 1000,
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([]),
      });

      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.finalStatus).toBe("unsold");
    });

    it("should handle same amount bids by timestamp", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "active",
        reservePrice: 1000,
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { amount: 1500, bidderId: "u2", status: "valid", timestamp: 120 },
          { amount: 1500, bidderId: "u3", status: "valid", timestamp: 110 },
        ]),
      });

      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.winnerId).toBe("u3"); // earlier timestamp
    });

    it("should return error if not authorized (via Error message)", async () => {
      vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
        authorized: false,
        error: "Not authorized",
      });
      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authorized");
      expect(mockCtx.db.get).not.toHaveBeenCalled();
      expect(mockCtx.db.query).not.toHaveBeenCalled();
      expect(mockCtx.db.patch).not.toHaveBeenCalled();
    });
  });
});