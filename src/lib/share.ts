/** What gets shared. */
export interface SharePayload {
  /** Title of the shared item, e.g. the lot title. */
  title: string;
  /** Prefill text, e.g. "John Deere 8370RT on AgriBid, closes Tue 25 Nov, 11:00". */
  text: string;
  /** Absolute link to share. */
  url: string;
}

/** How a share ended. */
export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/**
 * Shares a link with the native share sheet, or copies "{text} {url}" to the
 * clipboard when the browser has no share sheet.
 *
 * @param payload - Title, prefill text and link
 * @returns `shared`, `copied`, `cancelled` (the user dismissed the sheet) or `failed`
 */
export async function shareOrCopy(payload: SharePayload): Promise<ShareResult> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
