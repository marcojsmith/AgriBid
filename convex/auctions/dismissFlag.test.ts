/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { dismissFlagHandler } from "./mutations";
import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getCallerRole: vi.fn(),
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

describe("dismissFlag mutation", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (mockQuery: any = {}) => {
    const mockDb = {
      get: vi.fn(),
      patch: vi.fn(),
      insert: vi.fn(),
      query: vi.fn(() => mockQuery),
    };
    return {
      db: mockDb as any,
    } as unknown as MutationCtx;
  };

  it("should allow an admin to dismiss a flag and restore the auction", async () => {
    const flagId = "flag123" as Id<"auctionFlags">;
    const auctionId = "auction123" as Id<"auctions">;
    
    const flagDoc = {
      _id: flagId,
      auctionId,
      status: "pending",
      reason: "other",
    };

    const auctionDoc = {
      _id: auctionId,
      status: "pending_review",
      hiddenByFlags: true,
    };

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]), // Remaining flags < threshold
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockImplementation(async (id: any) => {
      if (id === flagId) return flagDoc;
      if (id === auctionId) return auctionDoc;
      return null;
    });

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
    vi.mocked(auth.getAuthUser).mockResolvedValue({ userId: "admin123" } as any);
    vi.mocked(auth.resolveUserId).mockReturnValue("admin123");

    const result = await dismissFlagHandler(mockCtx, {
      flagId,
      dismissalReason: "Not valid",
    });

    expect(result.success).toBe(true);
    expect(result.auctionRestored).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith(flagId, { status: "dismissed" });
    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "active",
      hiddenByFlags: false,
    });
    expect(adminUtils.updateCounter).toHaveBeenCalledWith(mockCtx, "auctions", "pending", -1);
    expect(adminUtils.updateCounter).toHaveBeenCalledWith(mockCtx, "auctions", "active", 1);
    expect(adminUtils.logAudit).toHaveBeenCalledWith(mockCtx, expect.objectContaining({
      action: "DISMISS_FLAG",
    }));
  });

  it("should fail if not an admin", async () => {
    mockCtx = setupMockCtx();
    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(dismissFlagHandler(mockCtx, { flagId: "f1" as any }))
      .rejects.toThrow("Not authorized: Admin privileges required");
  });

  it("should throw error if flag not found", async () => {
    const flagId = "flag123" as Id<"auctionFlags">;
    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(null);
    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(dismissFlagHandler(mockCtx, { flagId }))
      .rejects.toThrow(ConvexError);
  });

  it("should fail if flag is already reviewed", async () => {
    const flagId = "flag123" as Id<"auctionFlags">;
    const flagDoc = {
      _id: flagId,
      status: "dismissed",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(flagDoc);
    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(dismissFlagHandler(mockCtx, { flagId }))
      .rejects.toThrow("Flag has already been reviewed");
  });
});
