import { v, ConvexError } from "convex/values";

import { mutation, query } from "../_generated/server";
import { getCallerRole } from "../lib/auth";

/**
 * Admin: List all equipment categories.
 * Includes inactive categories for management.
 */
export const getCategories = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
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
  },
});

/**
 * Admin: Add a new equipment category.
 */
export const addCategory = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
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
  },
});

/**
 * Admin: Update an equipment category.
 */
export const updateCategory = mutation({
  args: { id: v.id("equipmentCategories"), name: v.string() },
  handler: async (ctx, args) => {
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
          await ctx.db.patch(duplicate._id, { isActive: true });
          throw new ConvexError(
            `A category named "${trimmedName}" already exists but was inactive. It has been reactivated.`
          );
        }
        throw new ConvexError("Category with this name already exists");
      }
    }

    await ctx.db.patch(args.id, { name: trimmedName });
  },
});

/**
 * Admin: Soft delete an equipment category.
 */
export const deleteCategory = mutation({
  args: { id: v.id("equipmentCategories") },
  handler: async (ctx, args) => {
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
  },
});

/**
 * Admin: Migration utility to fix equipment metadata and link categories.
 *
 * 1. Activates all metadata entries.
 * 2. Maps legacy 'category' string to 'categoryId' based on equipmentCategories table.
 * 3. Updates auctions to use proper categoryId where possible.
 */
export const fixMetadata = mutation({
  args: {},
  handler: async (ctx) => {
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
  },
});
