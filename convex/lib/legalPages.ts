import type { MutationCtx } from "../_generated/server";
import {
  LEGAL_BODY_MAX_LENGTH,
  LEGAL_TEMPLATE_LIST,
  LEGAL_TITLE_MAX_LENGTH,
  type LegalSlug,
} from "./legalTemplates";

/** Value stored in `updatedBy` for rows created by the seed or system. */
export const LEGAL_SYSTEM_USER = "SYSTEM";

/**
 * Create any missing legal page rows from the starter templates.
 *
 * Idempotent and safe to run against production: an existing row is never
 * touched (body, title and publish state are all left alone), and a new row is
 * always created UNPUBLISHED.
 *
 * @param ctx - Convex mutation context.
 * @param updatedBy - Who to record as the creator (admin user id or "SYSTEM").
 * @returns The slugs that were created.
 */
export async function ensureLegalPageDraftRows(
  ctx: MutationCtx,
  updatedBy: string = LEGAL_SYSTEM_USER
): Promise<LegalSlug[]> {
  const created: LegalSlug[] = [];
  for (const template of LEGAL_TEMPLATE_LIST) {
    const slug = template.slug;
    const existing = await ctx.db
      .query("legalPages")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) continue;
    await ctx.db.insert("legalPages", {
      slug,
      title: template.title,
      body: template.body,
      isPublished: false,
      updatedAt: Date.now(),
      updatedBy,
    });
    created.push(slug);
  }
  return created;
}

/**
 * Validate and normalise a legal page title and body.
 *
 * @param title - Proposed title.
 * @param body - Proposed markdown body.
 * @returns The trimmed title and the body unchanged.
 * @throws If the title is empty or too long, or the body is too long.
 */
export function validateLegalContent(
  title: string,
  body: string
): { title: string; body: string } {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error("Title is required");
  if (trimmedTitle.length > LEGAL_TITLE_MAX_LENGTH) {
    throw new Error(
      `Title must be ${LEGAL_TITLE_MAX_LENGTH.toLocaleString("en-ZA")} characters or fewer`
    );
  }
  if (body.length > LEGAL_BODY_MAX_LENGTH) {
    throw new Error(
      `Body must be ${LEGAL_BODY_MAX_LENGTH.toLocaleString("en-ZA")} characters or fewer`
    );
  }
  return { title: trimmedTitle, body };
}
