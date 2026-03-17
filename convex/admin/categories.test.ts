import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import {
  addCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
  fixMetadataHandler,
  getCategoriesHandler,
} from "./categories";
import * as auth from "../lib/auth";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getCallerRole: vi.fn(),
  requireAdmin: vi.fn(),
}));

interface MockQuery {
  withIndex?: (index: string, cb?: (q: unknown) => unknown) => MockQuery;
  filter?: (cb: (q: unknown) => unknown) => MockQuery;
  first?: () => Promise<unknown>;
  collect?: () => Promise<unknown[]>;
}

describe("Categories Backend", () => {
  let mockCtx: MutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (mockQuery: MockQuery) => {
    const mockDb = {
      get: vi.fn(),
      patch: vi.fn(),
      insert: vi.fn(),
      query: vi.fn(
        () => mockQuery as unknown as ReturnType<MutationCtx["db"]["query"]>
      ),
    };
    return {
      db: mockDb as unknown as MutationCtx["db"],
    } as unknown as MutationCtx;
  };

  it("should create a new category when called by admin", async () => {
    const mockQuery: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return mockQuery;
      }),
      filter: vi.fn(() => mockQuery),
      collect: vi.fn().mockResolvedValue([]),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
    vi.mocked(mockCtx.db.insert).mockResolvedValue(
      "cat_123" as Id<"equipmentCategories">
    );

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
    const mockQuery: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return mockQuery;
      }),
      filter: vi.fn(() => mockQuery),
      collect: vi.fn().mockResolvedValue([]),
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
    const mockQuery: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return mockQuery;
      }),
      filter: vi.fn(() => mockQuery),
      collect: vi.fn().mockResolvedValue([]),
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
    const mockQuery: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return mockQuery;
      }),
      filter: vi.fn(() => mockQuery),
      collect: vi.fn().mockResolvedValue([]),
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
  let mockCtx: MutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (mockQuery: MockQuery, getResponse?: unknown) => {
    const mockDb = {
      get: vi.fn().mockResolvedValue(getResponse),
      patch: vi.fn(),
      query: vi.fn(
        () => mockQuery as unknown as ReturnType<MutationCtx["db"]["query"]>
      ),
    };
    return {
      db: mockDb as unknown as MutationCtx["db"],
    } as unknown as MutationCtx;
  };

  it("should update category name successfully", async () => {
    const mockQuery: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return mockQuery;
      }),
      filter: vi.fn(() => mockQuery),
      collect: vi.fn().mockResolvedValue([]),
      first: vi.fn().mockResolvedValue(null),
    };
    const existingCategory = {
      _id: "cat_123" as Id<"equipmentCategories">,
      name: "Old Name",
      isActive: true,
    };
    mockCtx = setupMockCtx(mockQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await updateCategoryHandler(mockCtx, {
      id: "cat_123" as Id<"equipmentCategories">,
      name: "New Name",
    });

    expect(mockCtx.db.patch).toHaveBeenCalledWith("cat_123", {
      name: "New Name",
    });
  });

  it("should throw error if category not found", async () => {
    const mockQuery: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return mockQuery;
      }),
      filter: vi.fn(() => mockQuery),
      collect: vi.fn().mockResolvedValue([]),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery, null);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateCategoryHandler(mockCtx, {
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
    const mockQuery: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return mockQuery;
      }),
      filter: vi.fn(() => mockQuery),
      collect: vi.fn().mockResolvedValue([]),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateCategoryHandler(mockCtx, {
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
    const mockQuery: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return mockQuery;
      }),
      filter: vi.fn(() => mockQuery),
      collect: vi.fn().mockResolvedValue([]),
      first: vi.fn().mockResolvedValue({
        _id: "cat_456",
        name: "Duplicate",
        isActive: true,
      }),
    };
    mockCtx = setupMockCtx(mockQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateCategoryHandler(mockCtx, {
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
    const mockQuery: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return mockQuery;
      }),
      filter: vi.fn(() => mockQuery),
      collect: vi.fn().mockResolvedValue([]),
      first: vi.fn().mockResolvedValue({
        _id: "cat_456",
        name: "Duplicate",
        isActive: false,
      }),
    };
    mockCtx = setupMockCtx(mockQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateCategoryHandler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
        name: "Duplicate",
      })
    ).rejects.toThrow(/already exists but is currently inactive/);
  });

  it("should reject non-admin users", async () => {
    const mockQuery: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return mockQuery;
      }),
      filter: vi.fn(() => mockQuery),
      collect: vi.fn().mockResolvedValue([]),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery, {});

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(
      updateCategoryHandler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
        name: "New Name",
      })
    ).rejects.toThrow(/Unauthorized: Admin access required/);
  });
});

