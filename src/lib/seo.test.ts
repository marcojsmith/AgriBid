import { describe, it, expect } from "vitest";

import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  ORGANIZATION_SCHEMA,
  buildTitle,
  buildCanonical,
  truncate,
  buildAuctionDescription,
  buildBreadcrumbSchema,
} from "./seo";

describe("SEO constants", () => {
  it("SITE_NAME is AgriBid", () => {
    expect(SITE_NAME).toBe("AgriBid");
  });

  it("SITE_URL falls back to agribid.co.za when env var is absent", () => {
    expect(SITE_URL).toBe("https://agribid.co.za");
  });

  it("DEFAULT_TITLE contains site name", () => {
    expect(DEFAULT_TITLE).toContain(SITE_NAME);
  });

  it("DEFAULT_DESCRIPTION is non-empty", () => {
    expect(DEFAULT_DESCRIPTION.length).toBeGreaterThan(0);
  });

  it("DEFAULT_OG_IMAGE is an absolute URL", () => {
    expect(DEFAULT_OG_IMAGE).toMatch(/^https?:\/\//);
  });

  it("ORGANIZATION_SCHEMA has correct type and name", () => {
    expect(ORGANIZATION_SCHEMA["@type"]).toBe("Organization");
    expect(ORGANIZATION_SCHEMA.name).toBe(SITE_NAME);
    expect(ORGANIZATION_SCHEMA.url).toBe(SITE_URL);
  });

  it("ORGANIZATION_SCHEMA address is in ZA", () => {
    expect(ORGANIZATION_SCHEMA.address.addressCountry).toBe("ZA");
  });
});

describe("buildTitle", () => {
  it("appends site name with separator", () => {
    expect(buildTitle("Home")).toBe("Home | AgriBid");
  });

  it("uses the provided page title verbatim", () => {
    expect(buildTitle("2022 John Deere 6R 150")).toBe(
      "2022 John Deere 6R 150 | AgriBid"
    );
  });

  it("handles empty string", () => {
    expect(buildTitle("")).toBe("AgriBid");
  });
});

describe("buildCanonical", () => {
  it("prepends SITE_URL to a root path", () => {
    expect(buildCanonical("/")).toBe(`${SITE_URL}/`);
  });

  it("prepends SITE_URL to a nested path", () => {
    expect(buildCanonical("/auction/abc123")).toBe(
      `${SITE_URL}/auction/abc123`
    );
  });

  it("does not double-slash", () => {
    const result = buildCanonical("/sell");
    expect(result).not.toContain("//sell");
  });
});

describe("truncate", () => {
  it("returns original string when within limit", () => {
    expect(truncate("short text", 20)).toBe("short text");
  });

  it("truncates and appends ellipsis when over limit", () => {
    const result = truncate("abcdefghij", 6);
    expect(result).toHaveLength(6);
    expect(result).toMatch(/…$/);
  });

  it("returns string unchanged when exactly at limit", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("keeps result within maxLen after truncation", () => {
    const result = truncate("a".repeat(200), 160);
    expect(result.length).toBe(160);
  });
});

describe("buildAuctionDescription", () => {
  it("uses make/model/year when all provided", () => {
    const result = buildAuctionDescription(
      "Tractor Listing",
      2020,
      "John Deere",
      "6R 150",
      "Johannesburg"
    );
    expect(result).toContain("2020 John Deere 6R 150");
  });

  it("falls back to title when make/model/year are missing", () => {
    const result = buildAuctionDescription(
      "Tractor Listing",
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(result).toContain("Tractor Listing");
  });

  it("includes location when provided", () => {
    const result = buildAuctionDescription(
      "Tractor",
      2021,
      "Kubota",
      "M7",
      "Cape Town"
    );
    expect(result).toContain("Cape Town");
  });

  it("omits location phrase when location is undefined", () => {
    const result = buildAuctionDescription(
      "Tractor",
      2021,
      "Kubota",
      "M7",
      undefined
    );
    expect(result).not.toContain("located in");
  });

  it("always includes platform reference", () => {
    const result = buildAuctionDescription(
      "Harvester",
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(result).toContain("AgriBid");
  });

  it("respects 160-char limit", () => {
    const result = buildAuctionDescription(
      "A".repeat(200),
      2019,
      "B".repeat(50),
      "C".repeat(50),
      "D".repeat(50)
    );
    expect(result.length).toBeLessThanOrEqual(160);
  });
});

describe("buildBreadcrumbSchema", () => {
  it("returns a BreadcrumbList schema with correct context", () => {
    const schema = buildBreadcrumbSchema([
      { name: "Home", url: "https://agribid.co.za/" },
    ]);
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("BreadcrumbList");
  });

  it("maps crumbs to ListItem entries with correct positions", () => {
    const schema = buildBreadcrumbSchema([
      { name: "Home", url: "https://agribid.co.za/" },
      { name: "Auction", url: "https://agribid.co.za/auction/abc" },
    ]);
    expect(schema.itemListElement).toHaveLength(2);
    expect(schema.itemListElement[0]).toMatchObject({
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://agribid.co.za/",
    });
    expect(schema.itemListElement[1]).toMatchObject({
      "@type": "ListItem",
      position: 2,
      name: "Auction",
    });
  });

  it("handles an empty crumbs array", () => {
    const schema = buildBreadcrumbSchema([]);
    expect(schema.itemListElement).toHaveLength(0);
  });

  it("positions are 1-based", () => {
    const schema = buildBreadcrumbSchema([
      { name: "A", url: "https://agribid.co.za/a" },
      { name: "B", url: "https://agribid.co.za/b" },
      { name: "C", url: "https://agribid.co.za/c" },
    ]);
    const positions = schema.itemListElement.map((e) => e.position);
    expect(positions).toEqual([1, 2, 3]);
  });
});
