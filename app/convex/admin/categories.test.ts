/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import {
  addCategoryHandler,
  updateCategory,
  deleteCategory,
  fixMetadata,
} from "./categories";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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

  it("should reactivate an inactive category if it exists", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        _id: "cat_inactive",
        name: "Tractors",
        isActive: false,
      }),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await addCategoryHandler(mockCtx, {
      name: "Tractors",
    });

    expect(result).toBe("cat_inactive");
    expect(mockCtx.db.patch).toHaveBeenCalledWith("cat_inactive", {
      isActive: true,
    });
    expect(mockCtx.db.insert).not.toHaveBeenCalled();
  });
});

describe("updateCategory", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (mockQuery: any, getResponse?: any) => {
    const mockDb = {
      get: vi.fn().mockResolvedValue(getResponse),
      patch: vi.fn(),
      query: vi.fn(() => mockQuery),
    };
    return {
      db: mockDb as any,
    } as unknown as MutationCtx;
  };

  it("should update category name successfully", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    const existingCategory = {
      _id: "cat_123" as Id<"equipmentCategories">,
      name: "Old Name",
      isActive: true,
    };
    mockCtx = setupMockCtx(mockQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await updateCategory.handler(mockCtx, {
      id: "cat_123" as Id<"equipmentCategories">,
      name: "New Name",
    });

    expect(mockCtx.db.patch).toHaveBeenCalledWith("cat_123", {
      name: "New Name",
    });
  });

  it("should throw error if category not found", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery, null);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateCategory.handler(mockCtx, {
        id: "cat_nonexistent" as Id<"equipmentCategories">,
        name: "New Name",
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if name is empty", async () => {
    const existingCategory = {
      _id: "cat_123" as Id<"equipmentCategories">,
      name: "Old Name",
      isActive: true,
    };
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateCategory.handler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
        name: "   ",
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if duplicate name exists", async () => {
    const existingCategory = {
      _id: "cat_123" as Id<"equipmentCategories">,
      name: "Old Name",
      isActive: true,
    };
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        _id: "cat_456",
        name: "Duplicate",
        isActive: true,
      }),
    };
    mockCtx = setupMockCtx(mockQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateCategory.handler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
        name: "Duplicate",
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should handle inactive duplicate with informative message", async () => {
    const existingCategory = {
      _id: "cat_123" as Id<"equipmentCategories">,
      name: "Old Name",
      isActive: true,
    };
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        _id: "cat_456",
        name: "Duplicate",
        isActive: false,
      }),
    };
    mockCtx = setupMockCtx(mockQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateCategory.handler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
        name: "Duplicate",
      })
    ).rejects.toThrow(/already exists but is currently inactive/);
  });

  it("should reject non-admin users", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery, {});

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(
      updateCategory.handler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
        name: "New Name",
      })
    ).rejects.toThrow(/Unauthorized: Admin access required/);
  });
});

describe("deleteCategory", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (
    equipmentQuery: any,
    auctionQuery: any,
    getResponse?: any
  ) => {
    const mockDb = {
      get: vi.fn().mockResolvedValue(getResponse),
      patch: vi.fn(),
      query: vi.fn((table: string) => {
        if (table === "equipmentMetadata") return equipmentQuery;
        if (table === "auctions") return auctionQuery;
        return equipmentQuery;
      }),
    };
    return {
      db: mockDb as any,
    } as unknown as MutationCtx;
  };

  it("should soft delete category successfully", async () => {
    const equipmentQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    const auctionQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    const existingCategory = {
      _id: "cat_123" as Id<"equipmentCategories">,
      name: "Tractors",
      isActive: true,
    };
    mockCtx = setupMockCtx(equipmentQuery, auctionQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await deleteCategory.handler(mockCtx, {
      id: "cat_123" as Id<"equipmentCategories">,
    });

    expect(mockCtx.db.patch).toHaveBeenCalledWith("cat_123", {
      isActive: false,
    });
  });

  it("should throw error if category not found", async () => {
    const equipmentQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    const auctionQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(equipmentQuery, auctionQuery, null);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      deleteCategory.handler(mockCtx, {
        id: "cat_nonexistent" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if category is in use by equipment metadata", async () => {
    const equipmentQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ _id: "meta_123" }),
    };
    const auctionQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    const existingCategory = {
      _id: "cat_123" as Id<"equipmentCategories">,
      name: "Tractors",
      isActive: true,
    };
    mockCtx = setupMockCtx(equipmentQuery, auctionQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      deleteCategory.handler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(/currently in use by equipment catalog items/);
  });

  it("should throw error if category is linked to auctions", async () => {
    const equipmentQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    const auctionQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ _id: "auction_123" }),
    };
    const existingCategory = {
      _id: "cat_123" as Id<"equipmentCategories">,
      name: "Tractors",
      isActive: true,
    };
    mockCtx = setupMockCtx(equipmentQuery, auctionQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      deleteCategory.handler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(/currently linked to auction listings/);
  });

  it("should reject non-admin users", async () => {
    const equipmentQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    const auctionQuery = {
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(equipmentQuery, auctionQuery, {});

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(
      deleteCategory.handler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(/Unauthorized: Admin access required/);
  });
});

