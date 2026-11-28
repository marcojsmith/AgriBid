import { decryptPII } from "./encryption";
import {
  MAX_SLUG_LENGTH,
  publicNameFor,
  slugBaseFor,
  slugHasBase,
} from "./sellerSlug";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Every lot status except `draft`: a lot in any of them has been submitted. */
const SUBMITTED_STATUSES = [
  "pending_review",
  "approved",
  "assigned",
  "under_consideration",
  "sold",
  "unsold",
  "rejected",
] as const;

/** Numbered suffixes (`-2` to `-N`) tried before switching to random ones. */
const MAX_NUMBERED_ATTEMPTS = 50;
/** Random suffixes tried after the numbered ones, before giving up. */
const MAX_RANDOM_ATTEMPTS = 20;

/** A stored name field after reading: empty, readable, or unreadable. */
type NameRead =
  { state: "empty" } | { state: "ok"; text: string } | { state: "failed" };

/**
 * Reads a stored (encrypted or legacy plain) name field. An unreadable value is
 * reported as `failed`, not as empty, so a misconfigured key cannot look like a
 * name change.
 *
 * @param value - The stored name
 * @returns Whether it is empty, its plain text, or that decryption failed
 */
async function readName(value: string | undefined): Promise<NameRead> {
  if (value === undefined) return { state: "empty" };
  try {
    const text = (await decryptPII(value))?.trim();
    return text ? { state: "ok", text } : { state: "empty" };
  } catch {
    return { state: "failed" };
  }
}

/**
 * Works out the public name for a profile and whether a stored name could not
 * be read.
 *
 * Order: company name; else the registration `fullName` (first word + initial
 * of the last word); else the legacy `firstName` / `lastName`; else the
 * account `name`.
 *
 * @param profile - The seller's profile
 * @returns The name (null when nothing is usable) and whether a stored name field failed to decrypt
 */
async function resolvePublicName(
  profile: Doc<"profiles">
): Promise<{ name: string | null; decryptFailed: boolean }> {
  const company = profile.companyName?.trim();
  if (company) {
    return {
      name: publicNameFor({ companyName: company }),
      decryptFailed: false,
    };
  }
  const [full, first, last] = await Promise.all([
    readName(profile.fullName),
    readName(profile.firstName),
    readName(profile.lastName),
  ]);
  const decryptFailed = [full, first, last].some((r) => r.state === "failed");
  const text = (r: NameRead) => (r.state === "ok" ? r.text : undefined);

  if (full.state === "ok") {
    return { name: publicNameFor({ name: full.text }), decryptFailed };
  }
  if (first.state === "ok") {
    return {
      name: publicNameFor({ firstName: first.text, lastName: text(last) }),
      decryptFailed,
    };
  }
  return { name: publicNameFor({ name: profile.name }), decryptFailed };
}

/**
 * The public name for a profile, reading its encrypted names. Shared by the
 * seller slug and the seller name shown to winners.
 *
 * @param profile - The seller's profile
 * @returns The public name, or null when the profile has no usable name
 */
export async function publicNameForProfile(
  profile: Doc<"profiles">
): Promise<string | null> {
  return (await resolvePublicName(profile)).name;
}

/**
 * Whether a slug may be given to this user: no other profile holds it and no
 * other user's redirect reserves it.
 *
 * @param ctx - Query or mutation context
 * @param slug - The candidate slug
 * @param userId - The user who wants it
 * @returns True when the slug is free for this user
 */
async function slugFreeFor(
  ctx: QueryCtx,
  slug: string,
  userId: string
): Promise<boolean> {
  const holder = await ctx.db
    .query("profiles")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (holder && holder.userId !== userId) return false;
  const redirect = await ctx.db
    .query("sellerSlugRedirects")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  return !redirect || redirect.userId === userId;
}

/**
 * The first free slug for a base: the base itself, then `-2`, `-3`, and so on.
 *
 * @param ctx - Query or mutation context
 * @param base - A slug base from `slugBaseFor`
 * @param userId - The user who wants it
 * @returns A slug no other user holds or has held
 */
async function pickFreeSlug(
  ctx: QueryCtx,
  base: string,
  userId: string
): Promise<string> {
  if (await slugFreeFor(ctx, base, userId)) return base;
  for (let n = 2; n <= MAX_NUMBERED_ATTEMPTS; n++) {
    const candidate = `${base.slice(0, MAX_SLUG_LENGTH)}-${String(n)}`;
    if (await slugFreeFor(ctx, candidate, userId)) return candidate;
  }
  // A very common name: stop walking the numbers (each try is two reads inside
  // a lot submission) and use a random suffix instead.
  for (let i = 0; i < MAX_RANDOM_ATTEMPTS; i++) {
    const suffix = String(1000 + Math.floor(Math.random() * 9_000_000));
    const candidate = `${base.slice(0, MAX_SLUG_LENGTH)}-${suffix}`;
    if (await slugFreeFor(ctx, candidate, userId)) return candidate;
  }
  throw new Error("Could not find a free seller slug");
}

