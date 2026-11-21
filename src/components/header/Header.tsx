// app/src/components/header/Header.tsx
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { useClerk } from "@clerk/clerk-react";

import { useBranding } from "@/hooks/useBranding";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
 * Main application header component.
 *
 * Renders the site navigation, search and the account controls. Signed out it
 * shows "Sign in"; signed in it shows the notification bell, a "My bids" link
 * and the account menu (avatar). Below `md` the search field is hidden behind
 * a search icon that opens a full-width field under the header.
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
  const [searchOpen, setSearchOpen] = useState(false);

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
    <header className="border-b bg-background lg:sticky lg:top-0 z-50">
      <div className="container mx-auto px-4 h-14 md:h-16 flex items-center gap-2 md:gap-6">
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
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={searchOpen ? "Close search" : "Search"}
            aria-expanded={searchOpen}
            aria-controls="mobile-search"
            onClick={() => {
              setSearchOpen((open) => !open);
            }}
          >
            {searchOpen ? (
              <X aria-hidden="true" />
            ) : (
              <Search aria-hidden="true" />
            )}
          </Button>

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
            <Button size="sm" variant="outline" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </Unauthenticated>
        </div>
      </div>

      <div
        id="mobile-search"
        hidden={!searchOpen}
        className="md:hidden border-t px-4 py-2"
      >
        {searchOpen ? (
          <SearchBar
            id="search-mobile"
            autoFocus
            onSearch={() => {
              setSearchOpen(false);
            }}
          />
        ) : null}
      </div>
    </header>
  );
};
