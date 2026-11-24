/**
 * The letters shown on the header avatar. A full name gives the first letters
 * of its first and last words ("Thandi Naidoo" gives "TN"); a single word gives
 * its first letter; with no name the first letter of the email is used.
 *
 * @param name - The person's full name, if known
 * @param email - Their email address, if known
 * @returns One or two uppercase letters, or null when there is nothing to show
 */
export function initialsOf(name?: string, email?: string): string | null {
  const words = (name ?? "").split(/\s+/).filter((word) => word.length > 0);
  const first = words.at(0);
  const last = words.at(-1);
  if (first && last) {
    const letters =
      words.length === 1
        ? first.charAt(0)
        : `${first.charAt(0)}${last.charAt(0)}`;
    return letters.toUpperCase();
  }
  const mail = (email ?? "").trim();
  return mail.length > 0 ? mail.charAt(0).toUpperCase() : null;
}