/**
 * Gives a seller their public name and URL slug, or updates them.
 *
 * - No slug yet: the slug is the name's slug, with `-2`, `-3`, ... on a clash
 *   (with another profile's slug or any redirect).
 * - Slug set and the name's slug base changed: the old slug is saved as a
 *   redirect and a new slug is assigned the same way.
 * - Slug set and only the name text changed (same base): just the name is
 *   updated, the slug stays.
 *
 * A slug is never reused by another user. If the user takes back one of their
 * own old slugs, its redirect row is removed so it cannot loop.
 *
 * @param ctx - Mutation context
 * @param profile - The seller's profile as currently stored
 * @returns The seller's slug, or null when the profile has no usable name yet
 */
export async function assignSellerSlug(
  ctx: MutationCtx,
  profile: Doc<"profiles">
): Promise<string | null> {
  const { name: publicName, decryptFailed } = await resolvePublicName(profile);
  if (decryptFailed) {
    // A stored name could not be read (wrong or missing key): changing the
    // seller's public name from a fallback would rename them wrongly.
    console.warn(
      "assignSellerSlug: a stored name could not be decrypted; slug and public name left unchanged"
    );
    return profile.slug ?? null;
  }
  if (publicName === null) return profile.slug ?? null;

  const base = slugBaseFor(publicName);

  // Did the name's slug base change? Compare with the base of the name the slug
  // was made from; parsing `-N` back off the slug would mistake a name that ends
  // in a number ("Agri 4") for a clash suffix. Rows from before `publicName`
  // existed fall back to reading the slug.
  const sameBase =
    profile.slug !== undefined &&
    (profile.publicName !== undefined
      ? slugBaseFor(profile.publicName) === base
      : slugHasBase(profile.slug, base));

  if (profile.slug !== undefined && sameBase) {
    if (profile.publicName !== publicName) {
      await ctx.db.patch("profiles", profile._id, { publicName });
    }
    return profile.slug;
  }

  if (profile.slug !== undefined) {
    await ctx.db.insert("sellerSlugRedirects", {
      slug: profile.slug,
      userId: profile.userId,
      createdAt: Date.now(),
    });
  }

  const slug = await pickFreeSlug(ctx, base, profile.userId);

  // Taking back one of their own old slugs: drop the redirect.
  const ownRedirect = await ctx.db
    .query("sellerSlugRedirects")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (ownRedirect) await ctx.db.delete("sellerSlugRedirects", ownRedirect._id);

  await ctx.db.patch("profiles", profile._id, { publicName, slug });
  return slug;
}

/**
 * Whether a user has submitted a lot: any lot that is not a draft.
 *
 * @param ctx - Query or mutation context
 * @param userId - The user to check
 * @returns True when the user has at least one non-draft lot
 */
export async function hasSubmittedLot(
  ctx: QueryCtx,
  userId: string
): Promise<boolean> {
  for (const status of SUBMITTED_STATUSES) {
    const lot = await ctx.db
      .query("lots")
      .withIndex("by_seller_status", (q) =>
        q.eq("sellerId", userId).eq("status", status)
      )
      .first();
    if (lot) return true;
  }
  return false;
}

/**
 * Brings a seller's public name and slug up to date after something that feeds
 * the name changed (company name, registration name). Does nothing for a user
 * who has never submitted a lot and has no slug, so buyers never get one.
 *
 * @param ctx - Mutation context
 * @param profile - The profile as currently stored
 * @returns The seller's slug, or null when none exists or could be made
 */
export async function syncSellerSlug(
  ctx: MutationCtx,
  profile: Doc<"profiles">
): Promise<string | null> {
  if (
    profile.slug === undefined &&
    !(await hasSubmittedLot(ctx, profile.userId))
  ) {
    return null;
  }
  return await assignSellerSlug(ctx, profile);
}

/**
 * Makes sure a user who just submitted a lot has a slug. Does nothing when they
 * already have one or have no profile.
 *
 * @param ctx - Mutation context
 * @param userId - The seller's user id
 * @returns The seller's slug, or null when none exists or could be made
 */
export async function ensureSellerSlug(
  ctx: MutationCtx,
  userId: string
): Promise<string | null> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) return null;
  if (profile.slug !== undefined) return profile.slug;
  return await assignSellerSlug(ctx, profile);
}
