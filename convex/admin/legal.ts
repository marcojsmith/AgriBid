import { ConvexError, v } from "convex/values";

import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { logAudit } from "../admin_utils";
import { requireAdmin } from "../lib/auth";
import {
  assertPublishable,
  ensureLegalPageDraftRows,
  validateLegalContent,
} from "../lib/legalPages";
import { LEGAL_SLUGS, type LegalSlug } from "../lib/legalTemplates";
import { resolveDisplayNames } from "../lib/userNames";
import { legalSlugValidator } from "../legal";

const adminLegalPageValidator = v.object({
  slug: legalSlugValidator,
  title: v.string(),
  body: v.string(),
  isPublished: v.boolean(),
  publishedAt: v.optional(v.number()),
  updatedAt: v.number(),
  updatedBy: v.string(),
  updatedByName: v.string(),
});

/**
 * Load a legal page row by slug.
 *
 * @param ctx - Convex mutation context.
 * @param slug - The page slug.
 * @returns The row.
 * @throws If the page does not exist (run the seed or "Create drafts").
 */
async function getLegalPageRow(
  ctx: MutationCtx,
  slug: LegalSlug
): Promise<Doc<"legalPages">> {
  const page = await ctx.db
    .query("legalPages")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (!page) throw new ConvexError("Legal page not found");
  return page;
}

/**
 * Return all legal pages (drafts included) in footer order, with the name of
 * the admin who last updated each. Admin only.
 */
export const adminGetLegalPages = query({
  args: {},
  returns: v.array(adminLegalPageValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows: Doc<"legalPages">[] = [];
    for (const slug of LEGAL_SLUGS) {
      const row = await ctx.db
        .query("legalPages")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (row) rows.push(row);
    }
    const names = await resolveDisplayNames(
      ctx,
      rows.map((row) => row.updatedBy).filter((id) => id !== "SYSTEM"),
      { fallback: "Unknown admin" }
    );
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      body: row.body,
      isPublished: row.isPublished,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
      updatedByName:
        row.updatedBy === "SYSTEM"
          ? "System (starter template)"
          : (names.get(row.updatedBy) ?? "Unknown admin"),
    }));
  },
});

/**
 * Create any missing starter drafts (never overwrites or publishes). Admin only.
 */
export const createMissingLegalPageDrafts = mutation({
  args: {},
  returns: v.array(legalSlugValidator),
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const created = await ensureLegalPageDraftRows(
      ctx,
      admin.userId ?? admin._id
    );
    if (created.length > 0) {
      await logAudit(ctx, {
        action: "create_legal_page_drafts",
        targetType: "legalPage",
        details: created.join(","),
        targetCount: created.length,
      });
    }
    return created;
  },
});

/**
 * Update a legal page's title and markdown body. A published page stays
 * published, so the change is live immediately. Admin only.
 */
export const updateLegalPage = mutation({
  args: {
    slug: legalSlugValidator,
    title: v.string(),
    body: v.string(),
    /** The `updatedAt` the editor loaded; a mismatch means someone else saved first. */
    expectedUpdatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const { title, body } = validateLegalContent(args.title, args.body);
    const page = await getLegalPageRow(ctx, args.slug);
    if (page.updatedAt !== args.expectedUpdatedAt) {
      throw new ConvexError(
        "This page was changed by someone else. Reload the page and try again."
      );
    }
    if (page.isPublished && !body.trim()) {
      throw new ConvexError("A published page cannot have an empty body");
    }
    await ctx.db.patch("legalPages", page._id, {
      title,
      body,
      // Strictly increasing, so `updatedAt` works as an edit token even for
      // two saves within the same millisecond.
      updatedAt: Math.max(Date.now(), page.updatedAt + 1),
      updatedBy: admin.userId ?? admin._id,
    });
    // Details carry sizes only, never the body text.
    await logAudit(ctx, {
      action: "update_legal_page",
      targetId: args.slug,
      targetType: "legalPage",
      details: `title=${title.length.toString()} chars, body=${body.length.toString()} chars, published=${String(page.isPublished)}`,
    });
    return null;
  },
});

/**
 * Publish or unpublish a legal page. Publishing stamps `publishedAt` and needs
 * reviewed content (no draft notice, not the unedited starter template);
 * unpublishing keeps the body. Admin only.
 */
export const setLegalPagePublished = mutation({
  args: { slug: legalSlugValidator, isPublished: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const page = await getLegalPageRow(ctx, args.slug);
    // Publishing changes visibility only, so `updatedAt` (the public "Last
    // updated" date) and `updatedBy` keep describing the last content edit.
    if (args.isPublished) {
      assertPublishable(page);
      await ctx.db.patch("legalPages", page._id, {
        isPublished: true,
        publishedAt: Date.now(),
      });
    } else {
      await ctx.db.patch("legalPages", page._id, { isPublished: false });
    }
    await logAudit(ctx, {
      action: args.isPublished ? "publish_legal_page" : "unpublish_legal_page",
      targetId: args.slug,
      targetType: "legalPage",
    });
    return null;
  },
});
