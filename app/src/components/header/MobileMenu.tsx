// app/src/components/header/MobileMenu.tsx
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import {
  User,
  LogOut,
  LayoutDashboard,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { SearchBar } from "./SearchBar";
import type { UserDataWithProfile } from "@/types/auth";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: { name: string; href: string; disabled?: boolean }[];
  userData: UserDataWithProfile | null | undefined;
  isVerified: boolean;
  kycStatus: string | undefined;
  role: string | undefined;
  profileId: string | undefined;
  onSignOut: () => Promise<void>;
}

/**
 * Renders a mobile navigation dialog with search, navigation links, and authenticated user actions.
 *
 * Displays nothing when closed; when open it traps focus, handles Escape to close, and focuses the search input.
 *
 * @param isOpen - Whether the mobile menu is visible
 * @param onClose - Callback to close the menu
 * @param navLinks - Navigation items rendered as links; each item should include `name` and `href`
 * @param userData - Current user information (may be null/undefined when unauthenticated)
 * @param isVerified - Whether the current user is verification-complete
 * @param kycStatus - KYC workflow status (e.g., `"pending"`) used to gate the verification CTA
 * @param role - User role (e.g., `"admin"`) used to show role-specific actions
 * @param profileId - ID used to construct the profile route; absence shows a disabled "Profile (Syncing...)" button
 * @param onSignOut - Async function invoked when the user chooses to sign out
 * @returns The menu element when open, or `null` when closed
 */
export function MobileMenu({
  isOpen,
  onClose,
  navLinks,
  userData,
  isVerified,
  kycStatus,
  role,
  profileId,
  onSignOut,
}: MobileMenuProps) {
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Focus trap and Escape key handling
  useEffect(() => {
    if (!isOpen) {
      if (previousFocus.current) {
        previousFocus.current.focus();
        previousFocus.current = null;
      }
      return;
    }

    previousFocus.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && menuRef.current) {
        const focusableElements = menuRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Focus the first element (search input) when opened
    const firstFocusable = menuRef.current?.querySelector("input");
    firstFocusable?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="md:hidden border-t bg-card animate-in slide-in-from-top-4 duration-200 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Menu"
    >
      <div className="container mx-auto px-4 py-6 space-y-6">
        <SearchBar id="search-mobile" onSearch={onClose} />

        <nav className="flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              onClick={onClose}
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
                  <Link to="/kyc" onClick={onClose}>
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
                    <Link to="/admin" onClick={onClose}>
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
                      onClick={onClose}
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
                    onClick={onClose}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    My Bids
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start gap-2 font-bold uppercase text-[10px] h-12 rounded-xl",
                    role !== "admin" && "col-span-2"
                  )}
                  asChild
                >
                  <Link
                    to="/dashboard/listings"
                    onClick={onClose}
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
                    await onSignOut();
                    onClose();
                  } catch (e) {
                    console.error("Sign out failed in MobileMenu:", e);
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
              <Link to="/login" onClick={onClose}>
                Login / Register
              </Link>
            </Button>
          </Unauthenticated>
        </div>
      </div>
    </div>
  );
}