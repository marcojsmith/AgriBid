import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link } from "react-router-dom";
import { MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";

import { LEGAL_PAGE_META } from "@/components/legal/legalPages";
import { useBranding } from "@/hooks/useBranding";

const FOOTER_SECTIONS = [
  {
    title: "Buy",
    links: [
      { name: "Live auctions", href: "/auctions" },
      { name: "Auction rules", href: "/faq" },
    ],
  },
  {
    title: "Sell and help",
    links: [
      { name: "List equipment", href: "/sell" },
      { name: "Contact support", href: "/support" },
    ],
  },
] as const;

const LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground transition-colors hover:text-primary md:min-h-8";

/**
 * Footer component for the application.
 *
 * Reads the app name and the company details from `BrandingContext`, which the
 * layout provides. Each company row (address, phone, WhatsApp, registration
 * and VAT number) is hidden when it is not set, and the whole "Company" column
 * goes when nothing is set, so there is never an empty heading. The legal row
 * links Terms, Privacy and PAIA manual only for pages an admin has published.
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

  const businessName = branding?.appName ?? "AgriBid";
  const telephone = businessInfo?.telephone?.trim() ?? "";
  const whatsapp = businessInfo?.whatsapp?.trim() ?? "";
  const registrationNo = businessInfo?.registrationNo?.trim() ?? "";
  const vatNo = businessInfo?.vatNo?.trim() ?? "";
  // wa.me links take digits only (country code included, no "+").
  const whatsappDigits = whatsapp.replace(/\D/g, "");

  const address = [
    businessInfo?.streetAddress,
    businessInfo?.addressLocality,
    businessInfo?.addressCountry,
    businessInfo?.postalCode,
  ]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part)
    .join(", ");

  const hasCompanyDetails = Boolean(
    address || telephone || whatsappDigits || registrationNo || vatNo
  );

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4 lg:gap-12">
          <div className="col-span-2 space-y-3 lg:col-span-1">
            <div className="font-display text-[21px] font-bold text-primary">
              {businessName}
            </div>
            <p className="text-sm text-muted-foreground">
              South Africa&rsquo;s online auction floor for farm machinery.
            </p>
            <p className="flex items-start gap-2 text-sm font-medium text-primary">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              Every seller FICA-verified before listing
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-foreground">
                {section.title}
              </h2>
              <ul>
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link to={link.href} className={LINK_CLASS}>
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {hasCompanyDetails && (
            <div className="col-span-2 lg:col-span-1">
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-foreground">
                Company
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {address && (
                  <li className="flex items-start gap-2">
                    <MapPin
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm hover:text-primary"
                    >
                      {address}
                    </a>
                  </li>
                )}
                {telephone && (
                  <li className="flex items-center gap-2">
                    <Phone aria-hidden="true" className="size-4 shrink-0" />
                    <a
                      href={`tel:${telephone.replace(/[^0-9+]/g, "")}`}
                      className="rounded-sm hover:text-primary"
                    >
                      {telephone}
                    </a>
                  </li>
                )}
                {whatsappDigits && (
                  <li className="flex items-center gap-2">
                    <MessageCircle
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                    <a
                      href={`https://wa.me/${whatsappDigits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm hover:text-primary"
                    >
                      WhatsApp {whatsapp}
                    </a>
                  </li>
                )}
                {registrationNo && <li>Reg. no. {registrationNo}</li>}
                {vatNo && <li>VAT no. {vatNo}</li>}
              </ul>
            </div>
          )}
        </div>

        <div
          data-testid="footer-legal"
          className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-5 text-[13px] text-muted-foreground"
        >
          <span>
            &copy; {new Date().getFullYear()} {businessName}
          </span>
          {legalLinks.map((page) => (
            <Link
              key={page.slug}
              to={page.path}
              className="inline-flex min-h-11 items-center rounded-sm hover:text-primary md:min-h-8"
            >
              {page.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
};
