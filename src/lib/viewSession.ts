const STORAGE_KEY = "agribid.viewSession";

/** Matches the server's `SESSION_ID_PATTERN` in `convex/engagement.ts`. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Makes a random id the server accepts for anonymous lot views.
 *
 * @returns A 32-character id of letters and digits
 */
function makeSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The anonymous session id sent with `recordLotView`, kept in `sessionStorage`
 * so a visitor's repeat views in one tab count once. It identifies no one:
 * it is random and never linked to an account. When storage is unavailable
 * (private mode) a fresh id is used for the call.
 *
 * @returns A valid session id
 */
export function getViewSessionId(): string {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored !== null && SESSION_ID_PATTERN.test(stored)) return stored;
    const created = makeSessionId();
    sessionStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return makeSessionId();
  }
}