describe("fixMetadata", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = () => {
    const mockDb = {
      query: vi.fn((table: string) => {
        const baseQuery = {
          collect: vi.fn(),
        };

        if (table === "equipmentCategories") {
          baseQuery.collect.mockResolvedValue([
            { _id: "cat_1", name: "Tractors" },
            { _id: "cat_2", name: "Harvesters" },
          ]);
        } else if (table === "equipmentMetadata") {
          baseQuery.collect.mockResolvedValue([
            {
              _id: "meta_1",
              make: "John Deere",
              models: ["8R"],
              category: "Tractors",
              categoryId: undefined,
            },
            {
              _id: "meta_2",
              make: "Case IH",
              models: ["Magnum"],
              category: "Harvesters",
              categoryId: undefined,
            },
          ]);
        } else if (table === "auctions") {
          baseQuery.collect.mockResolvedValue([
            {
              _id: "auction_1",
              make: "John Deere",
              model: "8R",
              categoryId: undefined,
            },
            {
              _id: "auction_2",
              make: "Case IH",
              model: "Magnum",
              categoryId: undefined,
            },
          ]);
        }

        return baseQuery;
      }),
      patch: vi.fn(),
    };
    return {
      db: mockDb as any,
    } as unknown as MutationCtx;
  };

  it("should fix metadata and auctions successfully", async () => {
    mockCtx = setupMockCtx();

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await fixMetadata.handler(mockCtx, {});

    expect(result.categoriesCount).toBe(2);
    expect(result.metadataFixed).toBe(2);
    expect(result.auctionsFixed).toBe(2);
    expect(mockCtx.db.patch).toHaveBeenCalled();
  });

  it("should reject non-admin users", async () => {
    mockCtx = setupMockCtx();

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(fixMetadata.handler(mockCtx, {})).rejects.toThrow(
      /Unauthorized: Admin access required/
    );
  });

  it("should handle metadata with no category mapping", async () => {
    const mockDb = {
      query: vi.fn((table: string) => {
        const baseQuery = {
          collect: vi.fn(),
        };

        if (table === "equipmentCategories") {
          baseQuery.collect.mockResolvedValue([
            { _id: "cat_1", name: "Tractors" },
          ]);
        } else if (table === "equipmentMetadata") {
          baseQuery.collect.mockResolvedValue([
            {
              _id: "meta_1",
              make: "Unknown Make",
              models: ["X"],
              category: "NonExistent",
              categoryId: undefined,
            },
          ]);
        } else if (table === "auctions") {
          baseQuery.collect.mockResolvedValue([]);
        }

        return baseQuery;
      }),
      patch: vi.fn(),
    };
    mockCtx = {
      db: mockDb as any,
    } as unknown as MutationCtx;

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await fixMetadata.handler(mockCtx, {});

    expect(result.metadataFixed).toBe(1);
    expect(mockCtx.db.patch).toHaveBeenCalled();
  });
});