describe("deleteCategory", () => {
  let mockCtx: MutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (
    equipmentQuery: MockQuery,
    auctionQuery: MockQuery,
    getResponse?: unknown
  ) => {
    const mockDb = {
      get: vi.fn().mockResolvedValue(getResponse),
      patch: vi.fn(),
      query: vi.fn((table: string) => {
        if (table === "equipmentMetadata")
          return equipmentQuery as unknown as ReturnType<
            MutationCtx["db"]["query"]
          >;
        if (table === "auctions")
          return auctionQuery as unknown as ReturnType<
            MutationCtx["db"]["query"]
          >;
        return equipmentQuery as unknown as ReturnType<
          MutationCtx["db"]["query"]
        >;
      }),
    };
    return {
      db: mockDb as unknown as MutationCtx["db"],
    } as unknown as MutationCtx;
  };

  const createChainedQuery = (firstResult: unknown) => {
    const queryObj: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return queryObj;
      }),
      filter: vi.fn((cb) => {
        if (cb)
          cb({
            eq: vi.fn().mockReturnThis(),
            field: vi.fn().mockReturnThis(),
          });
        return queryObj;
      }),
      first: vi.fn().mockResolvedValue(firstResult),
      collect: vi.fn().mockResolvedValue([]),
    };
    return queryObj;
  };

  it("should soft delete category successfully", async () => {
    const equipmentQuery = createChainedQuery(null);
    const auctionQuery = createChainedQuery(null);
    const existingCategory = {
      _id: "cat_123" as Id<"equipmentCategories">,
      name: "Tractors",
      isActive: true,
    };
    mockCtx = setupMockCtx(equipmentQuery, auctionQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await deleteCategoryHandler(mockCtx, {
      id: "cat_123" as Id<"equipmentCategories">,
    });

    expect(mockCtx.db.patch).toHaveBeenCalledWith("cat_123", {
      isActive: false,
    });
  });

  it("should throw error if category not found", async () => {
    const equipmentQuery = createChainedQuery(null);
    const auctionQuery = createChainedQuery(null);
    mockCtx = setupMockCtx(equipmentQuery, auctionQuery, null);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      deleteCategoryHandler(mockCtx, {
        id: "cat_nonexistent" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if category is in use by equipment metadata", async () => {
    const equipmentQuery = createChainedQuery({ _id: "meta_123" });
    const auctionQuery = createChainedQuery(null);
    const existingCategory = {
      _id: "cat_123" as Id<"equipmentCategories">,
      name: "Tractors",
      isActive: true,
    };
    mockCtx = setupMockCtx(equipmentQuery, auctionQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      deleteCategoryHandler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(/currently in use by equipment catalog items/);
  });

  it("should throw error if category is linked to auctions", async () => {
    const equipmentQuery = createChainedQuery(null);
    const auctionQuery = createChainedQuery({ _id: "auction_123" });
    const existingCategory = {
      _id: "cat_123" as Id<"equipmentCategories">,
      name: "Tractors",
      isActive: true,
    };
    mockCtx = setupMockCtx(equipmentQuery, auctionQuery, existingCategory);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      deleteCategoryHandler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(/currently linked to auction listings/);
  });

  it("should reject non-admin users", async () => {
    const equipmentQuery = createChainedQuery(null);
    const auctionQuery = createChainedQuery(null);
    mockCtx = setupMockCtx(equipmentQuery, auctionQuery, {});

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(
      deleteCategoryHandler(mockCtx, {
        id: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(/Unauthorized: Admin access required/);
  });
});

describe("fixMetadata", () => {
  let mockCtx: MutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = () => {
    // Shared mutable state to simulate database changes
    const equipmentMetadata = [
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
    ];

    const auctions = [
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
    ];

    const mockDb = {
      query: vi.fn((table: string) => {
        const baseQuery = {
          collect: vi.fn(),
        };

        if (table === "equipmentCategories") {
          baseQuery.collect.mockResolvedValue([
            { _id: "cat_1", name: "Tractors" },
            { _id: "cat_2", name: "Harvesters" },
          ] as unknown as ReturnType<MutationCtx["db"]["query"]>);
        } else if (table === "equipmentMetadata") {
          baseQuery.collect.mockResolvedValue(
            equipmentMetadata as unknown as ReturnType<
              MutationCtx["db"]["query"]
            >
          );
        } else if (table === "auctions") {
          baseQuery.collect.mockResolvedValue(
            auctions as unknown as ReturnType<MutationCtx["db"]["query"]>
          );
        }

        return baseQuery as unknown as ReturnType<MutationCtx["db"]["query"]>;
      }),
      patch: vi.fn((id: string, updates: Record<string, unknown>) => {
        // Simulate the patch by updating the shared objects
        if (id === "meta_1" && updates.categoryId) {
          (equipmentMetadata[0] as Record<string, unknown>).categoryId =
            updates.categoryId;
        }
        if (id === "meta_2" && updates.categoryId) {
          (equipmentMetadata[1] as Record<string, unknown>).categoryId =
            updates.categoryId;
        }
        if (id === "auction_1" && updates.categoryId) {
          (auctions[0] as Record<string, unknown>).categoryId =
            updates.categoryId;
        }
        if (id === "auction_2" && updates.categoryId) {
          (auctions[1] as Record<string, unknown>).categoryId =
            updates.categoryId;
        }
      }),
    };
    return {
      db: mockDb as unknown as MutationCtx["db"],
    } as unknown as MutationCtx;
  };

  it("should fix metadata and auctions successfully", async () => {
    mockCtx = setupMockCtx();

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await fixMetadataHandler(mockCtx);

    expect(result.categoriesCount).toBe(2);
    expect(result.metadataFixed).toBe(2);
    expect(result.auctionsFixed).toBe(2);
    expect(mockCtx.db.patch).toHaveBeenCalled();
  });

  it("should reject non-admin users", async () => {
    mockCtx = setupMockCtx();

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(fixMetadataHandler(mockCtx)).rejects.toThrow(
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
          ] as unknown as ReturnType<MutationCtx["db"]["query"]>);
        } else if (table === "auctions") {
          baseQuery.collect.mockResolvedValue(
            [] as unknown as ReturnType<MutationCtx["db"]["query"]>
          );
        }

        return baseQuery as unknown as ReturnType<MutationCtx["db"]["query"]>;
      }),
      patch: vi.fn(),
    };
    mockCtx = {
      db: mockDb as unknown as MutationCtx["db"],
    } as unknown as MutationCtx;

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await fixMetadataHandler(mockCtx);

    expect(result.metadataFixed).toBe(1);
    expect(mockCtx.db.patch).toHaveBeenCalled();
  });

  it("should handle auction category inference from metadata", async () => {
    const metadataItems = [
      {
        _id: "meta_1",
        make: "John Deere",
        models: ["8R", "9R"],
        category: "Tractors",
        categoryId: "cat_1" as Id<"equipmentCategories">,
      },
    ];

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
          baseQuery.collect.mockResolvedValue(
            metadataItems as unknown as ReturnType<MutationCtx["db"]["query"]>
          );
        } else if (table === "auctions") {
          baseQuery.collect.mockResolvedValue([
            {
              _id: "auction_1",
              make: "John Deere",
              model: "8R",
              categoryId: undefined,
            },
          ] as unknown as ReturnType<MutationCtx["db"]["query"]>);
        }

        return baseQuery as unknown as ReturnType<MutationCtx["db"]["query"]>;
      }),
      patch: vi.fn(),
    };
    mockCtx = {
      db: mockDb as unknown as MutationCtx["db"],
    } as unknown as MutationCtx;

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await fixMetadataHandler(mockCtx);

    expect(result.auctionsFixed).toBe(1);
    expect(mockCtx.db.patch).toHaveBeenCalledWith("auction_1", {
      categoryId: "cat_1",
    });
  });

  it("should handle auction category inference with multiple metadata matches", async () => {
    const metadataItems = [
      {
        _id: "meta_1",
        make: "John Deere",
        models: ["8R"],
        category: "Tractors",
        categoryId: "cat_1" as Id<"equipmentCategories">,
      },
      {
        _id: "meta_2",
        make: "John Deere",
        models: ["9R"],
        category: "Tractors",
        categoryId: "cat_2" as Id<"equipmentCategories">,
      },
    ];

    const mockDb = {
      query: vi.fn((table: string) => {
        const baseQuery = {
          collect: vi.fn(),
        };

        if (table === "equipmentCategories") {
          baseQuery.collect.mockResolvedValue([
            { _id: "cat_1", name: "Tractors" },
            { _id: "cat_2", name: "Tractors" },
          ]);
        } else if (table === "equipmentMetadata") {
          baseQuery.collect.mockResolvedValue(
            metadataItems as unknown as ReturnType<MutationCtx["db"]["query"]>
          );
        } else if (table === "auctions") {
          baseQuery.collect.mockResolvedValue([
            {
              _id: "auction_1",
              make: "John Deere",
              model: "8R",
              categoryId: undefined,
            },
          ] as unknown as ReturnType<MutationCtx["db"]["query"]>);
        }

        return baseQuery as unknown as ReturnType<MutationCtx["db"]["query"]>;
      }),
      patch: vi.fn(),
    };
    mockCtx = {
      db: mockDb as unknown as MutationCtx["db"],
    } as unknown as MutationCtx;

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await fixMetadataHandler(mockCtx);

    expect(result.auctionsFixed).toBe(1);
  });

  it("should skip auctions that already have categoryId", async () => {
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
              make: "John Deere",
              models: ["8R"],
              category: "Tractors",
              categoryId: "cat_1" as Id<"equipmentCategories">,
            },
          ] as unknown as ReturnType<MutationCtx["db"]["query"]>);
        } else if (table === "auctions") {
          baseQuery.collect.mockResolvedValue([
            {
              _id: "auction_1",
              make: "John Deere",
              model: "8R",
              categoryId: "cat_existing" as Id<"equipmentCategories">,
            },
          ] as unknown as ReturnType<MutationCtx["db"]["query"]>);
        }

        return baseQuery as unknown as ReturnType<MutationCtx["db"]["query"]>;
      }),
      patch: vi.fn(),
    };
    mockCtx = {
      db: mockDb as unknown as MutationCtx["db"],
    } as unknown as MutationCtx;

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await fixMetadataHandler(mockCtx);

    expect(result.auctionsFixed).toBe(0);
  });

  it("should handle auctions with no matching metadata", async () => {
    const metadataItems = [
      {
        _id: "meta_1",
        make: "John Deere",
        models: ["8R"],
        category: "Tractors",
        categoryId: "cat_1" as Id<"equipmentCategories">,
      },
    ];

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
          baseQuery.collect.mockResolvedValue(
            metadataItems as unknown as ReturnType<MutationCtx["db"]["query"]>
          );
        } else if (table === "auctions") {
          baseQuery.collect.mockResolvedValue([
            {
              _id: "auction_1",
              make: "UnknownMake",
              model: "UnknownModel",
              categoryId: undefined,
            },
          ] as unknown as ReturnType<MutationCtx["db"]["query"]>);
        }

        return baseQuery as unknown as ReturnType<MutationCtx["db"]["query"]>;
      }),
      patch: vi.fn(),
    };
    mockCtx = {
      db: mockDb as unknown as MutationCtx["db"],
    } as unknown as MutationCtx;

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await fixMetadataHandler(mockCtx);

    expect(result.auctionsFixed).toBe(0);
  });
});

