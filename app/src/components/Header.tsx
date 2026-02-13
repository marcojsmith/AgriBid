import { Link, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import { useSession, signOut } from "../lib/auth-client";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export const Header = () => {
  const { data: session } = useSession();
  const location = useLocation();

  const navLinks = [
    { name: "Marketplace", href: "/" },
    { name: "Sell", href: "/sell" },
    { name: "Watchlist", href: "#" },
  ];

  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-black text-2xl tracking-tighter text-primary">AGRIBID</Link>
          
          <nav className="hidden md:flex gap-6 text-sm font-bold uppercase tracking-wider">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className={cn(
                  "transition-colors hover:text-primary",
                  location.pathname === link.href ? "text-primary" : "text-muted-foreground"
                )}
              >
                {link.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Authenticated>
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-[10px] font-black uppercase text-muted-foreground leading-none">Verified User</span>
              <span className="text-sm font-bold text-primary leading-none mt-1">{session?.user?.name}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => await signOut()}
              className="font-bold uppercase text-[10px] tracking-widest rounded-lg border-2 h-9"
            >
              Sign Out
            </Button>
          </Authenticated>
          
          <Unauthenticated>
            <Button 
              size="sm" 
              asChild
              className="font-bold uppercase text-[10px] tracking-widest rounded-lg h-9 shadow-lg shadow-primary/20"
            >
              <Link to="/">Sign In</Link>
            </Button>
          </Unauthenticated>
        </div>
      </div>
    </header>
  );
};
