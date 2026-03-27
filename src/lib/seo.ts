// src/lib/seo.ts
// Centralised SEO configuration and helpers

export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ??
  "https://agribid.co.za"
).replace(/\/+$/, "");

export const SITE_NAME = "AgriBid";

export const DEFAULT_TITLE =
  "AgriBid – South Africa's Agricultural Equipment Auction Platform";
export const DEFAULT_DESCRIPTION =
  "Buy and sell farming equipment at auction. AgriBid is the national marketplace for heavy machinery — built for farmers, by farmers.";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: DEFAULT_DESCRIPTION,
  address: {
    "@type": "PostalAddress",
    streetAddress: "123 Harvest Road",
    addressLocality: "Agricultural Hub",
    addressCountry: "ZA",
    postalCode: "4500",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+27-11-555-0123",
    contactType: "customer service",
  },
  sameAs: [],
} as const;

/**
 * Build a page title in the format "Page Name | AgriBid".
 *
 * @param pageTitle - The page-specific title component
 * @returns The formatted title string
 */
export function buildTitle(pageTitle: string): string {
  const trimmed = pageTitle.trim();
  return trimmed ? `${trimmed} | ${SITE_NAME}` : SITE_NAME;
}

/**
 * Build a BreadcrumbList JSON-LD schema object.
 *
 * @param crumbs - Ordered list of breadcrumb items with name and full URL
 * @returns A schema.org BreadcrumbList object
 */
export function buildBreadcrumbSchema(
  crumbs: { name: string; url?: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/**
 * Build a canonical URL for a given path.
 *
 * @param path - The URL path (e.g. "/auction/123")
 * @returns The full canonical URL
 */
export function buildCanonical(path: string): string {
  const normalizedPath = path.trim().startsWith("/")
    ? path.trim()
    : `/${path.trim()}`;
  return `${SITE_URL}${normalizedPath}`;
}

/**
 * Truncate a string to maxLen chars, appending "…" if needed.
 *
 * @param text - The text to truncate
 * @param maxLen - Maximum allowed length
 * @returns The (possibly truncated) string
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

/**
 * Build a meta description from auction fields.
 *
 * @param title - Auction title, used as fallback when make/model/year are unavailable
 * @param year - Equipment manufacture year
 * @param make - Equipment make/brand
 * @param model - Equipment model
 * @param location - Auction location
 * @returns A description string of at most 160 characters
 */
export function buildAuctionDescription(
  title: string,
  year: number | undefined,
  make: string | undefined,
  model: string | undefined,
  location: string | undefined
): string {
  const parts = [
    year && make && model ? `${year} ${make} ${model}` : title,
    location ? `located in ${location}` : null,
    "Live auction on AgriBid — South Africa's agricultural equipment marketplace.",
  ].filter(Boolean);
  return truncate(parts.join(", "), 160);
}
