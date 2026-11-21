import { Link } from "react-router-dom";
import {
  ShieldCheck,
  HelpCircle,
  BookOpen,
  Scale,
  Mail,
  Phone,
  MapPin,
  MessageCircle,
  CalendarClock,
} from "lucide-react";

import { useBranding } from "@/hooks/useBranding";

/**
 * Footer component for the application.
 * Displays business info from admin settings.
 *
 * Reads the app name and business details from `BrandingContext`, which the
 * layout provides, instead of subscribing to `admin.getBusinessInfo` again.
 *
 * @returns The rendered footer.
 */
export const Footer = () => {
  const branding = useBranding();
  const businessInfo = branding?.businessInfo;

  const businessName = branding?.appName ?? "AgriBid";
  const streetAddress = businessInfo?.streetAddress ?? "";
  const addressLocality = businessInfo?.addressLocality ?? "";
  const addressCountry = businessInfo?.addressCountry ?? "";
  const postalCode = businessInfo?.postalCode ?? "";
  const telephone = businessInfo?.telephone?.trim() ?? "";
  const whatsapp = businessInfo?.whatsapp?.trim() ?? "";
  const registrationNo = businessInfo?.registrationNo?.trim() ?? "";
  const vatNo = businessInfo?.vatNo?.trim() ?? "";
  // wa.me links take digits only (country code included, no "+").
  const whatsappDigits = whatsapp.replace(/\D/g, "");

  const addressParts = [
    streetAddress,
    addressLocality,
    addressCountry,
    postalCode,
  ]
    .filter((part) => part)
    .join(", ");

  const hasCompanyDetails = Boolean(
    addressParts || telephone || whatsappDigits || registrationNo || vatNo
  );

  const footerSections = [
    {
      title: "Platform",
      links: [
        { name: "Auctions", href: "/auctions", icon: CalendarClock },
        { name: "How it Works", href: "/faq", icon: BookOpen },
        { name: "Safety & Trust", href: "#", icon: ShieldCheck },
        { name: "Auction Rules", href: "#", icon: Scale },
      ],
    },
    {
      title: "Support",
      links: [
        { name: "Help Center", href: "#", icon: HelpCircle },
        { name: "Contact Us", href: "/support", icon: Mail },
        { name: "Terms of Service", href: "#", icon: Scale },
      ],
    },
  ];

  return (
    <footer className="bg-muted/30 border-t py-8 md:py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-8 md:gap-10 lg:grid-cols-4 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1 space-y-4 md:space-y-6">
            <div className="font-bold text-3xl text-primary">
              {businessName.toUpperCase()}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The national marketplace for heavy machinery. Built for farmers,
              by farmers. We provide a transparent, high-integrity platform for
              equipment liquidation.
            </p>
            <div className="flex gap-3 md:gap-4">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold text-primary leading-tight">
                Verified Seller
                <br />
                Network
              </p>
            </div>
          </div>

          {/* Navigation Sections */}
          {footerSections.map((section) => (
            <div key={section.title} className="space-y-4 md:space-y-6">
              <h3 className="text-xs font-semibold text-primary">
                {section.title}
              </h3>
              <ul className="space-y-3 md:space-y-4">
                {section.links.map((link) => {
                  const isPlaceholder = link.href.startsWith("#");
                  const content = (
                    <>
                      <link.icon className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                      {link.name}
                    </>
                  );
                  const className =
                    "group flex items-center gap-2 md:gap-3 text-xs text-muted-foreground hover:text-primary transition-colors";

                  return (
                    <li key={link.name}>
                      {isPlaceholder ? (
                        <a href={link.href} className={className}>
                          {content}
                        </a>
                      ) : (
                        <Link to={link.href} className={className}>
                          {content}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Company details: each row (and the whole column) only renders when set. */}
          {hasCompanyDetails && (
            <div className="col-span-2 md:col-span-1 space-y-4 md:space-y-6">
              <h3 className="text-xs font-semibold text-primary">Company</h3>
              <ul className="space-y-3 md:space-y-4">
                {addressParts && (
                  <li className="flex items-start gap-2 md:gap-3 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressParts)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors"
                    >
                      {addressParts}
                    </a>
                  </li>
                )}
                {telephone && (
                  <li className="flex items-center gap-2 md:gap-3 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <a
                      href={`tel:${telephone.replace(/[^0-9+]/g, "")}`}
                      className="hover:text-primary transition-colors"
                    >
                      {telephone}
                    </a>
                  </li>
                )}
                {whatsappDigits && (
                  <li className="flex items-center gap-2 md:gap-3 text-xs text-muted-foreground">
                    <MessageCircle className="h-3.5 w-3.5" />
                    <a
                      href={`https://wa.me/${whatsappDigits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors"
                    >
                      WhatsApp {whatsapp}
                    </a>
                  </li>
                )}
                {registrationNo && (
                  <li className="text-xs text-muted-foreground">
                    Reg. no. {registrationNo}
                  </li>
                )}
                {vatNo && (
                  <li className="text-xs text-muted-foreground">
                    VAT no. {vatNo}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 md:mt-16 md:pt-8 border-t border-muted flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {businessName}. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
