import { v } from "convex/values";

import { query } from "./_generated/server";

const faqItemValidator = v.object({
  _id: v.id("faqItems"),
  _creationTime: v.number(),
  question: v.string(),
  answer: v.string(),
  order: v.number(),
  isPublished: v.boolean(),
});

/**
 * Return all published FAQ items in ascending order.
 * Public — no authentication required.
 */
export const getPublishedFaqs = query({
  args: {},
  returns: v.array(faqItemValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query("faqItems")
      .withIndex("by_published_order", (q) => q.eq("isPublished", true))
      .order("asc")
      .collect();
  },
});
