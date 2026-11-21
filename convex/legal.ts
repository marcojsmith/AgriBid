import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import { ensureLegalPageDraftRows } from "./lib/legalPages";
import { LEGAL_SLUGS, type LegalSlug } from "./lib/legalTemplates";

/** Validator for a legal page slug. */
export const legalSlugValidator = v.union(
  v.literal("terms"),
  v.literal("privacy"),
  v.literal("paia")
);

/**
 * Return a legal page for public display, or `null` when it is unpublished or
 * missing. A draft is never returned, and `isPublished` is checked on the
 * server (not by the caller).
 * Public — no authentication required.
 */
export const getLegalPage = query({
  args: { slug: legalSlugValidator },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      body: v.string(),
      publishedAt: v.optional(v.number()),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, { slug }) => {
    const page = await ctx.db
      .query("legalPages")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!page?.isPublished) return null;
    return {
      title: page.title,
      body: page.body,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
    };
  },
});

/**
 * Return the slugs of the published legal pages, in footer order. Cheap: at
 * most three rows, read by index, and no body text leaves the server.
 * Public — no authentication required.
 */
export const getPublishedLegalSlugs = query({
  args: {},
  returns: v.array(legalSlugValidator),
  handler: async (ctx) => {
    const published: LegalSlug[] = [];
    for (const slug of LEGAL_SLUGS) {
      const page = await ctx.db
        .query("legalPages")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (page?.isPublished) published.push(slug);
    }
    return published;
  },
});

/**
 * Create the three starter draft pages when they are missing. Idempotent: it
 * never overwrites an existing row and never publishes anything. Called by the
 * seed (which also runs against production via `weeklyReset`).
 */
export const ensureLegalPageDrafts = internalMutation({
  args: {},
  returns: v.array(legalSlugValidator),
  handler: async (ctx) => {
    return await ensureLegalPageDraftRows(ctx);
  },
});
