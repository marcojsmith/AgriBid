// app/src/components/header/Header.tsx
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import { Menu, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { useClerk } from "@clerk/clerk-react";

import { useBranding } from "@/hooks/useBranding";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { telLink } from "@/lib/homeSales";
import { NotificationDropdown } from "@/components/NotificationDropdown";

import { SearchBar } from "./SearchBar";
import { UserDropdown } from "./UserDropdown";

const NAV_LINKS: readonly { name: string; href: string }[] = [
  { name: "Auctions", href: "/auctions" },
  { name: "Sell equipment", href: "/sell" },
  { name: "How it works", href: "/faq" },
  { name: "Support", href: "/support" },
];

/**
 * Main application header component (design system Header).
 *
 * Phone: logo, a call icon (when a phone number is set), "Sell", the account
 * control and a menu button that opens the navigation and search. Desktop: the
 * navigation, search, the phone number and the account controls. Signed out it
 * shows "Sign in" and, from `md`, a filled "Register to bid"; signed in it
 * shows the notification bell, a "My bids" link and the account menu (avatar).
 *
 * Reads the signed-in user's profile from `UserProfileContext`, which the
 * layout provides, instead of subscribing to `users.getMyProfile` again.
 *
 * @returns A JSX.Element representing the application header
 */
export const Header = () => {
  const { signOut } = useClerk();
  const branding = useBranding();
  const userData = useUserProfile();
  const isLoadingProfile = userData === undefined;
  const profileId = userData?.profile?.userId;
  const role = userData?.profile?.role;
  const isVerified = userData?.profile?.isVerified;
  const kycStatus = userData?.profile?.kycStatus;

  const location = useLocation();
  // The menu is open for the page it was opened on, so it closes by itself
  // when the route changes.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === location.pathname;
  const telephone = branding?.businessInfo?.telephone?.trim() ?? "";
  const tel = telLink(telephone);

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: "/" });
      void toast.success("Signed out successfully");
    } catch (err) {
      console.error("Sign out failed:", err);
      void toast.error("Failed to sign out. Please try again.");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="mx-auto max-w-[1200px] px-4 h-14 md:h-16 flex items-center gap-2 md:gap-6">
        <Link
          to="/"
          className="inline-flex min-h-11 shrink-0 items-center rounded-sm font-display text-[21px] font-bold tracking-tight text-primary"
        >
          {branding?.appName ?? "AgriBid"}
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden lg:flex gap-6 text-sm font-medium"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              aria-current={
                location.pathname === link.href ? "page" : undefined
              }
              className={cn(
                "rounded-sm transition-colors hover:text-primary",
                location.pathname === link.href
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground"
              )}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Global search: desktop */}
        <SearchBar
          id="search-desktop"
          className="hidden md:flex flex-1 max-w-md"
        />

        <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
          {tel ? (
            <a
              href={tel}
              aria-label={`Call ${telephone}`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-sm text-sm font-medium hover:text-primary lg:px-2"
            >
              <Phone aria-hidden="true" className="size-5" />
              <span className="num hidden lg:inline">{telephone}</span>
            </a>
          ) : null}
          <Link
            to="/sell"
            className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-semibold hover:text-primary lg:hidden"
          >
            Sell
          </Link>

          <Authenticated>
            <NotificationDropdown />
            <Link
              to="/dashboard/bids"
              className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-semibold hover:text-primary"
            >
              My bids
            </Link>
            <UserDropdown
              userData={userData}
              isLoadingProfile={isLoadingProfile}
              isVerified={isVerified ?? false}
              kycStatus={kycStatus}
              profileId={profileId}
              role={role}
              onSignOut={handleSignOut}
            />
          </Authenticated>

          <Unauthenticated>
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-semibold hover:text-primary"
            >
              Sign in
            </Link>
            <Button asChild className="hidden h-10 md:inline-flex">
              <Link to="/login">Register to bid</Link>
            </Button>
          </Unauthenticated>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => {
              setMenuPath(menuOpen ? null : location.pathname);
            }}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </div>

      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="lg:hidden border-t px-4 py-2"
      >
        {menuOpen ? (
          <div className="space-y-2">
            <SearchBar
              id="search-mobile"
              className="md:hidden"
              onSearch={() => {
                setMenuPath(null);
              }}
            />
            <nav aria-label="Menu" className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={() => {
                    setMenuPath(null);
                  }}
                  className="inline-flex min-h-11 items-center rounded-sm text-base font-medium"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
};
