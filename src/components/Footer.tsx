import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link } from "react-router-dom";
import { Phone } from "lucide-react";

import { WhatsAppButton } from "@/components/ds/WhatsAppButton";
import { LEGAL_PAGE_META } from "@/components/legal/legalPages";
import { useBranding } from "@/hooks/useBranding";
import { telLink, whatsappLink } from "@/lib/homeSales";

/** Links that are always shown, before the published legal pages. */
const FOOTER_LINKS = [
  { name: "Fees & rules", href: "/faq" },
  { name: "Sell equipment", href: "/sell" },
  { name: "Help", href: "/support" },
] as const;

const LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground transition-colors hover:text-primary md:min-h-8";

/**
 * Footer (design system Footer): the brand, the company name and address, the
 * phone number, the WhatsApp logo, the links and the copyright. Every company
 * detail comes from the admin business settings through `BrandingContext` and
 * is hidden when it is not set, so there is never a placeholder or an empty
 * row (the registration and VAT numbers only show once an admin enters them).
 * The legal row links Terms, Privacy and PAIA only for pages an admin has
 * published.
 *
 * @returns The rendered footer.
 */
export const Footer = () => {
  const branding = useBranding();
  const businessInfo = branding?.businessInfo;
  // Only published legal pages are linked; unpublished ones are hidden.
  const publishedLegalSlugs = useQuery(api.legal.getPublishedLegalSlugs);
  const legalLinks = LEGAL_PAGE_META.filter((page) =>
    publishedLegalSlugs?.includes(page.slug)
  );

  const brand = branding?.appName ?? "AgriBid";
  const entity = businessInfo?.businessName?.trim() ?? "";
  const telephone = businessInfo?.telephone?.trim() ?? "";
  const registrationNo = businessInfo?.registrationNo?.trim() ?? "";
  const vatNo = businessInfo?.vatNo?.trim() ?? "";
  const tel = telLink(telephone);
  const waHref = whatsappLink(businessInfo?.whatsapp);

  const address = [
    businessInfo?.streetAddress,
    businessInfo?.addressLocality,
    businessInfo?.addressCountry,
    businessInfo?.postalCode,
  ]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part)
    .join(", ");

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto max-w-[1200px] px-4 py-8 md:py-10">
        <div className="grid gap-6 md:grid-cols-3 md:gap-10">
          <div className="space-y-1">
            <div className="font-display text-[26px] leading-tight font-bold text-primary">
              {brand}
            </div>
            {entity && entity !== brand ? (
              <p className="text-sm text-muted-foreground">{entity}</p>
            ) : null}
            {address ? (
              <p className="text-sm text-muted-foreground">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm hover:text-primary"
                >
                  {address}
                </a>
              </p>
            ) : null}
            {registrationNo ? (
              <p className="text-sm text-muted-foreground">
                Reg. no. {registrationNo}
              </p>
            ) : null}
            {vatNo ? (
              <p className="text-sm text-muted-foreground">VAT no. {vatNo}</p>
            ) : null}
          </div>

          {tel || waHref ? (
            <div className="space-y-2">
              {tel ? (
                <a
                  href={tel}
                  className="num inline-flex min-h-11 items-center gap-2 rounded-sm font-medium hover:text-primary"
                >
                  <Phone aria-hidden="true" className="size-[18px]" />
                  {telephone}
                </a>
              ) : null}
              {waHref ? (
                <div>
                  <WhatsAppButton href={waHref} />
                </div>
              ) : null}
            </div>
          ) : null}

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-5 gap-y-0"
          >
            {FOOTER_LINKS.map((link) => (
              <Link key={link.name} to={link.href} className={LINK_CLASS}>
                {link.name}
              </Link>
            ))}
            <span data-testid="footer-legal" className="contents">
              {legalLinks.map((page) => (
                <Link key={page.slug} to={page.path} className={LINK_CLASS}>
                  {page.label}
                </Link>
              ))}
            </span>
          </nav>
        </div>

        <p className="mt-6 border-t border-border pt-5 text-[13px] text-muted-foreground">
          &copy; {new Date().getFullYear()} {brand}
        </p>
      </div>
    </footer>
  );
};
