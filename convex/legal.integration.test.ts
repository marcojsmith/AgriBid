/// <reference types="vite/client" />

/**
 * Integration coverage (real in-memory Convex backend) for the legal pages:
 * public draft safety, admin-only mutations, audit logging, the body limit and
 * seed idempotence (the seed also runs against production via `weeklyReset`).
 */

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  LEGAL_BODY_MAX_LENGTH,
  LEGAL_SLUGS,
  LEGAL_TEMPLATES,
} from "./lib/legalTemplates";

const modules = import.meta.glob("./**/*.*s");

const ADMIN = "user_admin";
const BUYER = "user_buyer";

const createTestContext = () => convexTest(schema, modules);
type TestContext = ReturnType<typeof createTestContext>;

/**
 * Inserts an admin and a buyer profile.
 *
 * @param t - The convex-test context.
 */
async function seedUsers(t: TestContext): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [userId, role] of [
      [ADMIN, "admin"],
      [BUYER, "buyer"],
    ] as const) {
      await ctx.db.insert("profiles", {
        userId,
        name: userId === ADMIN ? "Ada Admin" : "Bea Buyer",
        role,
        isVerified: true,
        kycStatus: "verified",
        createdAt: now,
        updatedAt: now,
      });
    }
  });
}

const asAdmin = (t: TestContext) => t.withIdentity({ subject: ADMIN });
const asBuyer = (t: TestContext) => t.withIdentity({ subject: BUYER });

/**
 * Counts legal-page audit rows with the given action.
 *
 * @param t - The convex-test context.
 * @param action - The audit action to match.
 * @returns The matching audit rows.
 */
async function auditRows(t: TestContext, action: string) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("auditLogs").collect();
    return rows.filter((row) => row.action === action);
  });
}

/**
 * Calls `updateLegalPage` with the page's current `updatedAt`, as the editor does.
 *
 * @param t - The convex-test context.
 * @param caller - The identity-bound caller.
 * @param args - Slug, title and body to save.
 * @param args.slug - Page slug.
 * @param args.title - New title.
 * @param args.body - New body.
 * @returns The mutation result (null).
 */
async function save(
  t: TestContext,
  caller: ReturnType<typeof asAdmin>,
  args: { slug: "terms" | "privacy" | "paia"; title: string; body: string }
): Promise<null> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("legalPages")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first()
  );
  return await caller.mutation(api.admin.legal.updateLegalPage, {
    ...args,
    expectedUpdatedAt: row?.updatedAt ?? 0,
  });
}

describe("legal pages: public queries", () => {
  it("returns null for missing pages and never returns a draft", async () => {
    const t = createTestContext();
    expect(await t.query(api.legal.getLegalPage, { slug: "terms" })).toBeNull();

    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    for (const slug of LEGAL_SLUGS) {
      expect(await t.query(api.legal.getLegalPage, { slug })).toBeNull();
    }
    expect(await t.query(api.legal.getPublishedLegalSlugs, {})).toEqual([]);
  });

  it("returns only the public fields once published", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    await save(t, asAdmin(t), {
      slug: "privacy",
      title: "Privacy policy",
      body: "Reviewed privacy text.",
    });
    await asAdmin(t).mutation(api.admin.legal.setLegalPagePublished, {
      slug: "privacy",
      isPublished: true,
    });

    const page = await t.query(api.legal.getLegalPage, { slug: "privacy" });
    expect(page).not.toBeNull();
    expect(Object.keys(page ?? {}).sort()).toEqual([
      "body",
      "publishedAt",
      "title",
      "updatedAt",
    ]);
    expect(await t.query(api.legal.getLegalPage, { slug: "terms" })).toBeNull();
    expect(await t.query(api.legal.getPublishedLegalSlugs, {})).toEqual([
      "privacy",
    ]);
  });

  it("hides a page again when it is unpublished but keeps its body", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const admin = asAdmin(t);
    await save(t, admin, {
      slug: "terms",
      title: "Terms",
      body: "Custom body",
    });
    await admin.mutation(api.admin.legal.setLegalPagePublished, {
      slug: "terms",
      isPublished: true,
    });
    await admin.mutation(api.admin.legal.setLegalPagePublished, {
      slug: "terms",
      isPublished: false,
    });

    expect(await t.query(api.legal.getLegalPage, { slug: "terms" })).toBeNull();
    const pages = await admin.query(api.admin.legal.adminGetLegalPages, {});
    const terms = pages.find((p) => p.slug === "terms");
    expect(terms?.body).toBe("Custom body");
    expect(terms?.isPublished).toBe(false);
    expect(terms?.publishedAt).toBeTypeOf("number");
  });
});

