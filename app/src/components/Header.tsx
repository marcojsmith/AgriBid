import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import { useSession, signOut } from "../lib/auth-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import { Menu, X, User, LogOut, LayoutDashboard, Heart, ChevronDown, Settings, Search } from "lucide-react";
import { toast } from "sonner";
import type { UserWithRole } from "../types/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Header = () => {
  const { data: session } = useSession();
  const user = session?.user as UserWithRole | undefined;
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const navLinks = [
    { name: "Marketplace", href: "/" },
    { name: "Sell", href: "/sell" },
    { name: "Watchlist", href: "#", disabled: true },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setIsMenuOpen(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      console.error('Sign out failed:', error);
      toast.error("Failed to sign out. Please try again.");
    }
  };

  return (
    <header className="border-b bg-card lg:sticky lg:top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8 shrink-0">
          <Link to="/" className="font-black text-2xl tracking-tighter text-primary">AGRIBID</Link>
          
          <nav className="hidden lg:flex gap-6 text-sm font-bold uppercase tracking-wider">
            {navLinks.map((link) => (
              link.disabled ? (
                <span
                  key={link.name}
                  className="text-muted-foreground/50 cursor-not-allowed transition-colors"
                  aria-disabled="true"
                >
                  {link.name}
                </span>
              ) : (
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
              )
            ))}
          </nav>
        </div>

        {/* Global Search - Desktop */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md relative">
          <label htmlFor="search-desktop" className="sr-only">Search equipment</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search-desktop"
            type="search"
            placeholder="Search equipment (Make, Model, Year)..."
            className="pl-10 h-10 bg-muted/50 border-2 rounded-xl focus-visible:ring-primary focus-visible:border-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop Auth */}
          <div className="hidden md:flex items-center">
            <Authenticated>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2 hover:bg-primary/5 h-12 rounded-xl group">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black uppercase text-muted-foreground leading-none">Verified User</span>
                      <span className="text-sm font-bold text-primary leading-none mt-1">{user?.name}</span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <User className="h-4 w-4" />
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl border-2 p-2 shadow-xl">
                  <DropdownMenuLabel className="font-black uppercase text-[10px] tracking-widest text-muted-foreground px-2 py-1.5">
                    Account Menu
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user?.role === "admin" && (
                    <DropdownMenuItem asChild className="rounded-lg font-black uppercase text-[10px] tracking-widest text-primary focus:bg-primary/10 focus:text-primary">
                      <Link to="/admin" className="flex items-center gap-2 w-full">
                        <LayoutDashboard className="h-4 w-4" />
                        Admin Moderation
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem disabled className="rounded-lg font-bold uppercase text-[10px] tracking-wide opacity-50 cursor-not-allowed">
                    <LayoutDashboard className="h-4 w-4" />
                    My Bids (Coming Soon)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="rounded-lg font-bold uppercase text-[10px] tracking-wide opacity-50 cursor-not-allowed">
                    <Heart className="h-4 w-4" />
                    Watchlist (Coming Soon)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="rounded-lg font-bold uppercase text-[10px] tracking-wide opacity-50 cursor-not-allowed">
                    <Settings className="h-4 w-4" />
                    Settings (Coming Soon)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="rounded-lg font-black uppercase text-[10px] tracking-widest cursor-pointer focus:bg-destructive focus:text-destructive-foreground text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="relative">
              <label htmlFor="search-mobile" className="sr-only">Search equipment</label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-mobile"
                type="search"
                placeholder="Search equipment..."
                className="pl-10 h-12 bg-muted/50 border-2 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>

            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                link.disabled ? (
                  <span
                    key={link.name}
                    className="text-lg font-black uppercase tracking-tight text-muted-foreground/50 cursor-not-allowed"
                    aria-disabled="true"
                  >
                    {link.name}
                  </span>
                ) : (
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
                )
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
                      <p className="text-sm font-black uppercase leading-none">{user?.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Verified Member</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {user?.role === "admin" ? (
                      <Button variant="outline" className="justify-start gap-2 font-bold uppercase text-[10px] border-primary/20 text-primary" asChild>
                        <Link to="/admin" onClick={() => setIsMenuOpen(false)}>
                          <LayoutDashboard className="h-3.5 w-3.5" />
                          Admin
                        </Link>
                      </Button>
                    ) : (
                      <div className="aria-hidden:true" />
                    )}
                    <Button variant="outline" disabled className="justify-start gap-2 font-bold uppercase text-[10px] opacity-50 cursor-not-allowed" aria-disabled="true">
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      My Bids
                    </Button>
                  </div>
                  <Button 
                    variant="destructive" 
                    className="w-full font-black uppercase text-xs tracking-widest h-12 rounded-xl"
                    onClick={async () => {
                      await handleSignOut();
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

