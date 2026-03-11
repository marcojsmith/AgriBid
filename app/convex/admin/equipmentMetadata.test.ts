/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import {
  addEquipmentMakeHandler,
  addModelToMakeHandler,
  updateEquipmentMake,
  deleteEquipmentMake,
  removeModelFromMake,
  getAllEquipmentMetadata,
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

  it("should throw error if make name is empty", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      addEquipmentMakeHandler(mockCtx, {
        make: "   ",
        models: ["8R"],
        categoryId: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if no valid models provided", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      addEquipmentMakeHandler(mockCtx, {
        make: "John Deere",
        models: ["   ", ""],
        categoryId: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should reactivate inactive make and merge models", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        _id: "make_inactive",
        make: "John Deere",
        models: ["6R"],
        isActive: false,
        categoryId: "cat_123",
      }),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await addEquipmentMakeHandler(mockCtx, {
      make: "John Deere",
      models: ["8R"],
      categoryId: "cat_123" as Id<"equipmentCategories">,
    });

    expect(result).toBe("make_inactive");
    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "make_inactive",
      expect.objectContaining({
        isActive: true,
        models: expect.arrayContaining(["6R", "8R"]),
      })
    );
  });

  it("should throw error if model already exists", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery);

    const existingMake = {
      _id: "make_123",
      make: "John Deere",
      models: ["8R", "7R"],
      categoryId: "cat_123",
      isActive: true,
    };
    mockCtx.db.get.mockResolvedValue(existingMake);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      addModelToMakeHandler(mockCtx, {
        id: "make_123" as Id<"equipmentMetadata">,
        model: "8R",
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if model name is empty", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      addModelToMakeHandler(mockCtx, {
        id: "make_123" as Id<"equipmentMetadata">,
        model: "   ",
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if make not found for addModel", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery);

    mockCtx.db.get.mockResolvedValue(null);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      addModelToMakeHandler(mockCtx, {
        id: "make_nonexistent" as Id<"equipmentMetadata">,
        model: "8R",
      })
    ).rejects.toThrow(ConvexError);
  });
});

describe("updateEquipmentMake", () => {
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

  it("should update equipment make successfully", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    const existingMake = {
      _id: "make_123" as Id<"equipmentMetadata">,
      make: "John Deere",
      models: ["8R"],
      categoryId: "cat_123" as Id<"equipmentCategories">,
      isActive: true,
    };
    mockCtx = setupMockCtx(mockQuery, existingMake);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await updateEquipmentMake.handler(mockCtx, {
      id: "make_123" as Id<"equipmentMetadata">,
      make: "John Deere Updated",
      models: ["8R", "7R"],
      categoryId: "cat_123" as Id<"equipmentCategories">,
    });

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "make_123",
      expect.objectContaining({
        make: "John Deere Updated",
        models: ["8R", "7R"],
        categoryId: "cat_123",
      })
    );
  });

  it("should throw error if equipment make not found", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery, null);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateEquipmentMake.handler(mockCtx, {
        id: "make_nonexistent" as Id<"equipmentMetadata">,
        make: "John Deere",
        models: ["8R"],
        categoryId: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if make name is empty", async () => {
    const existingMake = {
      _id: "make_123" as Id<"equipmentMetadata">,
      make: "John Deere",
      models: ["8R"],
      categoryId: "cat_123" as Id<"equipmentCategories">,
      isActive: true,
    };
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery, existingMake);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateEquipmentMake.handler(mockCtx, {
        id: "make_123" as Id<"equipmentMetadata">,
        make: "   ",
        models: ["8R"],
        categoryId: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if no valid models provided", async () => {
    const existingMake = {
      _id: "make_123" as Id<"equipmentMetadata">,
      make: "John Deere",
      models: ["8R"],
      categoryId: "cat_123" as Id<"equipmentCategories">,
      isActive: true,
    };
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery, existingMake);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateEquipmentMake.handler(mockCtx, {
        id: "make_123" as Id<"equipmentMetadata">,
        make: "John Deere",
        models: ["   "],
        categoryId: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if duplicate make exists in same category", async () => {
    const existingMake = {
      _id: "make_123" as Id<"equipmentMetadata">,
      make: "John Deere",
      models: ["8R"],
      categoryId: "cat_123" as Id<"equipmentCategories">,
      isActive: true,
    };
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        _id: "make_456",
        make: "Case IH",
        isActive: true,
      }),
    };
    mockCtx = setupMockCtx(mockQuery, existingMake);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      updateEquipmentMake.handler(mockCtx, {
        id: "make_123" as Id<"equipmentMetadata">,
        make: "Case IH",
        models: ["8R"],
        categoryId: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should reject non-admin users", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    mockCtx = setupMockCtx(mockQuery, {});

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(
      updateEquipmentMake.handler(mockCtx, {
        id: "make_123" as Id<"equipmentMetadata">,
        make: "John Deere",
        models: ["8R"],
        categoryId: "cat_123" as Id<"equipmentCategories">,
      })
    ).rejects.toThrow(/Unauthorized: Admin access required/);
  });
});

