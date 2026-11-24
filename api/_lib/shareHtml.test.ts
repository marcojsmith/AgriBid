// @vitest-environment node
import { describe, expect, it } from "vitest";

import { escapeHtml, renderShareHtml } from "./shareHtml";

const META = {
  title: "New Holland T6070 · Lot 3 · AgriBid",
  description: "Current bid R 414 000 · Closes Wed 25 Nov, 11:00",
  url: "https://example.com/auction/abc",
  imageUrl: "https://example.com/api/og?kind=lot&id=abc&v=x",
  imageAlt: "New Holland T6070: Current bid R 414 000",
};

describe("renderShareHtml", () => {
  it("emits every tag", () => {
    const html = renderShareHtml(META);
    for (const needle of [
      `<title>${META.title}</title>`,
      `<link rel="canonical" href="${META.url}">`,
      `name="description"`,
      `property="og:type" content="website"`,
      `property="og:site_name" content="AgriBid"`,
      `property="og:locale" content="en_ZA"`,
      `property="og:title"`,
      `property="og:description"`,
      `property="og:url" content="${META.url}"`,
      `property="og:image:type" content="image/jpeg"`,
      `property="og:image:width" content="1200"`,
      `property="og:image:height" content="630"`,
      `property="og:image:alt"`,
      `name="twitter:card" content="summary_large_image"`,
      `name="twitter:title"`,
      `name="twitter:description"`,
      `name="twitter:image"`,
      "<h1>",
      `<a href="${META.url}">`,
    ]) {
      expect(html).toContain(needle);
    }
    expect(html).toContain("kind=lot&amp;id=abc&amp;v=x");
  });

  it("escapes & < > and quotes", () => {
    const html = renderShareHtml({
      ...META,
      title: `A & B <script>"x"</script>`,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain(
      "A &amp; B &lt;script&gt;&quot;x&quot;&lt;/script&gt;"
    );
  });

  it("escapeHtml leaves plain text alone", () => {
    expect(escapeHtml("plain")).toBe("plain");
  });
});
