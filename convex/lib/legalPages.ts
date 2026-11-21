import { ConvexError } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  DRAFT_NOTICE_MARKER,
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
  if (!trimmedTitle) throw new ConvexError("Title is required");
  if (trimmedTitle.length > LEGAL_TITLE_MAX_LENGTH) {
    throw new ConvexError(
      `Title must be ${LEGAL_TITLE_MAX_LENGTH.toLocaleString("en-ZA")} characters or fewer`
    );
  }
  if (body.length > LEGAL_BODY_MAX_LENGTH) {
    throw new ConvexError(
      `Body must be ${LEGAL_BODY_MAX_LENGTH.toLocaleString("en-ZA")} characters or fewer`
    );
  }
  return { title: trimmedTitle, body };
}

/**
 * Normalises line endings and surrounding whitespace for comparison.
 *
 * @param text - The text to normalise.
 * @returns The text with LF line endings and no surrounding whitespace.
 */
const normalise = (text: string): string => text.replace(/\r\n/g, "\n").trim();

/**
 * Refuse to publish a page that is empty, invalid, still carries the draft
 * notice or is identical to its starter template.
 *
 * @param page - The stored page row.
 * @throws ConvexError with an admin-readable message when it must not go live.
 */
export function assertPublishable(page: Doc<"legalPages">): void {
  if (!page.body.trim()) {
    throw new ConvexError("Cannot publish a page with an empty body");
  }
  // Re-validate stored content (title present, lengths within limits).
  validateLegalContent(page.title, page.body);
  const template = LEGAL_TEMPLATE_LIST.find((t) => t.slug === page.slug);
  if (
    page.body.toLowerCase().includes(DRAFT_NOTICE_MARKER.toLowerCase()) ||
    (template && normalise(page.body) === normalise(template.body))
  ) {
    throw new ConvexError(
      `This page still contains the "${DRAFT_NOTICE_MARKER}" notice or the unedited starter template. Complete and review the text, and remove the notice, before publishing.`
    );
  }
}
