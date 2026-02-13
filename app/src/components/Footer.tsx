import { Link } from "react-router-dom";
import { ShieldCheck, HelpCircle, BookOpen, Scale, Mail, Phone, MapPin } from "lucide-react";

export const Footer = () => {
  const footerSections = [
    {
      title: "Platform",
      links: [
        { name: "How it Works", href: "#", icon: BookOpen },
        { name: "Safety & Trust", href: "#", icon: ShieldCheck },
        { name: "Auction Rules", href: "#", icon: Scale },
      ],
    },
    {
      title: "Support",
      links: [
        { name: "Help Center", href: "#", icon: HelpCircle },
        { name: "Contact Us", href: "#", icon: Mail },
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
            <div className="font-black text-3xl tracking-tighter text-primary">AGRIBID</div>
            <p className="text-xs text-muted-foreground leading-relaxed uppercase font-bold tracking-wide">
              The national marketplace for heavy machinery. Built for farmers, by farmers. 
              We provide a transparent, high-integrity platform for equipment liquidation.
            </p>
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="text-[10px] font-black uppercase text-primary leading-tight">
                Verified Seller<br />Network
              </p>
            </div>
          </div>

          {/* Navigation Sections */}
          {footerSections.map((section) => (
            <div key={section.title} className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">{section.title}</h3>
              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link 
                      to={link.href} 
                      className="group flex items-center gap-3 text-xs font-bold uppercase text-muted-foreground hover:text-primary transition-colors"
                    >
                      <link.icon className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact Info */}
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Headquarters</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-xs font-bold uppercase text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>123 Harvest Road<br />Agricultural Hub, ZA 4500</span>
              </li>
              <li className="flex items-center gap-3 text-xs font-bold uppercase text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span>+27 (0) 11 555 0123</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-muted flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            © {new Date().getFullYear()} AGRIBID. All rights reserved.
          </p>
          <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Link to="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="#" className="hover:text-primary transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
