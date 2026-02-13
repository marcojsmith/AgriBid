import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import { useSession, signOut } from "../lib/auth-client";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Menu, X, User, LogOut, LayoutDashboard, Heart } from "lucide-react";

export const Header = () => {
  const { data: session } = useSession();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { name: "Marketplace", href: "/" },
    { name: "Sell", href: "/sell" },
    { name: "Watchlist", href: "#" },
  ];

  return (
    <header className="border-b bg-card lg:sticky lg:top-0 z-50">
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

        <div className="flex items-center gap-2">
          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-4">
            <Authenticated>
              <div className="flex flex-col items-end mr-2">
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

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="md:hidden border-t bg-card animate-in slide-in-from-top-4 duration-200">
          <div className="container mx-auto px-4 py-6 space-y-6">
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "text-lg font-black uppercase tracking-tight",
                    location.pathname === link.href ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            <div className="pt-6 border-t">
              <Authenticated>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase leading-none">{session?.user?.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Verified Member</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="justify-start gap-2 font-bold uppercase text-[10px]" asChild>
                      <Link to="#" onClick={() => setIsMenuOpen(false)}>
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        My Bids
                      </Link>
                    </Button>
                    <Button variant="outline" className="justify-start gap-2 font-bold uppercase text-[10px]" asChild>
                      <Link to="#" onClick={() => setIsMenuOpen(false)}>
                        <Heart className="h-3.5 w-3.5" />
                        Watchlist
                      </Link>
                    </Button>
                  </div>
                  <Button 
                    variant="destructive" 
                    className="w-full font-black uppercase text-xs tracking-widest h-12 rounded-xl"
                    onClick={async () => {
                      await signOut();
                      setIsMenuOpen(false);
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </Authenticated>

              <Unauthenticated>
                <Button 
                  className="w-full h-14 text-lg font-black uppercase tracking-tight rounded-2xl shadow-xl shadow-primary/20"
                  asChild
                >
                  <Link to="/" onClick={() => setIsMenuOpen(false)}>Sign In to AgriBid</Link>
                </Button>
              </Unauthenticated>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