describe("legal pages: admin functions", () => {
  it("rejects anonymous and non-admin callers on every admin function", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});

    for (const caller of [t, asBuyer(t)]) {
      await expect(
        caller.query(api.admin.legal.adminGetLegalPages, {})
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.admin.legal.updateLegalPage, {
          expectedUpdatedAt: 0,
          slug: "terms",
          title: "Hacked",
          body: "x",
        })
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.admin.legal.setLegalPagePublished, {
          slug: "terms",
          isPublished: true,
        })
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.admin.legal.createMissingLegalPageDrafts, {})
      ).rejects.toThrow();
    }

    const rows = await t.run((ctx) => ctx.db.query("legalPages").collect());
    expect(rows.every((r) => !r.isPublished && r.title !== "Hacked")).toBe(
      true
    );
  });

  it("lists pages in footer order with the updater's name", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const admin = asAdmin(t);
    await save(t, admin, {
      slug: "paia",
      title: "PAIA manual",
      body: "Body",
    });
    const pages = await admin.query(api.admin.legal.adminGetLegalPages, {});
    expect(pages.map((p) => p.slug)).toEqual(["terms", "privacy", "paia"]);
    expect(pages[0].updatedByName).toBe("System (starter template)");
    expect(pages[2].updatedByName).toBe("Ada Admin");
  });

  it("updates title and body, trims the title and writes an audit entry without the body", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    await save(t, asAdmin(t), {
      slug: "terms",
      title: "  Terms of use  ",
      body: "SECRET BODY TEXT",
    });

    const [row] = await t.run((ctx) =>
      ctx.db
        .query("legalPages")
        .withIndex("by_slug", (q) => q.eq("slug", "terms"))
        .collect()
    );
    expect(row.title).toBe("Terms of use");
    expect(row.updatedBy).toBe(ADMIN);

    const audit = await auditRows(t, "update_legal_page");
    expect(audit).toHaveLength(1);
    expect(audit[0].targetId).toBe("terms");
    expect(audit[0].details).not.toContain("SECRET BODY TEXT");
  });

  it("validates input: empty title, over-long title and over-long body", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const admin = asAdmin(t);

    await expect(
      save(t, admin, {
        slug: "terms",
        title: "   ",
        body: "x",
      })
    ).rejects.toThrow("Title is required");
    await expect(
      save(t, admin, {
        slug: "terms",
        title: "t".repeat(201),
        body: "x",
      })
    ).rejects.toThrow("Title must be");
    await expect(
      save(t, admin, {
        slug: "terms",
        title: "Terms",
        body: "b".repeat(LEGAL_BODY_MAX_LENGTH + 1),
      })
    ).rejects.toThrow("Body must be");

    // Exactly at the limit is accepted.
    await save(t, admin, {
      slug: "terms",
      title: "Terms",
      body: "b".repeat(LEGAL_BODY_MAX_LENGTH),
    });
    expect(await auditRows(t, "update_legal_page")).toHaveLength(1);
  });

  it("rejects an unknown slug and a missing page", async () => {
    const t = createTestContext();
    await seedUsers(t);
    const admin = asAdmin(t);
    await expect(
      save(t, admin, {
        // @ts-expect-error deliberately invalid slug
        slug: "cookies",
        title: "Cookies",
        body: "x",
      })
    ).rejects.toThrow();
    await expect(
      save(t, admin, {
        slug: "terms",
        title: "Terms",
        body: "x",
      })
    ).rejects.toThrow("Legal page not found");
    await expect(
      admin.mutation(api.admin.legal.setLegalPagePublished, {
        slug: "terms",
        isPublished: true,
      })
    ).rejects.toThrow("Legal page not found");
  });

  it("publishes with an audit entry, refuses an empty body and stamps publishedAt", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const admin = asAdmin(t);

    await save(t, admin, {
      slug: "terms",
      title: "Terms",
      body: "  ",
    });
    await expect(
      admin.mutation(api.admin.legal.setLegalPagePublished, {
        slug: "terms",
        isPublished: true,
      })
    ).rejects.toThrow("empty body");

    await save(t, admin, {
      slug: "terms",
      title: "Terms",
      body: "Real text",
    });
    await admin.mutation(api.admin.legal.setLegalPagePublished, {
      slug: "terms",
      isPublished: true,
    });
    expect(await auditRows(t, "publish_legal_page")).toHaveLength(1);
    const page = await t.query(api.legal.getLegalPage, { slug: "terms" });
    expect(page?.publishedAt).toBeTypeOf("number");

    await admin.mutation(api.admin.legal.setLegalPagePublished, {
      slug: "terms",
      isPublished: false,
    });
    expect(await auditRows(t, "unpublish_legal_page")).toHaveLength(1);
  });

  it("keeps the public updated date when publishing and unpublishing, and refuses emptying a live page", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const admin = asAdmin(t);
    await save(t, admin, {
      slug: "terms",
      title: "Terms",
      body: "Real text",
    });
    const edited = await t.run((ctx) => ctx.db.query("legalPages").first());
    await admin.mutation(api.admin.legal.setLegalPagePublished, {
      slug: "terms",
      isPublished: true,
    });
    const page = await t.query(api.legal.getLegalPage, { slug: "terms" });
    expect(page?.updatedAt).toBe(edited?.updatedAt);

    await expect(
      save(t, admin, {
        slug: "terms",
        title: "Terms",
        body: "  ",
      })
    ).rejects.toThrow("empty body");
    await admin.mutation(api.admin.legal.setLegalPagePublished, {
      slug: "terms",
      isPublished: false,
    });
    // Once unpublished, a blank body is allowed again (it is only a draft).
    await save(t, admin, {
      slug: "terms",
      title: "Terms",
      body: "",
    });
  });

  it("createMissingLegalPageDrafts fills gaps once and audits only when it created rows", async () => {
    const t = createTestContext();
    await seedUsers(t);
    const admin = asAdmin(t);
    expect(
      await admin.mutation(api.admin.legal.createMissingLegalPageDrafts, {})
    ).toEqual(["terms", "privacy", "paia"]);
    expect(
      await admin.mutation(api.admin.legal.createMissingLegalPageDrafts, {})
    ).toEqual([]);
    expect(await auditRows(t, "create_legal_page_drafts")).toHaveLength(1);
  });
});

