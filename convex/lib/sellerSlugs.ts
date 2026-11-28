import { decryptPII } from "./encryption";
import {
  MAX_SLUG_LENGTH,
  publicNameFor,
  slugBaseFor,
  slugHasBase,
} from "./sellerSlug";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Numbered suffixes (`-2` to `-N`) tried before switching to random ones. */
const MAX_NUMBERED_ATTEMPTS = 50;
/** Random suffixes tried after the numbered ones, before giving up. */
const MAX_RANDOM_ATTEMPTS = 20;

/**
 * Decrypts a stored name, treating an unreadable value as missing so a bad
 * ciphertext never blocks a lot submission or a profile save.
 *
 * @param value - A stored (encrypted or legacy plain) name
 * @returns The plain name, or undefined
 */
async function safeDecrypt(
  value: string | undefined
): Promise<string | undefined> {
  try {
    return await decryptPII(value);
  } catch {
    return undefined;
  }
}

/**
 * The public name for a profile, reading its encrypted names.
 *
 * @param profile - The seller's profile
 * @returns The public name, or null when the profile has no usable name
 */
export async function publicNameForProfile(
  profile: Doc<"profiles">
): Promise<string | null> {
  const company = profile.companyName?.trim();
  if (company) return publicNameFor({ companyName: company });
  const [firstName, lastName, fullName] = await Promise.all([
    safeDecrypt(profile.firstName),
    safeDecrypt(profile.lastName),
    safeDecrypt(profile.fullName),
  ]);
  return publicNameFor({
    firstName,
    lastName,
    name: fullName ?? profile.name,
  });
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
  const publicName = await publicNameForProfile(profile);
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
  const lot = await ctx.db
    .query("lots")
    .withIndex("by_seller", (q) => q.eq("sellerId", userId))
    .filter((q) => q.neq(q.field("status"), "draft"))
    .first();
  return lot !== null;
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
