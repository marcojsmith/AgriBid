import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  updateAuctionHandler,
  bulkUpdateAuctionsHandler,
  updateConditionReportHandler,
  adminUpdateAuctionHandler,
} from "./mutations/update";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
  getCallerRole: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  logAudit: vi.fn(),
  adjustStatusCounters: vi.fn(),
}));

describe("updateAuction mutation", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
        }),
      },
    };
  });

  it("should update the auction successfully if the user is the seller and auction is draft", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_123");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
      status: "draft",
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      updates: { title: "New Title" },
    };

    const result = await updateAuctionHandler(
      mockCtx as unknown as MutationCtx,
      args
    );

    expect(result.success).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith("auction_123", {
      title: "New Title",
    });
  });

  it("should throw an error if the user is not authenticated", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockRejectedValue(
      new Error("Not authenticated")
    );

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      updates: { title: "New Title" },
    };

    await expect(
      updateAuctionHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("Not authenticated");
  });

  it("should throw an error if the user is not the seller", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_other");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
      status: "draft",
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      updates: { title: "New Title" },
    };

    await expect(
      updateAuctionHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("You can only modify your own auctions");
  });

  it("should throw an error if the auction is not in draft or pending_review", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_123");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
      status: "active",
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      updates: { title: "New Title" },
    };

    await expect(
      updateAuctionHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("Only draft or pending_review auctions can be edited");
  });
});

describe("bulkUpdateAuctionsHandler", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
    };
    storage: {
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
        }),
      },
      storage: {
        delete: vi.fn(),
      },
    };
  });

  it("should use small increment when starting price is below threshold", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "admin1" });

    mockCtx.db.get.mockResolvedValue({
      _id: "auction_1",
      status: "draft",
      startingPrice: 500,
    });

    const args = {
      auctionIds: ["auction_1" as Id<"auctions">],
      updates: { startingPrice: 500 },
    };

    await bulkUpdateAuctionsHandler(mockCtx as unknown as MutationCtx, args);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "auction_1",
      expect.objectContaining({
        currentPrice: 500,
        minIncrement: 100,
      })
    );
  });
});

describe("updateConditionReportHandler", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
    };
    storage: {
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
        }),
      },
      storage: {
        delete: vi.fn().mockRejectedValue(new Error("Storage delete failed")),
      },
    };
  });

  it("should handle storage.delete failure gracefully", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_123");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
      status: "draft",
      conditionReportUrl: "storage_123",
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      storageId: "new_storage" as Id<"_storage">,
    };

    const result = await updateConditionReportHandler(
      mockCtx as unknown as MutationCtx,
      args
    );

    expect(result.success).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith("auction_123", {
      conditionReportUrl: "new_storage",
    });
  });
});

describe("adminUpdateAuctionHandler", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
        }),
      },
    };
  });

  it("should use large increment when starting price is above threshold", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "admin1" });

    mockCtx.db.get.mockResolvedValue({
      _id: "auction_1",
      status: "draft",
    });

    const args = {
      auctionId: "auction_1" as Id<"auctions">,
      updates: { startingPrice: 20000 },
    };

    await adminUpdateAuctionHandler(mockCtx as unknown as MutationCtx, args);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "auction_1",
      expect.objectContaining({
        currentPrice: 20000,
        minIncrement: 500,
      })
    );
  });
});
