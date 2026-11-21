/** The slug of a legal page, matching the `legalPages.slug` column. */
export type LegalSlug = "terms" | "privacy" | "paia";

/** Footer and routing metadata for each legal page, in footer order. */
export const LEGAL_PAGE_META: readonly {
  slug: LegalSlug;
  /** Short label for the footer link. */
  label: string;
  /** Public route. */
  path: string;
  /** SEO title and fallback heading. */
  title: string;
}[] = [
  {
    slug: "terms",
    label: "Terms",
    path: "/terms",
    title: "Terms and conditions",
  },
  {
    slug: "privacy",
    label: "Privacy",
    path: "/privacy",
    title: "Privacy policy",
  },
  { slug: "paia", label: "PAIA manual", path: "/paia", title: "PAIA manual" },
];
