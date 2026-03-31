// app/src/components/header/Header.tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";

import { useBranding } from "@/hooks/useBranding";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationDropdown } from "@/components/NotificationDropdown";

import { SearchBar } from "./SearchBar";
import { UserDropdown } from "./UserDropdown";

/**
 * Main application header component.
 *
 * Renders the site navigation, search bar, and user authentication controls.
 * This component is publicly exported via the header barrel.
 *
 * @returns A JSX.Element representing the application header
 */
export const Header = () => {
  const branding = useBranding();
  const userData = useQuery(api.users.getMyProfile);
  const isLoadingProfile = userData === undefined;
  const profileId = userData?.profile?.userId;
  const role = userData?.profile?.role;
  const isVerified = userData?.profile?.isVerified;
  const kycStatus = userData?.profile?.kycStatus;

  const location = useLocation();
  const navigate = useNavigate();

  const navLinks: { name: string; href: string; disabled?: boolean }[] = [
    { name: "Marketplace", href: "/" },
    { name: "Sell", href: "/sell" },
    { name: "Support", href: "/support" },
    { name: "About", href: "/about", disabled: true },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      void toast.success("Signed out successfully");
      void navigate("/");
    } catch (err) {
      console.error("Sign out failed:", err);
      void toast.error("Failed to sign out. Please try again.");
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
            {(branding?.appName ?? 'APP').toUpperCase()}
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
                      : "text-muted-foreground"
                  )}
                >
                  {link.name}
                </Link>
              )
            )}
          </nav>
        </div>

        {/* Global Search - Desktop */}
        <SearchBar
          id="search-desktop"
          className="hidden md:flex flex-1 max-w-md"
        />

        <div className="flex items-center gap-2 shrink-0">
          <Authenticated>
            <div className="flex items-center gap-2">
              <NotificationDropdown />
              <UserDropdown
                userData={userData}
                isLoadingProfile={isLoadingProfile}
                isVerified={isVerified ?? false}
                kycStatus={kycStatus}
                profileId={profileId}
                role={role}
                onSignOut={handleSignOut}
              />
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
        </div>
      </div>
    </header>
  );
};