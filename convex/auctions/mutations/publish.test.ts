import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../../lib/auth";
import {
  publishAuctionHandler,
  flagAuctionHandler,
  dismissFlagHandler,
  approveAuctionHandler,
  rejectAuctionHandler,
  closeAuctionEarlyHandler,
  submitForReview,
  publishAuction,
  flagAuction,
  dismissFlag,
  approveAuction,
  rejectAuction,
  closeAuctionEarly,
} from "./publish";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

vi.mock("../../_generated/server", () => ({
  mutation: vi.fn((config) => config),
  query: vi.fn((config) => config),
  internalMutation: vi.fn((config) => config),
}));

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
const mockQ = {
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  field: vi.fn((f) => f),
};

const queryMock = {
  withIndex: vi.fn((_name, cb) => {
    if (typeof cb === "function") cb(mockQ);
    return queryMock;
  }),
  collect: vi.fn().mockResolvedValue([]),
};

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

const { calculateAndRecordFees } = vi.hoisted(() => ({
  calculateAndRecordFees: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../internal", () => ({
  calculateAndRecordFees,
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
        query: vi.fn().mockReturnValue(queryMock),
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

  describe("Exports and Registration", () => {
    it("should export all mutations with correct handlers", () => {
      expect(submitForReview).toBeDefined();
      expect(publishAuction).toBeDefined();
      expect(flagAuction).toBeDefined();
      expect(dismissFlag).toBeDefined();
      expect(approveAuction).toBeDefined();
      expect(rejectAuction).toBeDefined();
      expect(closeAuctionEarly).toBeDefined();

      // Basic sanity check that they point to the right handlers
      // In Convex, mutation objects have a handler property if they are created via mutation({..., handler})
      const getHandler = (m: unknown) => (m as { handler: unknown }).handler;

      expect(getHandler(submitForReview)).toBe(publishAuctionHandler);
      expect(getHandler(publishAuction)).toBe(publishAuctionHandler);
      expect(getHandler(flagAuction)).toBe(flagAuctionHandler);
      expect(getHandler(dismissFlag)).toBe(dismissFlagHandler);
      expect(getHandler(approveAuction)).toBe(approveAuctionHandler);
      expect(getHandler(rejectAuction)).toBe(rejectAuctionHandler);
      expect(getHandler(closeAuctionEarly)).toBe(closeAuctionEarlyHandler);
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

    it("should flag auction with null status when auction status is undefined", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "u2",
        status: undefined,
      });

      const result = await flagAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        }
      );
      expect(result.success).toBe(true);
    });

    it("should not auto-hide when flags below threshold", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "u2",
        status: "active",
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi
          .fn()
          .mockResolvedValue([{ reporterId: "u3", status: "pending" }]),
      });

      const result = await flagAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        }
      );
      expect(result.hideTriggered).toBe(false);
      expect(mockCtx.db.patch).not.toHaveBeenCalled();
    });

    it("should auto-hide when flags reach threshold", async () => {
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

    it("should not restore auction when remaining flags still above threshold", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get
        .mockResolvedValueOnce({
          _id: "f1",
          status: "pending",
          auctionId: "a1",
          reason: "other",
        })
        .mockResolvedValueOnce({
          _id: "a1",
          status: "pending_review",
          hiddenByFlags: true,
        });

      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { reporterId: "u2", status: "pending" },
          { reporterId: "u3", status: "pending" },
          { reporterId: "u4", status: "pending" },
        ]),
      });

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        { flagId: "f1" as Id<"auctionFlags"> }
      );
      expect(result.auctionRestored).toBe(false);
    });

    it("should not restore auction when hiddenByFlags is false", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get
        .mockResolvedValueOnce({
          _id: "f1",
          status: "pending",
          auctionId: "a1",
          reason: "other",
        })
        .mockResolvedValueOnce({
          _id: "a1",
          status: "pending_review",
          hiddenByFlags: false,
        });

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        { flagId: "f1" as Id<"auctionFlags"> }
      );
      expect(result.auctionRestored).toBe(false);
      expect(mockCtx.db.query).not.toHaveBeenCalled();
    });

    it("should not restore auction when status is not pending_review", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get
        .mockResolvedValueOnce({
          _id: "f1",
          status: "pending",
          auctionId: "a1",
          reason: "other",
        })
        .mockResolvedValueOnce({
          _id: "a1",
          status: "active",
          hiddenByFlags: true,
        });

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        { flagId: "f1" as Id<"auctionFlags"> }
      );
      expect(result.auctionRestored).toBe(false);
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

    it("should throw if duration below minimum", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
        durationDays: 7,
      });

      await expect(
        approveAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          durationDays: 0,
        })
      ).rejects.toThrow("Invalid duration");
    });

    it("should throw if duration above maximum", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
        durationDays: 7,
      });

      await expect(
        approveAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          durationDays: 400,
        })
      ).rejects.toThrow("Invalid duration");
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

    it("should throw if auction not in pending_review", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "active",
      });

      await expect(
        rejectAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only auctions in pending_review can be rejected");
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

    it("should close as unsold when reserve not met", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "active",
        reservePrice: 2000,
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi
          .fn()
          .mockResolvedValue([
            { amount: 1500, bidderId: "u2", status: "valid", timestamp: 100 },
          ]),
      });

      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.finalStatus).toBe("unsold");
      expect(result.winnerId).toBeUndefined();
    });

    it("should filter out voided bids when determining winner", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "active",
        reservePrice: 1000,
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { amount: 1500, bidderId: "u2", status: "voided", timestamp: 100 },
          { amount: 1200, bidderId: "u3", status: "valid", timestamp: 110 },
        ]),
      });

      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.finalStatus).toBe("sold");
      expect(result.winnerId).toBe("u3");
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

    it("should return error if closeAuctionEarlyHandler receives non-active auction", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "sold",
        reservePrice: 1000,
        title: "Test",
      });

      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Auction has already been settled");
    });
  });
});
