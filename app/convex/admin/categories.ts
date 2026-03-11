import { v, ConvexError } from "convex/values";

import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCallerRole } from "../lib/auth";
import type { Id } from "../_generated/dataModel";

/**
 * Admin: List all equipment categories.
 * Includes inactive categories for management.
 *
 * @param ctx - Query context
 * @param args - Query arguments
 * @param args.includeInactive - Whether to include inactive categories
 * @returns Array of categories
 */
export const getCategoriesHandler = async (
  ctx: QueryCtx,
  args: { includeInactive?: boolean }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  const categoriesQuery = ctx.db.query("equipmentCategories");

  if (!args.includeInactive) {
    return await categoriesQuery
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  }

  return await categoriesQuery.collect();
};

export const getCategories = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: getCategoriesHandler,
});

/**
 * Admin: Add a new equipment category.
 *
 * @param ctx - Mutation context
 * @param args - Category data
 * @param args.name - The category name
 * @returns The created or reactivated category ID
 */
export const addCategoryHandler = async (
  ctx: MutationCtx,
  args: { name: string }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  // Check for duplicates
  const existing = await ctx.db
    .query("equipmentCategories")
    .withIndex("by_name", (q) => q.eq("name", args.name))
    .first();

  if (existing) {
    if (!existing.isActive) {
      // Reactivate instead of creating new
      await ctx.db.patch(existing._id, { isActive: true });
      return existing._id;
    }
    throw new ConvexError("Category already exists");
  }

  return await ctx.db.insert("equipmentCategories", {
    name: args.name,
    isActive: true,
  });
};

export const addCategory = mutation({
  args: { name: v.string() },
  handler: addCategoryHandler,
});

/**
 * Admin: Update an equipment category.
 *
 * @param ctx - Mutation context
 * @param args - Update arguments
 * @param args.id - The category ID
 * @param args.name - The new category name
 * @returns A promise that resolves when the category is updated
 */
export const updateCategoryHandler = async (
  ctx: MutationCtx,
  args: { id: Id<"equipmentCategories">; name: string }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  const existing = await ctx.db.get(args.id);
  if (!existing) {
    throw new ConvexError("Category not found");
  }

  const trimmedName = args.name.trim();
  if (!trimmedName) {
    throw new ConvexError("Category name is required");
  }

  // Check for name duplicates if name is changing
  if (existing.name !== trimmedName) {
    const duplicate = await ctx.db
      .query("equipmentCategories")
      .withIndex("by_name", (q) => q.eq("name", trimmedName))
      .first();

    if (duplicate) {
      if (!duplicate.isActive) {
        throw new ConvexError(
          `A category named "${trimmedName}" already exists but is currently inactive. Please reactivate it instead of renaming this one.`
        );
      }
      throw new ConvexError("Category with this name already exists");
    }
  }

  await ctx.db.patch(args.id, { name: trimmedName });
};

export const updateCategory = mutation({
  args: { id: v.id("equipmentCategories"), name: v.string() },
  handler: updateCategoryHandler,
});

/**
 * Admin: Soft delete an equipment category.
 *
 * @param ctx - Mutation context
 * @param args - Delete arguments
 * @param args.id - The category ID
 * @returns A promise that resolves when the category is soft deleted
 */
export const deleteCategoryHandler = async (
  ctx: MutationCtx,
  args: { id: Id<"equipmentCategories"> }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  const existing = await ctx.db.get(args.id);
  if (!existing) {
    throw new ConvexError("Category not found");
  }

  // Check if category is used by any equipment metadata
  const usedByMetadata = await ctx.db
    .query("equipmentMetadata")
    .withIndex("by_category", (q) => q.eq("categoryId", args.id))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();

  if (usedByMetadata) {
    throw new ConvexError(
      "Cannot delete category as it is currently in use by equipment catalog items."
    );
  }

  // Check if category is used by any auctions
  const usedByAuction = await ctx.db
    .query("auctions")
    .withIndex("by_category", (q) => q.eq("categoryId", args.id))
    .first();

  if (usedByAuction) {
    throw new ConvexError(
      "Cannot delete category as it is currently linked to auction listings."
    );
  }

  await ctx.db.patch(args.id, { isActive: false });
};

export const deleteCategory = mutation({
  args: { id: v.id("equipmentCategories") },
  handler: deleteCategoryHandler,
});

/**
 * Admin: Migration utility to fix equipment metadata and link categories.
 *
 * 1. Activates all metadata entries.
 * 2. Maps legacy 'category' string to 'categoryId' based on equipmentCategories table.
 * 3. Updates auctions to use proper categoryId where possible.
 *
 * @param ctx - Mutation context
 * @returns Statistics about the migration
 */
export const fixMetadataHandler = async (ctx: MutationCtx) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  // 1. Get all categories
  const categories = await ctx.db.query("equipmentCategories").collect();
  const categoryMap = new Map(categories.map((c) => [c.name, c._id]));

  // 2. Fix Metadata
  const metadata = await ctx.db.query("equipmentMetadata").collect();
  let metadataFixed = 0;

  for (const item of metadata) {
    const updates: Record<string, unknown> = {
      isActive: true,
      updatedAt: Date.now(),
    };

    // If missing categoryId but has legacy category string, try to map it
    const legacyCategory = (item as Record<string, unknown>).category;
    if (!item.categoryId && typeof legacyCategory === "string") {
      const catId = categoryMap.get(legacyCategory);
      if (catId) {
        updates.categoryId = catId;
      }
    }

    await ctx.db.patch(item._id, updates);
    metadataFixed++;
  }

  // 3. Fix Auctions (Legacy data might be missing categoryId)
  const auctions = await ctx.db.query("auctions").collect();
  let auctionsFixed = 0;

  for (const auction of auctions) {
    if (!auction.categoryId) {
      // Find matching metadata to infer category - use make AND model for better accuracy
      const matches = metadata.filter((m) => m.make === auction.make);

      // If multiple matches by make, try to narrow down by model
      let match = matches.length === 1 ? matches[0] : null;
      if (matches.length > 1 && auction.model) {
        match = matches.find((m) => m.models.includes(auction.model)) || null;
      }

      if (match && match.categoryId) {
        await ctx.db.patch(auction._id, { categoryId: match.categoryId });
        auctionsFixed++;
      }
    }
  }

  return {
    metadataFixed,
    auctionsFixed,
    categoriesCount: categories.length,
  };
};

export const fixMetadata = mutation({
  args: {},
  handler: fixMetadataHandler,
});
