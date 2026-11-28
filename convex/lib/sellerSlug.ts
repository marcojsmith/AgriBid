/**
 * Pure helpers for the public seller name and its URL slug.
 *
 * No database or runtime access here, so the client and the tests can import
 * this file freely. The database side (uniqueness, redirects) lives in
 * `sellerSlugs.ts`.
 */

/** Longest slug `slugify` returns (a `-2` style suffix may be added after it). */
export const MAX_SLUG_LENGTH = 60;

/** Slug used when a name has no letters or digits at all (symbols, emoji). */
export const FALLBACK_SLUG = "seller";

/** Inputs for {@link publicNameFor}. The names must already be decrypted. */
export interface PublicNameInput {
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}

/**
 * First character of a word, upper-cased, without splitting an emoji or other
 * surrogate pair in half.
 *
 * @param word - A trimmed, non-empty word
 * @returns The upper-cased first character
 */
function initialOf(word: string): string {
  return Array.from(word)[0].toUpperCase();
}

/**
 * The name buyers see for a seller: the trimmed company name when set,
 * otherwise the first name plus the surname's initial ("Thandi N."). When there
 * are no separate names, the first and last words of `name` are used the same
 * way.
 *
 * @param input - The seller's company name and (decrypted) names
 * @returns The public name, or null when nothing usable exists
 */
export function publicNameFor(input: PublicNameInput): string | null {
  const company = input.companyName?.trim().replace(/\s+/g, " ");
  if (company) return company;

  const first = input.firstName?.trim();
  if (first) {
    const last = input.lastName?.trim();
    return last ? `${first} ${initialOf(last)}.` : first;
  }

  const words = (input.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1) return words[0];
  return `${words[0]} ${initialOf(words[words.length - 1])}.`;
}

/** Letters that do not decompose into a base letter plus an accent. */
const SPECIAL_LETTERS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  ł: "l",
  đ: "d",
};

/**
 * Turns a public name into a URL slug: lower-case ASCII, accents removed,
 * apostrophes dropped, every other run of non-alphanumerics becomes one "-",
 * trimmed of "-" and capped at {@link MAX_SLUG_LENGTH} characters.
 *
 * @param name - The public name
 * @returns The slug; empty when the name has no letters or digits
 */
export function slugify(name: string): string {
  const folded = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[ßæœøłđ]/g, (letter) => SPECIAL_LETTERS[letter] ?? "")
    .replace(/['‘’`]/g, "");
  return folded
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * The slug base for a public name: its slug, or {@link FALLBACK_SLUG} when the
 * name reduces to nothing.
 *
 * @param publicName - The seller's public name
 * @returns A non-empty slug base
 */
export function slugBaseFor(publicName: string): string {
  return slugify(publicName) || FALLBACK_SLUG;
}

/**
 * Whether a stored slug was derived from this base: the base itself or the base
 * plus a clash suffix such as `-2`.
 *
 * @param slug - The stored slug
 * @param base - A slug base from {@link slugBaseFor}
 * @returns True when the slug belongs to the base
 */
export function slugHasBase(slug: string, base: string): boolean {
  if (slug === base) return true;
  return (
    slug.startsWith(`${base}-`) && /^\d+$/.test(slug.slice(base.length + 1))
  );
}

/**
 * The first word of a name, used so reviews only ever show a first name.
 *
 * @param name - A public name or display name
 * @returns The first word, or undefined when there is none
 */
export function firstWordOf(
  name: string | null | undefined
): string | undefined {
  return name?.trim().split(/\s+/).find(Boolean);
}
