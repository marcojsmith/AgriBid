import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  ShieldCheck,
  HelpCircle,
  BookOpen,
  Scale,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

/**
 * Footer component for the application.
 * Displays business info from admin settings.
 *
 * @returns The rendered footer.
 */
export const Footer = () => {
  const businessInfo = useQuery(api.admin.getBusinessInfo);

  const businessName = businessInfo?.businessName || "AgriBid";
  const streetAddress = businessInfo?.streetAddress || "";
  const addressLocality = businessInfo?.addressLocality || "";
  const addressCountry = businessInfo?.addressCountry || "";
  const postalCode = businessInfo?.postalCode || "";
  const telephone = businessInfo?.telephone || "";

  const addressParts = [
    streetAddress,
    addressLocality,
    addressCountry,
    postalCode,
  ]
    .filter((part) => part)
    .join(", ");

  const footerSections = [
    {
      title: "Platform",
      links: [
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
    <footer className="bg-muted/30 border-t py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="space-y-6">
            <div className="font-black text-3xl tracking-tighter text-primary">
              {businessName.toUpperCase()}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed uppercase font-bold tracking-wide">
              The national marketplace for heavy machinery. Built for farmers,
              by farmers. We provide a transparent, high-integrity platform for
              equipment liquidation.
            </p>
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="text-[10px] font-black uppercase text-primary leading-tight">
                Verified Seller
                <br />
                Network
              </p>
            </div>
          </div>

          {/* Navigation Sections */}
          {footerSections.map((section) => (
            <div key={section.title} className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                {section.title}
              </h3>
              <ul className="space-y-4">
                {section.links.map((link) => {
                  const isPlaceholder = link.href.startsWith("#");
                  const content = (
                    <>
                      <link.icon className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                      {link.name}
                    </>
                  );
                  const className =
                    "group flex items-center gap-3 text-xs font-bold uppercase text-muted-foreground hover:text-primary transition-colors";

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

          {/* Contact Info */}
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              Headquarters
            </h3>
            <ul className="space-y-4">
              {addressParts && (
                <li className="flex items-start gap-3 text-xs font-bold uppercase text-muted-foreground">
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
                <li className="flex items-center gap-3 text-xs font-bold uppercase text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <a
                    href={`tel:${telephone.replace(/[^0-9+]/g, "")}`}
                    className="hover:text-primary transition-colors"
                  >
                    {telephone}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-muted flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            © {new Date().getFullYear()} {businessName}. All rights reserved.
          </p>
          <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
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
