import { v, ConvexError } from "convex/values";

import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getCallerRole } from "../lib/auth";

/**
 * Admin: List all equipment makes with their models and categories.
 *
 * @param ctx - Query context
 * @param args - Query arguments
 * @param args.includeInactive - Whether to include inactive items
 * @returns Array of metadata items with category names
 */
export const getAllEquipmentMetadataHandler = async (
  ctx: QueryCtx,
  args: { includeInactive?: boolean }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  const metadataQuery = ctx.db.query("equipmentMetadata");
  let metadata;

  if (!args.includeInactive) {
    metadata = await metadataQuery
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  } else {
    metadata = await metadataQuery.collect();
  }

  // Parallelize category lookups
  return await Promise.all(
    metadata.map(async (item) => {
      const category = item.categoryId
        ? await ctx.db.get(item.categoryId)
        : null;
      return {
        ...item,
        categoryName: category?.name ?? "Unknown",
      };
    })
  );
};

export const getAllEquipmentMetadata = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: getAllEquipmentMetadataHandler,
});

/**
 * Admin: Add a new equipment make.
 *
 * @param ctx - Mutation context
 * @param args - Make data including models and category linkage
 * @param args.make - The manufacturer name
 * @param args.models - Array of model names
 * @param args.categoryId - The associated category ID
 * @returns The created or reactivated make ID
 */
