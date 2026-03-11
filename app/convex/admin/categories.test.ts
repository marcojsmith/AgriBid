/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { addCategoryHandler } from "./categories";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";

vi.mock("../lib/auth", () => ({
  getCallerRole: vi.fn(),
  requireAdmin: vi.fn(),
}));

describe("Categories Backend", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (mockQuery: any) => {
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

  it("should create a new category when called by admin", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
    mockCtx.db.insert.mockResolvedValue("cat_123");

    const result = await addCategoryHandler(mockCtx, {
      name: "Tractors",
    });

    expect(result).toBe("cat_123");
    expect(mockCtx.db.insert).toHaveBeenCalledWith("equipmentCategories", {
      name: "Tractors",
      isActive: true,
    });
  });

  it("should throw an error if a duplicate category name exists", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        _id: "cat_456",
        name: "Tractors",
        isActive: true,
      }),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      addCategoryHandler(mockCtx, {
        name: "Tractors",
      })
    ).rejects.toThrow(ConvexError);
    // expect specific message
    try {
      await addCategoryHandler(mockCtx, {
        name: "Tractors",
      });
    } catch (e: unknown) {
      if (e instanceof ConvexError) {
        expect(e.data).toBe("Category already exists");
      } else {
        throw e;
      }
    }
  });

  it("should reject non-admin requests", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(
      addCategoryHandler(mockCtx, {
        name: "Tractors",
      })
    ).rejects.toThrow(/Unauthorized: Admin access required/);
  });
});
