// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isPreviewCrawler, PREVIEW_CRAWLER_UA } from "./crawlers";

const CRAWLERS = [
  "WhatsApp/2.23.20.0 A",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Twitterbot/1.0",
  "Mozilla/5.0 (compatible; LinkedInBot/1.0; +https://www.linkedin.com)",
  "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  "TelegramBot (like TwitterBot)",
  "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
];

const BROWSERS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
];

/**
 * Reads the `has` regex of the crawler rewrites from vercel.json.
 *
 * @returns The regex Vercel will apply to the user-agent header
 */
function vercelRegex(): RegExp {
  const config = JSON.parse(
    readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
  ) as {
    rewrites: { has?: { key: string; value: string }[] }[];
  };
  const rule = config.rewrites.find((r) => r.has?.[0]?.key === "user-agent");
  return new RegExp(rule?.has?.[0]?.value ?? "$^");
}

describe("isPreviewCrawler", () => {
  it.each(CRAWLERS)("matches %s", (ua) => {
    expect(isPreviewCrawler(ua)).toBe(true);
  });

  it.each(BROWSERS)("does not match %s", (ua) => {
    expect(isPreviewCrawler(ua)).toBe(false);
  });

  it("does not match a missing user agent", () => {
    expect(isPreviewCrawler(null)).toBe(false);
  });
});

describe("vercel.json crawler rewrites", () => {
  it("uses the same tokens as PREVIEW_CRAWLER_UA", () => {
    expect(vercelRegex().source).toContain(PREVIEW_CRAWLER_UA);
  });

  it.each(CRAWLERS)("matches %s", (ua) => {
    expect(vercelRegex().test(ua)).toBe(true);
  });

  it.each(BROWSERS)("does not match %s", (ua) => {
    expect(vercelRegex().test(ua)).toBe(false);
  });

  it("puts the crawler rewrites before the SPA catch-all", () => {
    const config = JSON.parse(
      readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
    ) as { rewrites: { source: string; has?: unknown }[] };
    const last = config.rewrites[config.rewrites.length - 1];
    expect(last.has).toBeUndefined();
    expect(config.rewrites.slice(0, -1).every((r) => r.has)).toBe(true);
  });
});
