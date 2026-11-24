/**
 * User-agent tokens of the link-preview crawlers that never run JavaScript.
 * Googlebot is left out on purpose: serving it different HTML would be cloaking.
 * Also used verbatim in the `has` rules of `vercel.json`.
 */
export const PREVIEW_CRAWLER_UA =
  "facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|SkypeUriPreview|Pinterestbot|redditbot|Embedly";

const CRAWLER_PATTERN = new RegExp(PREVIEW_CRAWLER_UA, "i");

/**
 * Whether a User-Agent header belongs to a link-preview crawler.
 *
 * @param ua - The User-Agent header value
 * @returns True for a known preview crawler
 */
export function isPreviewCrawler(ua: string | null): boolean {
  return ua !== null && CRAWLER_PATTERN.test(ua);
}
