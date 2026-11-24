import type { ShareMeta } from "./shareMeta.js";

/**
 * Escapes text for use in HTML text and double-quoted attributes.
 *
 * @param text - Raw text
 * @returns The escaped text
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders the small HTML page a link-preview crawler reads.
 *
 * @param m - The tags to emit
 * @returns The HTML document
 */
export function renderShareHtml(m: ShareMeta): string {
  const e = escapeHtml;
  const metas: [string, string, string][] = [
    ["name", "description", m.description],
    ["property", "og:type", "website"],
    ["property", "og:site_name", "AgriBid"],
    ["property", "og:locale", "en_ZA"],
    ["property", "og:title", m.title],
    ["property", "og:description", m.description],
    ["property", "og:url", m.url],
    ["property", "og:image", m.imageUrl],
    ["property", "og:image:type", "image/jpeg"],
    ["property", "og:image:width", "1200"],
    ["property", "og:image:height", "630"],
    ["property", "og:image:alt", m.imageAlt],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", m.title],
    ["name", "twitter:description", m.description],
    ["name", "twitter:image", m.imageUrl],
  ];
  const tags = metas
    .map(
      ([attr, key, value]) => `<meta ${attr}="${key}" content="${e(value)}">`
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${e(m.title)}</title>
<link rel="canonical" href="${e(m.url)}">
${tags}
</head>
<body>
<h1>${e(m.title)}</h1>
<p>${e(m.description)}</p>
<p><a href="${e(m.url)}">Open on AgriBid</a></p>
</body>
</html>
`;
}
