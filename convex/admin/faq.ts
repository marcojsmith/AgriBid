import { v } from "convex/values";

import { query, mutation } from "../_generated/server";
import { requireAdmin } from "../lib/auth";

const faqItemValidator = v.object({
  _id: v.id("faqItems"),
  _creationTime: v.number(),
  question: v.string(),
  answer: v.string(),
  order: v.number(),
  isPublished: v.boolean(),
});

/**
 * Return all FAQ items (published and draft) in ascending order.
 * Admin only.
 */
export const getAllFaqItems = query({
  args: {},
  returns: v.array(faqItemValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("faqItems")
      .withIndex("by_order")
      .order("asc")
      .collect();
  },
});

/**
 * Create a new FAQ item.
 * Admin only.
 */
export const createFaqItem = mutation({
  args: {
    question: v.string(),
    answer: v.string(),
    isPublished: v.boolean(),
  },
  returns: v.id("faqItems"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const allItems = await ctx.db.query("faqItems").collect();
    const maxOrder = allItems.reduce(
      (max, item) => Math.max(max, item.order),
      -1
    );
    return await ctx.db.insert("faqItems", { ...args, order: maxOrder + 1 });
  },
});

/**
 * Update an existing FAQ item.
 * Admin only.
 */
export const updateFaqItem = mutation({
  args: {
    id: v.id("faqItems"),
    question: v.optional(v.string()),
    answer: v.optional(v.string()),
    order: v.optional(v.number()),
    isPublished: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...patch }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("FAQ item not found");
    const filtered = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
    return null;
  },
});

/**
 * Delete a FAQ item permanently.
 * Admin only.
 */
export const deleteFaqItem = mutation({
  args: { id: v.id("faqItems") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return null;
  },
});

/**
 * Reorder FAQ items by reassigning order values 0, 1, 2, …
 * Accepts an array of IDs in the desired display order.
 * Admin only.
 */
export const reorderFaqItems = mutation({
  args: { orderedIds: v.array(v.id("faqItems")) },
  returns: v.null(),
  handler: async (ctx, { orderedIds }) => {
    await requireAdmin(ctx);
    const items = await Promise.all(orderedIds.map((id) => ctx.db.get(id)));
    for (let i = 0; i < items.length; i++) {
      if (!items[i]) throw new Error(`FAQ item ${orderedIds[i]} not found`);
    }
    await Promise.all(
      orderedIds.map((id, index) => ctx.db.patch(id, { order: index }))
    );
    return null;
  },
});
