import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { signOut } from "../lib/auth-client";
import { api } from "convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import {
  User,
  LogOut,
  LayoutDashboard,
  Heart,
  ChevronDown,
  Settings,
  Search,
  ShieldAlert,
  MessageSquare,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationDropdown } from "./NotificationDropdown";
import { Badge } from "./ui/badge";

export const Header = () => {
  const userData = useQuery(api.users.getMyProfile);
  const isLoadingProfile = userData === undefined;
  const profileId = userData?.profile?.userId;
  const role = userData?.profile?.role;
  const isVerified = userData?.profile?.isVerified;
  const kycStatus = userData?.profile?.kycStatus;

  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const navLinks: { name: string; href: string; disabled?: boolean }[] = [
    { name: "Marketplace", href: "/" },
    { name: "Sell", href: "/sell" },
    { name: "Support", href: "/support" },
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
    } catch (err) {
      console.error("Sign out failed:", err);
      toast.error("Failed to sign out. Please try again.");
      // We keep the menu open for retry while logging the error for diagnostics
    }
  };

  return (
    <header className="border-b bg-card lg:sticky lg:top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8 shrink-0">
          <Link
            to="/"
            className="font-black text-2xl tracking-tighter text-primary"
          >
            AGRIBID
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden lg:flex gap-6 text-sm font-bold uppercase tracking-wider"
          >
            {navLinks.map((link) =>
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
                    location.pathname === link.href
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {link.name}
                </Link>
              ),
            )}
          </nav>
        </div>

        {/* Global Search - Desktop */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex flex-1 max-w-md relative"
        >
          <label htmlFor="search-desktop" className="sr-only">
            Search equipment
          </label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search-desktop"
            type="search"
            placeholder="Search equipment..."
            className="pl-10 h-10 bg-muted/50 border-2 rounded-xl focus-visible:ring-primary focus-visible:border-primary font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="flex items-center gap-2 shrink-0">
          <Authenticated>
            <div className="flex items-center gap-2">
              <NotificationDropdown />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="gap-2 px-2 hover:bg-primary/5 h-12 rounded-xl group"
                    disabled={isLoadingProfile}
                  >
                    <div className="flex-col items-end hidden sm:flex">
                      <div className="flex items-center gap-1.5">
                        {isLoadingProfile ? (
                          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                        ) : isVerified ? (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1 text-[8px] font-black bg-green-500/10 text-green-600 border-green-500/20 uppercase"
                          >
                            Verified
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1 text-[8px] font-black bg-orange-500/10 text-orange-600 border-orange-500/20 uppercase"
                          >
                            {kycStatus === "pending"
                              ? "Pending Review"
                              : "Unverified"}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-bold text-primary leading-none mt-1">
                        {isLoadingProfile
                          ? "Loading..."
                          : userData?.name || "User"}
                      </span>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all border-2 border-primary/20">
                      {isLoadingProfile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <User className="h-4.5 w-4.5 transition-colors" />
                      )}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 rounded-2xl border-2 p-2 shadow-2xl"
                >
                  <DropdownMenuLabel className="font-black uppercase text-[10px] tracking-widest text-muted-foreground px-2 py-2">
                    Account Terminal
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {!isVerified && kycStatus !== "pending" && (
                    <DropdownMenuItem
                      asChild
                      className="bg-orange-500/10 text-orange-600 focus:bg-orange-500/20 focus:text-orange-700 rounded-xl mb-1 border border-orange-500/20 p-3"
                    >
                      <Link
                        to="/kyc"
                        className="flex items-center gap-3 w-full"
                      >
                        <ShieldAlert className="h-5 w-5" />
                        <div className="flex flex-col">
                          <span className="font-black text-[10px] uppercase tracking-tighter leading-none">
                            Identity Required
                          </span>
                          <span className="text-[9px] font-bold opacity-80 mt-0.5">
                            Complete KYC to start selling
                          </span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {profileId ? (
                    <DropdownMenuItem
                      asChild
                      className="rounded-xl font-bold uppercase text-[10px] tracking-wide h-10"
                    >
                      <Link
                        to={`/profile/${profileId}`}
                        className="flex items-center gap-2 w-full"
                      >
                        <User className="h-4 w-4" />
                        Public Profile
                      </Link>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled
                      className="rounded-xl font-bold uppercase text-[10px] tracking-wide h-10 opacity-50"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <User className="h-4 w-4" />
                        Public Profile (Syncing...)
                      </div>
                    </DropdownMenuItem>
                  )}

                  {role === "admin" && (
                    <DropdownMenuItem
                      asChild
                      className="rounded-xl font-black uppercase text-[10px] tracking-widest text-primary focus:bg-primary/10 focus:text-primary h-10"
                    >
                      <Link
                        to="/admin"
                        className="flex items-center gap-2 w-full"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Admin Moderation
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    asChild
                    className="rounded-xl font-bold uppercase text-[10px] tracking-wide h-10"
                  >
                    <Link
                      to="/dashboard/bids"
                      className="flex items-center gap-2 w-full"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      My Bids
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="rounded-xl font-bold uppercase text-[10px] tracking-wide h-10"
                  >
                    <Link
                      to="/watchlist"
                      className="flex items-center gap-2 w-full"
                    >
                      <Heart className="h-4 w-4" />
                      Watchlist
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="rounded-xl font-bold uppercase text-[10px] tracking-wide h-10"
                  >
                    <Link
                      to="/dashboard/listings"
                      className="flex items-center gap-2 w-full"
                    >
                      <Settings className="h-4 w-4" />
                      My Listings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="rounded-xl font-bold uppercase text-[10px] tracking-wide h-10"
                  >
                    <Link
                      to="/support"
                      className="flex items-center gap-2 w-full"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Support Tickets
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="rounded-xl font-black uppercase text-[10px] tracking-widest cursor-pointer focus:bg-destructive/10 focus:text-destructive text-destructive h-10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Authenticated>

          <Unauthenticated>
            <Button
              size="sm"
              asChild
              className="font-bold uppercase text-[10px] tracking-widest rounded-xl h-10 px-6 shadow-lg shadow-primary/20"
            >
              <Link to="/login">Login / Register</Link>
            </Button>
          </Unauthenticated>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-10 w-10 border-2 rounded-xl"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="md:hidden border-t bg-card animate-in slide-in-from-top-4 duration-200 shadow-2xl">
          <div className="container mx-auto px-4 py-6 space-y-6">
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="relative">
              <label htmlFor="search-mobile" className="sr-only">
                Search equipment
              </label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-mobile"
                type="search"
                placeholder="Search equipment..."
                className="pl-10 h-12 bg-muted/50 border-2 rounded-xl font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>

            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "text-lg font-black uppercase tracking-tight p-4 rounded-2xl bg-muted/30 border-2 border-transparent hover:border-primary/20 transition-all",
                    location.pathname === link.href
                      ? "text-primary border-primary/20"
                      : "text-muted-foreground",
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            <div className="pt-6 border-t">
              <Authenticated>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-2 bg-muted/20 rounded-2xl">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 transition-all">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase leading-none">
                        {userData?.name}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                        {isVerified ? "Verified Member" : "Unverified"}
                      </p>
                    </div>
                  </div>

                  {!isVerified && kycStatus !== "pending" && (
                    <Button
                      className="w-full bg-orange-500 hover:bg-orange-600 font-black uppercase text-xs h-12 rounded-xl gap-2"
                      asChild
                    >
                      <Link to="/kyc" onClick={() => setIsMenuOpen(false)}>
                        <ShieldAlert className="h-4 w-4" />
                        Complete Verification
                      </Link>
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {role === "admin" && (
                      <Button
                        variant="outline"
                        className="justify-start gap-2 font-bold uppercase text-[10px] h-12 rounded-xl border-primary/20 text-primary"
                        asChild
                      >
                        <Link to="/admin" onClick={() => setIsMenuOpen(false)}>
                          <LayoutDashboard className="h-3.5 w-3.5" />
                          Admin
                        </Link>
                      </Button>
                    )}
                    {profileId ? (
                      <Button
                        variant="outline"
                        className="justify-start gap-2 font-bold uppercase text-[10px] h-12 rounded-xl"
                        asChild
                      >
                        <Link
                          to={`/profile/${profileId}`}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <User className="h-3.5 w-3.5" />
                          Profile
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        disabled
                        className="justify-start gap-2 font-bold uppercase text-[10px] h-12 rounded-xl opacity-50"
                        aria-busy={true}
                        aria-label="Profile syncing"
                      >
                        <User className="h-3.5 w-3.5" />
                        Profile (Syncing...)
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="justify-start gap-2 font-bold uppercase text-[10px] h-12 rounded-xl"
                      asChild
                    >
                      <Link
                        to="/dashboard/bids"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        My Bids
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start gap-2 font-bold uppercase text-[10px] h-12 rounded-xl"
                      asChild
                    >
                      <Link
                        to="/dashboard/listings"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Settings className="h-3.5 w-3.5" />
                        My Listings
                      </Link>
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full font-black uppercase text-xs tracking-widest h-14 rounded-xl shadow-lg shadow-destructive/10"
                    onClick={async () => {
                      try {
                        await handleSignOut();
                        setIsMenuOpen(false);
                      } catch {
                        // Error is handled in handleSignOut, but we keep menu open for retry
                      }
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </Authenticated>

              <Unauthenticated>
                <Button
                  className="w-full h-16 text-lg font-black uppercase tracking-tight rounded-2xl shadow-xl shadow-primary/20"
                  asChild
                >
                  <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                    Login / Register
                  </Link>
                </Button>
              </Unauthenticated>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
