/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import {
  addEquipmentMakeHandler,
  addModelToMakeHandler,
} from "./equipmentMetadata";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getCallerRole: vi.fn(),
  requireAdmin: vi.fn(),
}));

describe("Equipment Metadata Backend", () => {
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

  it("should create a new equipment make when called by admin", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
    mockCtx.db.insert.mockResolvedValue("make_123");

    const result = await addEquipmentMakeHandler(mockCtx, {
      make: "John Deere",
      models: ["8R"],
      categoryId: "cat_123" as Id<"equipmentCategories">,
    });

    expect(result).toBe("make_123");
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "equipmentMetadata",
      expect.objectContaining({
        make: "John Deere",
        models: ["8R"],
        categoryId: "cat_123",
        isActive: true,
      })
    );
  });

  it("should add a model to an existing make", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
    const existingMake = {
      _id: "make_123",
      make: "John Deere",
      models: ["8R"],
      categoryId: "cat_123",
      isActive: true,
    };
    mockCtx.db.get.mockResolvedValue(existingMake);

    await addModelToMakeHandler(mockCtx, {
      id: "make_123" as Id<"equipmentMetadata">,
      model: "7R",
    });

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "make_123",
      expect.objectContaining({
        models: ["8R", "7R"],
      })
    );
  });

  it("should throw an error if a duplicate make name exists in the same category", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        _id: "make_456",
        make: "John Deere",
        isActive: true,
      }),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      addEquipmentMakeHandler(mockCtx, {
        make: "John Deere",
        models: ["8R"],
        categoryId: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(ConvexError);
  });
});