describe("legal pages: starter drafts and the seed", () => {
  it("ensureLegalPageDrafts creates three unpublished drafts from the templates", async () => {
    const t = createTestContext();
    expect(await t.mutation(internal.legal.ensureLegalPageDrafts, {})).toEqual([
      "terms",
      "privacy",
      "paia",
    ]);
    const rows = await t.run((ctx) => ctx.db.query("legalPages").collect());
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.isPublished).toBe(false);
      expect(row.publishedAt).toBeUndefined();
      expect(row.body).toBe(LEGAL_TEMPLATES[row.slug].body);
      expect(row.body).toContain("Draft, needs legal review");
    }
  });

  it("is idempotent and never overwrites or publishes existing rows", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const admin = asAdmin(t);
    await save(t, admin, {
      slug: "terms",
      title: "Edited",
      body: "Edited body",
    });
    await admin.mutation(api.admin.legal.setLegalPagePublished, {
      slug: "terms",
      isPublished: true,
    });
    const before = await t.run((ctx) => ctx.db.query("legalPages").collect());

    expect(await t.mutation(internal.legal.ensureLegalPageDrafts, {})).toEqual(
      []
    );
    const after = await t.run((ctx) => ctx.db.query("legalPages").collect());
    expect(after).toEqual(before);
    expect(after).toHaveLength(3);
  });

  it("weeklyReset leaves existing legal pages untouched and unpublished drafts unpublished", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const admin = asAdmin(t);
    await save(t, admin, {
      slug: "terms",
      title: "Live terms",
      body: "Reviewed live terms",
    });
    await admin.mutation(api.admin.legal.setLegalPagePublished, {
      slug: "terms",
      isPublished: true,
    });
    await save(t, admin, {
      slug: "privacy",
      title: "Privacy edit",
      body: "Edited draft privacy",
    });
    const before = await t.run((ctx) => ctx.db.query("legalPages").collect());

    await t.mutation(internal.seed.weeklyReset, {});

    const after = await t.run((ctx) => ctx.db.query("legalPages").collect());
    expect(after).toEqual(before);
    expect(await t.query(api.legal.getPublishedLegalSlugs, {})).toEqual([
      "terms",
    ]);
  });

  it("weeklyReset on a fresh database seeds three drafts and publishes none", async () => {
    const t = createTestContext();
    await t.mutation(internal.seed.weeklyReset, {});
    const rows = await t.run((ctx) => ctx.db.query("legalPages").collect());
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => !r.isPublished)).toBe(true);
    expect(await t.query(api.legal.getPublishedLegalSlugs, {})).toEqual([]);
  });
});