describe("getCategories", () => {
  let mockCtx: QueryCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (mockQuery: MockQuery) => {
    const mockDb = {
      query: vi.fn(
        () => mockQuery as unknown as ReturnType<QueryCtx["db"]["query"]>
      ),
    };
    return {
      db: mockDb as unknown as QueryCtx["db"],
    } as unknown as QueryCtx;
  };

  it("should return only active categories by default", async () => {
    const mockQuery: MockQuery = {
      filter: vi.fn((cb) => {
        if (cb)
          cb({
            eq: vi.fn().mockReturnThis(),
            field: vi.fn().mockReturnThis(),
          });
        return mockQuery;
      }),
      collect: vi
        .fn()
        .mockResolvedValue([
          { _id: "cat_1", name: "Tractors", isActive: true },
        ]),
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await getCategoriesHandler(mockCtx, {});

    expect(result).toHaveLength(1);
    expect(mockQuery.filter).toHaveBeenCalled();
  });

  it("should return all categories when includeInactive is true", async () => {
    const mockQuery = {
      collect: vi.fn().mockResolvedValue([
        { _id: "cat_1", name: "Tractors", isActive: true },
        { _id: "cat_2", name: "Harvesters", isActive: false },
      ]),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await getCategoriesHandler(mockCtx, {
      includeInactive: true,
    });

    expect(result).toHaveLength(2);
  });

  it("should reject non-admin users", async () => {
    const mockQuery = {
      collect: vi.fn(),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(getCategoriesHandler(mockCtx, {})).rejects.toThrow(
      /Unauthorized: Admin access required/
    );
  });
});
