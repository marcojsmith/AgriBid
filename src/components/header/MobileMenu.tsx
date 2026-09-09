// app/src/components/header/MobileMenu.tsx
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  User,
  LogOut,
  LayoutDashboard,
  Mail,
  Settings,
  ShieldAlert,
  Heart,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserDataWithProfile } from "@/types/auth";

import { SearchBar } from "./SearchBar";

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
 * Renders the "Messages" navigation tile with a badge showing how many of the
 * caller's conversations contain unread messages.
 *
 * Lives in its own component so the `useQuery` subscription only runs when the
 * enclosing `<Authenticated>` boundary renders it — `MobileMenu` itself mounts
 * regardless of auth state.
 *
 * @param props - Component props
 * @param props.onClose - Callback invoked when the tile's link is clicked
 * @returns The Messages tile button JSX
 */
function MessagesTile({ onClose }: { onClose: () => void }) {
  const unreadMessageCount = useQuery(api.messages.getUnreadConversationCount);

  return (
    <Button
      variant="outline"
      className="justify-start gap-2 font-bold uppercase text-[10px] h-12 rounded-md"
      asChild
    >
      <Link
        to="/messages"
        onClick={onClose}
        aria-label={
          unreadMessageCount
            ? `Messages, ${unreadMessageCount} unread`
            : undefined
        }
      >
        <span className="relative flex">
          <Mail className="h-3.5 w-3.5" />
          {unreadMessageCount ? (
            <span
              className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 rounded-full bg-primary text-[9px] font-black text-primary-foreground flex items-center justify-center border-2 border-background animate-in zoom-in"
              aria-hidden="true"
            >
              {unreadMessageCount}
            </span>
          ) : null}
        </span>
        Messages
      </Link>
    </Button>
  );
}

/**
 * Renders a mobile navigation dialog with search, navigation links, and authenticated user actions.
 *
 * Displays nothing when closed; when open it traps focus, handles Escape to close, and focuses the search input.
 *
 * @param props - Component props
 * @param props.isOpen - Whether the mobile menu is visible
 * @param props.onClose - Callback to close the menu
 * @param props.navLinks - Navigation items rendered as links; each item should include `name` and `href`
 * @param props.userData - Current user information (may be null/undefined when unauthenticated)
 * @param props.isVerified - Whether the current user is verification-complete
 * @param props.kycStatus - KYC workflow status (e.g., `"pending"`) used to gate the verification CTA
 * @param props.role - User role (e.g., `"admin"`) used to show role-specific actions
 * @param props.profileId - ID used to construct the profile route; absence shows a disabled "Profile (Syncing...)" button
 * @param props.onSignOut - Async function invoked when the user chooses to sign out
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
        const allFocusable = menuRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        // Filter out elements that are disabled, hidden, or have negative tabindex
        const focusableElements = Array.from(allFocusable).filter((el) => {
          const element = el as HTMLElement;
          return (
            !element.hasAttribute("disabled") &&
            element.getAttribute("aria-hidden") !== "true" &&
            element.tabIndex !== -1 &&
            element.offsetParent !== null // basic visibility check
          );
        }) as HTMLElement[];

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

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
                "text-lg font-semibold p-4 rounded-lg bg-muted/30 border border-transparent hover:border-primary/20 transition-all",
                location.pathname === link.href
                  ? "text-primary border-primary/20"
                  : "text-muted-foreground"
              )}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="pt-6 border-t">
          <Authenticated>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-2 bg-muted/20 rounded-lg">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 transition-all">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  {userData ? (
                    <>
                      <p className="text-sm font-semibold leading-none">
                        {userData.name}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">
                        {isVerified ? "Verified Member" : "Unverified"}
                      </p>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-2 w-16 bg-muted animate-pulse rounded" />
                    </div>
                  )}
                </div>
              </div>

              {!isVerified && kycStatus !== "pending" && (
                <Button
                  className="w-full bg-warning hover:bg-warning/90 text-warning-foreground font-semibold text-xs h-12 rounded-md gap-2"
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
                    className="justify-start gap-2 font-semibold text-xs h-12 rounded-md border-primary/20 text-primary"
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
                    className="justify-start gap-2 font-semibold text-xs h-12 rounded-md"
                    asChild
                  >
                    <Link to={`/profile/${profileId}`} onClick={onClose}>
                      <User className="h-3.5 w-3.5" />
                      Profile
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    className="justify-start gap-2 font-semibold text-xs h-12 rounded-md opacity-50"
                    aria-busy={true}
                    aria-label="Profile syncing"
                  >
                    <User className="h-3.5 w-3.5" />
                    Profile (Syncing...)
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="justify-start gap-2 font-semibold text-xs h-12 rounded-md"
                  asChild
                >
                  <Link to="/dashboard/bids" onClick={onClose}>
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    My Bids
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2 font-semibold text-xs h-12 rounded-md"
                  asChild
                >
                  <Link to="/watchlist" onClick={onClose}>
                    <Heart className="h-3.5 w-3.5" />
                    Watchlist
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start gap-2 font-semibold text-xs h-12 rounded-md",
                    role === "admin" && "col-span-2"
                  )}
                  asChild
                >
                  <Link to="/dashboard/listings" onClick={onClose}>
                    <Settings className="h-3.5 w-3.5" />
                    My Listings
                  </Link>
                </Button>
                <MessagesTile onClose={onClose} />
              </div>
              <Button
                variant="destructive"
                className="w-full font-semibold text-xs h-14 rounded-md shadow-lg shadow-destructive/10"
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
              className="w-full h-16 text-lg font-bold rounded-lg shadow-xl shadow-primary/20"
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