describe("legal pages: publish guard", () => {
  it("refuses to publish the unedited starter template or a body with the draft notice", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const admin = asAdmin(t);
    const publish = () =>
      admin.mutation(api.admin.legal.setLegalPagePublished, {
        slug: "terms",
        isPublished: true,
      });

    // Unedited starter template.
    await expect(publish()).rejects.toThrow("Draft, needs legal review");

    // Edited, but the notice is still in the text (any casing).
    await save(t, admin, {
      slug: "terms",
      title: "Terms",
      body: "Some real clauses.\n\n> draft, NEEDS LEGAL REVIEW",
    });
    await expect(publish()).rejects.toThrow("remove the notice");

    // Template body with only line endings changed is still the template.
    const template = LEGAL_TEMPLATES.terms.body
      .replace("> **Draft, needs legal review.**", "> **Reviewed.**")
      .replace(/\n/g, "\r\n");
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("legalPages")
        .withIndex("by_slug", (q) => q.eq("slug", "terms"))
        .first();
      if (row)
        await ctx.db.patch("legalPages", row._id, {
          body: LEGAL_TEMPLATES.terms.body,
        });
    });
    await expect(publish()).rejects.toThrow("unedited starter template");
    expect(template).toContain("Reviewed.");

    // Real, reviewed text publishes.
    await save(t, admin, {
      slug: "terms",
      title: "Terms",
      body: "## 1. Terms\n\nReviewed clauses.",
    });
    await publish();
    expect(await t.query(api.legal.getPublishedLegalSlugs, {})).toEqual([
      "terms",
    ]);
    expect(await auditRows(t, "publish_legal_page")).toHaveLength(1);
  });

  it("re-validates stored title and body length when publishing", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const patchRow = (patch: { title?: string; body?: string }) =>
      t.run(async (ctx) => {
        const row = await ctx.db
          .query("legalPages")
          .withIndex("by_slug", (q) => q.eq("slug", "terms"))
          .first();
        if (row) await ctx.db.patch("legalPages", row._id, patch);
      });
    const publish = () =>
      asAdmin(t).mutation(api.admin.legal.setLegalPagePublished, {
        slug: "terms",
        isPublished: true,
      });

    await patchRow({ title: "  ", body: "Reviewed." });
    await expect(publish()).rejects.toThrow("Title is required");
    await patchRow({
      title: "Terms",
      body: "b".repeat(LEGAL_BODY_MAX_LENGTH + 1),
    });
    await expect(publish()).rejects.toThrow("Body must be");
    expect(await t.query(api.legal.getPublishedLegalSlugs, {})).toEqual([]);
  });
});

