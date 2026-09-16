import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { deleteConditionReportHandler } from "./mutations/delete";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
}));

describe("deleteConditionReport mutation", () => {
  let mockCtx: MutationCtx;
  // Captured raw mock so assertions don't reference the deprecated
  // string-arg overload of MutationCtx["storage"]["delete"]
  let storageDeleteMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = () => {
    const mockDb = {
      get: vi.fn(),
      patch: vi.fn(),
    };
    const mockStorage = {
      delete: vi.fn(),
    };
    storageDeleteMock = mockStorage.delete;
    return {
      db: mockDb as unknown as MutationCtx["db"],
      storage: mockStorage as unknown as MutationCtx["storage"],
    } as unknown as MutationCtx;
  };

  it("should allow owner to delete condition report", async () => {
    const lotId = "a1" as Id<"lots">;
    const userId = "user1";
    const storageId = "s1" as Id<"_storage">;

    const auctionDoc = {
      _id: lotId,
      sellerId: userId,
      status: "draft",
      conditionReportUrl: storageId,
    };

    mockCtx = setupMockCtx();
    (mockCtx.db.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      auctionDoc
    );
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);

    const result = await deleteConditionReportHandler(mockCtx, { lotId });

    expect(result.success).toBe(true);
    expect(storageDeleteMock).toHaveBeenCalledWith(storageId);
    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      conditionReportUrl: undefined,
    });
  });

  it("should fail if not authorized (not owner)", async () => {
    const lotId = "a1" as Id<"lots">;
    const sellerId = "owner";
    const reporterId = "not_owner";

    const auctionDoc = {
      _id: lotId,
      sellerId,
      status: "draft",
    };

    mockCtx = setupMockCtx();
    (mockCtx.db.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      auctionDoc
    );
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(reporterId);

    await expect(
      deleteConditionReportHandler(mockCtx, { lotId })
    ).rejects.toThrow("You can only modify your own lots");
  });

  it("should fail if auction not found", async () => {
    mockCtx = setupMockCtx();
    (mockCtx.db.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user1");

    await expect(
      deleteConditionReportHandler(mockCtx, {
        lotId: "a1" as Id<"lots">,
      })
    ).rejects.toThrow(ConvexError);
  });
});