describe("deleteEquipmentMake", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (getResponse?: any) => {
    const mockDb = {
      get: vi.fn().mockResolvedValue(getResponse),
      patch: vi.fn(),
    };
    return {
      db: mockDb as any,
    } as unknown as MutationCtx;
  };

  it("should soft delete equipment make successfully", async () => {
    const existingMake = {
      _id: "make_123" as Id<"equipmentMetadata">,
      make: "John Deere",
      models: ["8R"],
      categoryId: "cat_123" as Id<"equipmentCategories">,
      isActive: true,
    };
    mockCtx = setupMockCtx(existingMake);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await deleteEquipmentMake.handler(mockCtx, {
      id: "make_123" as Id<"equipmentMetadata">,
    });

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "make_123",
      expect.objectContaining({
        isActive: false,
      })
    );
  });

  it("should throw error if equipment make not found", async () => {
    mockCtx = setupMockCtx(null);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      deleteEquipmentMake.handler(mockCtx, {
        id: "make_nonexistent" as Id<"equipmentMetadata">,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should reject non-admin users", async () => {
    mockCtx = setupMockCtx({});

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(
      deleteEquipmentMake.handler(mockCtx, {
        id: "make_123" as Id<"equipmentMetadata">,
      })
    ).rejects.toThrow(/Unauthorized: Admin access required/);
  });
});

describe("removeModelFromMake", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (getResponse?: any) => {
    const mockDb = {
      get: vi.fn().mockResolvedValue(getResponse),
      patch: vi.fn(),
    };
    return {
      db: mockDb as any,
    } as unknown as MutationCtx;
  };

  it("should remove model from make successfully", async () => {
    const existingMake = {
      _id: "make_123" as Id<"equipmentMetadata">,
      make: "John Deere",
      models: ["8R", "7R", "6R"],
      categoryId: "cat_123" as Id<"equipmentCategories">,
      isActive: true,
    };
    mockCtx = setupMockCtx(existingMake);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await removeModelFromMake.handler(mockCtx, {
      id: "make_123" as Id<"equipmentMetadata">,
      model: "7R",
    });

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "make_123",
      expect.objectContaining({
        models: ["8R", "6R"],
      })
    );
  });

  it("should throw error if equipment make not found", async () => {
    mockCtx = setupMockCtx(null);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      removeModelFromMake.handler(mockCtx, {
        id: "make_nonexistent" as Id<"equipmentMetadata">,
        model: "8R",
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if model not found in make", async () => {
    const existingMake = {
      _id: "make_123" as Id<"equipmentMetadata">,
      make: "John Deere",
      models: ["8R", "7R"],
      categoryId: "cat_123" as Id<"equipmentCategories">,
      isActive: true,
    };
    mockCtx = setupMockCtx(existingMake);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      removeModelFromMake.handler(mockCtx, {
        id: "make_123" as Id<"equipmentMetadata">,
        model: "6R",
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should throw error if trying to remove the last model", async () => {
    const existingMake = {
      _id: "make_123" as Id<"equipmentMetadata">,
      make: "John Deere",
      models: ["8R"],
      categoryId: "cat_123" as Id<"equipmentCategories">,
      isActive: true,
    };
    mockCtx = setupMockCtx(existingMake);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      removeModelFromMake.handler(mockCtx, {
        id: "make_123" as Id<"equipmentMetadata">,
        model: "8R",
      })
    ).rejects.toThrow(/must have at least one model/);
  });

  it("should reject non-admin users", async () => {
    mockCtx = setupMockCtx({});

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(
      removeModelFromMake.handler(mockCtx, {
        id: "make_123" as Id<"equipmentMetadata">,
        model: "8R",
      })
    ).rejects.toThrow(/Unauthorized: Admin access required/);
  });
});

describe("getAllEquipmentMetadata", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (metadataItems: any[]) => {
    const mockDb = {
      get: vi.fn((id: string) => {
        if (id === "cat_1") return Promise.resolve({ name: "Tractors" });
        if (id === "cat_2") return Promise.resolve({ name: "Harvesters" });
        return Promise.resolve(null);
      }),
      query: vi.fn(() => ({
        filter: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue(metadataItems),
      })),
    };
    return {
      db: mockDb as any,
    } as unknown as MutationCtx;
  };

  it("should return active equipment metadata with category names", async () => {
    const metadataItems = [
      {
        _id: "meta_1",
        make: "John Deere",
        models: ["8R"],
        categoryId: "cat_1",
        isActive: true,
      },
      {
        _id: "meta_2",
        make: "Case IH",
        models: ["Magnum"],
        categoryId: "cat_2",
        isActive: true,
      },
    ];
    mockCtx = setupMockCtx(metadataItems);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await getAllEquipmentMetadata.handler(mockCtx, {});

    expect(result).toHaveLength(2);
    expect(result[0].categoryName).toBe("Tractors");
    expect(result[1].categoryName).toBe("Harvesters");
  });

  it("should include inactive items when requested", async () => {
    const metadataItems = [
      {
        _id: "meta_1",
        make: "John Deere",
        models: ["8R"],
        categoryId: "cat_1",
        isActive: true,
      },
      {
        _id: "meta_2",
        make: "Obsolete",
        models: ["Old"],
        categoryId: "cat_2",
        isActive: false,
      },
    ];
    mockCtx = setupMockCtx(metadataItems);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await getAllEquipmentMetadata.handler(mockCtx, {
      includeInactive: true,
    });

    expect(result).toHaveLength(2);
  });

  it("should handle missing category gracefully", async () => {
    const metadataItems = [
      {
        _id: "meta_1",
        make: "John Deere",
        models: ["8R"],
        categoryId: "cat_nonexistent",
        isActive: true,
      },
    ];
    mockCtx = setupMockCtx(metadataItems);

    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    const result = await getAllEquipmentMetadata.handler(mockCtx, {});

    expect(result).toHaveLength(1);
    expect(result[0].categoryName).toBe("Unknown");
  });

  it("should reject non-admin users", async () => {
    mockCtx = setupMockCtx([]);

    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(
      getAllEquipmentMetadata.handler(mockCtx, {})
    ).rejects.toThrow(/Unauthorized: Admin access required/);
  });
});