export const addEquipmentMakeHandler = async (
  ctx: MutationCtx,
  args: {
    make: string;
    models: string[];
    categoryId: Id<"equipmentCategories">;
  }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  const trimmedMake = args.make.trim();
  if (!trimmedMake) {
    throw new ConvexError("Manufacturer name is required");
  }

  const trimmedModels = args.models
    .map((m) => m.trim())
    .filter((m) => m.length > 0);

  if (trimmedModels.length === 0) {
    throw new ConvexError("At least one valid model is required");
  }

  // Check for duplicates
  const existing = await ctx.db
    .query("equipmentMetadata")
    .withIndex("by_make", (q) => q.eq("make", trimmedMake))
    .filter((q) => q.eq(q.field("categoryId"), args.categoryId))
    .first();

  if (existing) {
    if (!existing.isActive) {
      await ctx.db.patch(existing._id, {
        isActive: true,
        models: Array.from(new Set([...existing.models, ...trimmedModels])),
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    throw new ConvexError("Equipment make already exists for this category");
  }

  return await ctx.db.insert("equipmentMetadata", {
    make: trimmedMake,
    models: trimmedModels,
    categoryId: args.categoryId,
    isActive: true,
    updatedAt: Date.now(),
  });
};

export const addEquipmentMake = mutation({
  args: {
    make: v.string(),
    models: v.array(v.string()),
    categoryId: v.id("equipmentCategories"),
  },
  handler: addEquipmentMakeHandler,
});

/**
 * Admin: Update an equipment make.
 *
 * @param ctx - Mutation context
 * @param args - Update arguments
 * @param args.id - The metadata ID
 * @param args.make - The new manufacturer name
 * @param args.models - The new array of model names
 * @param args.categoryId - The new associated category ID
 * @returns A promise that resolves when the make is updated
 */
export const updateEquipmentMakeHandler = async (
  ctx: MutationCtx,
  args: {
    id: Id<"equipmentMetadata">;
    make: string;
    models: string[];
    categoryId: Id<"equipmentCategories">;
  }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  const existing = await ctx.db.get(args.id);
  if (!existing) {
    throw new ConvexError("Equipment metadata not found");
  }

  const trimmedMake = args.make.trim();
  if (!trimmedMake) {
    throw new ConvexError("Manufacturer name is required");
  }

  const trimmedModels = args.models
    .map((m) => m.trim())
    .filter((m) => m.length > 0);

  if (trimmedModels.length === 0) {
    throw new ConvexError("At least one valid model is required");
  }

  // Check for name duplicates in the same category if name/category is changing
  if (
    existing.make !== trimmedMake ||
    existing.categoryId !== args.categoryId
  ) {
    const duplicate = await ctx.db
      .query("equipmentMetadata")
      .withIndex("by_make", (q) => q.eq("make", trimmedMake))
      .filter((q) => q.eq(q.field("categoryId"), args.categoryId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (duplicate && duplicate._id !== args.id) {
      throw new ConvexError(
        "Another active item with this make and category already exists"
      );
    }
  }

  await ctx.db.patch(args.id, {
    make: trimmedMake,
    models: trimmedModels,
    categoryId: args.categoryId,
    updatedAt: Date.now(),
  });
};

export const updateEquipmentMake = mutation({
  args: {
    id: v.id("equipmentMetadata"),
    make: v.string(),
    models: v.array(v.string()),
    categoryId: v.id("equipmentCategories"),
  },
  handler: updateEquipmentMakeHandler,
});

/**
 * Admin: Soft delete an equipment make.
 *
 * @param ctx - Mutation context
 * @param args - Delete arguments
 * @param args.id - The metadata ID
 * @returns A promise that resolves when the make is soft deleted
 */
export const deleteEquipmentMakeHandler = async (
  ctx: MutationCtx,
  args: { id: Id<"equipmentMetadata"> }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  const existing = await ctx.db.get(args.id);
  if (!existing) {
    throw new ConvexError("Equipment metadata not found");
  }

  await ctx.db.patch(args.id, {
    isActive: false,
    updatedAt: Date.now(),
  });
};

export const deleteEquipmentMake = mutation({
  args: { id: v.id("equipmentMetadata") },
  handler: deleteEquipmentMakeHandler,
});

/**
 * Admin: Add a model to an existing make.
 *
 * @param ctx - Mutation context
 * @param args - The make ID and the new model name
 * @param args.id - The metadata ID
 * @param args.model - The new model name
 * @returns A promise that resolves when the model is added
 */
export const addModelToMakeHandler = async (
  ctx: MutationCtx,
  args: { id: Id<"equipmentMetadata">; model: string }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  const trimmedModel = args.model.trim();
  if (!trimmedModel) {
    throw new ConvexError("Model name is required");
  }

  const existing = await ctx.db.get(args.id);
  if (!existing) {
    throw new ConvexError("Equipment metadata not found");
  }

  if (existing.models.includes(trimmedModel)) {
    throw new ConvexError("Model already exists for this make");
  }

  await ctx.db.patch(args.id, {
    models: [...existing.models, trimmedModel],
    updatedAt: Date.now(),
  });
};

export const addModelToMake = mutation({
  args: { id: v.id("equipmentMetadata"), model: v.string() },
  handler: addModelToMakeHandler,
});

/**
 * Admin: Remove a model from an existing make.
 *
 * @param ctx - Mutation context
 * @param args - Remove arguments
 * @param args.id - The metadata ID
 * @param args.model - The model name to remove
 * @returns A promise that resolves when the model is removed
 */
export const removeModelFromMakeHandler = async (
  ctx: MutationCtx,
  args: { id: Id<"equipmentMetadata">; model: string }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  const existing = await ctx.db.get(args.id);
  if (!existing) {
    throw new ConvexError("Equipment metadata not found");
  }

  if (!existing.models.includes(args.model)) {
    throw new ConvexError("Model not found for this make");
  }

  if (existing.models.length <= 1) {
    throw new ConvexError(
      "A make must have at least one model. Delete the entire make instead."
    );
  }

  const updatedModels = existing.models.filter((m) => m !== args.model);

  await ctx.db.patch(args.id, {
    models: updatedModels,
    updatedAt: Date.now(),
  });
};

export const removeModelFromMake = mutation({
  args: { id: v.id("equipmentMetadata"), model: v.string() },
  handler: removeModelFromMakeHandler,
});