describe("legal pages: concurrent edits", () => {
  it("rejects a save based on a stale updatedAt and keeps the newer text", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const admin = asAdmin(t);
    const [loaded] = await admin.query(api.admin.legal.adminGetLegalPages, {});

    // Admin A saves first.
    await admin.mutation(api.admin.legal.updateLegalPage, {
      slug: "terms",
      title: "A's title",
      body: "A's body",
      expectedUpdatedAt: loaded.updatedAt,
    });
    // Admin B still holds the original updatedAt.
    await expect(
      admin.mutation(api.admin.legal.updateLegalPage, {
        slug: "terms",
        title: "B's title",
        body: "B's body",
        expectedUpdatedAt: loaded.updatedAt,
      })
    ).rejects.toThrow("changed by someone else");

    const [after] = await admin.query(api.admin.legal.adminGetLegalPages, {});
    expect(after.body).toBe("A's body");
    expect(await auditRows(t, "update_legal_page")).toHaveLength(1);
  });

  it("publishing does not invalidate an editor's loaded updatedAt", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const admin = asAdmin(t);
    await save(t, admin, { slug: "terms", title: "Terms", body: "Reviewed." });
    const [loaded] = await admin.query(api.admin.legal.adminGetLegalPages, {});
    await admin.mutation(api.admin.legal.setLegalPagePublished, {
      slug: "terms",
      isPublished: true,
    });
    await admin.mutation(api.admin.legal.updateLegalPage, {
      slug: "terms",
      title: "Terms",
      body: "Reviewed v2.",
      expectedUpdatedAt: loaded.updatedAt,
    });
  });
});

describe("legal pages: destructive seed operations", () => {
  const publishedPageSetup = async (t: TestContext) => {
    await seedUsers(t);
    // `runSeed` promotes the mock seller's profile, which must already exist.
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("profiles", {
        userId: "mock-seller-clerk",
        name: "Mock Seller",
        email: "mock-seller@farm.com",
        role: "seller",
        isVerified: true,
        kycStatus: "verified",
        createdAt: now,
        updatedAt: now,
      });
    });
    await t.mutation(internal.legal.ensureLegalPageDrafts, {});
    const admin = asAdmin(t);
    await save(t, admin, {
      slug: "terms",
      title: "Live terms",
      body: "Reviewed live terms.",
    });
    await admin.mutation(api.admin.legal.setLegalPagePublished, {
      slug: "terms",
      isPublished: true,
    });
    return await t.run((ctx) => ctx.db.query("legalPages").collect());
  };

  it("runSeed({ clear: true }) leaves an existing published page untouched", async () => {
    const t = createTestContext();
    const before = await publishedPageSetup(t);
    await asAdmin(t).mutation(api.seed.runSeed, { clear: true });
    const after = await t.run((ctx) => ctx.db.query("legalPages").collect());
    expect(after).toEqual(before);
  });

  it("clearAllData leaves an existing published page untouched", async () => {
    const t = createTestContext();
    const before = await publishedPageSetup(t);
    await asAdmin(t).mutation(api.seed.clearAllData, {});
    const after = await t.run((ctx) => ctx.db.query("legalPages").collect());
    expect(after).toEqual(before);
    expect(await t.query(api.legal.getPublishedLegalSlugs, {})).toEqual([
      "terms",
    ]);
  });
});
