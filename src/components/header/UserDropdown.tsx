// app/src/components/header/UserDropdown.tsx
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Heart,
  Info,
  LogOut,
  MessageCircle,
  Search,
  ShieldAlert,
  User,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { BottomSheet } from "@/components/ds/BottomSheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";
import type { UserDataWithProfile } from "@/types/auth";

interface UserDropdownProps {
  userData: UserDataWithProfile | null | undefined;
  isLoadingProfile: boolean;
  isVerified: boolean;
  kycStatus: string | undefined;
  role: string | undefined;
  onSignOut: () => Promise<void>;
}

/** One link in the account menu. */
interface MenuLink {
  name: string;
  href: string;
  icon: LucideIcon;
  /** A count shown at the right edge. */
  badge?: { text: string; label: string; urgent: boolean };
}

/**
 * Builds the menu links in the order of the `menu` frame: Auctions, My bids,
 * Watching, My listings (sellers), Messages, Account, Support, and Admin for
 * admins.
 *
 * @param input - What decides the list
 * @param input.role - The user's role
 * @param input.unreadMessages - Conversations with unread messages
 * @param input.unpaidLots - Won lots awaiting payment
 * @returns The links
 */
function buildLinks(input: {
  role: string | undefined;
  unreadMessages: number;
  unpaidLots: number;
}): MenuLink[] {
  const { role, unreadMessages, unpaidLots } = input;
  const links: MenuLink[] = [
    { name: "Auctions", href: "/auctions", icon: Search },
    {
      name: "My bids",
      href: "/dashboard/bids",
      icon: Clock,
      badge:
        unpaidLots > 0
          ? {
              text: String(unpaidLots),
              label: `${String(unpaidLots)} to pay`,
              urgent: true,
            }
          : undefined,
    },
    { name: "Watching", href: "/dashboard/bids?tab=watching", icon: Heart },
  ];
  if (role === "seller" || role === "admin") {
    links.push({
      name: "My listings",
      href: "/dashboard/listings",
      icon: FileText,
    });
  }
  links.push(
    {
      name: "Messages",
      href: "/messages",
      icon: MessageCircle,
      badge:
        unreadMessages > 0
          ? {
              text: String(unreadMessages),
              label: `${String(unreadMessages)} unread`,
              urgent: true,
            }
          : undefined,
    },
    { name: "Account", href: "/account", icon: UserRound },
    { name: "Support", href: "/support", icon: Info }
  );
  if (role === "admin") {
    links.push({ name: "Admin", href: "/admin", icon: ShieldAlert });
  }
  return links;
}

/**
 * The count at the right edge of a menu row. The row's link carries the spoken
 * label, so the number itself is hidden from screen readers.
 *
 * @param props - Component props
 * @param props.badge - The badge
 * @returns The badge
 */
function Count({ badge }: { badge: NonNullable<MenuLink["badge"]> }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-auto flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-bold",
        badge.urgent
          ? "bg-destructive text-primary-foreground"
          : "text-muted-foreground"
      )}
    >
      {badge.text}
    </span>
  );
}

/**
 * The account menu: the avatar opens a bottom sheet on a phone (the `menu`
 * frame) and a dropdown from `md`. Both hold the same links, "Finish
 * registration" until the user is verified, and Sign out. "My bids" shows how
 * many won lots wait for payment and "Messages" how many conversations have
 * unread messages. The seller's public page link lives in Account.
 *
 * @param props - Component props
 * @param props.userData - Optional user object; used to display the user's name when available
 * @param props.isLoadingProfile - When true, disables interaction and shows loading placeholders in the trigger
 * @param props.isVerified - Whether the user's identity is verified; controls the badge and the registration prompt
 * @param props.kycStatus - Verification status string (for example `"pending"`); used for the badge label
 * @param props.role - User role (for example `"admin"`); admins see the Admin link, sellers see My listings
 * @param props.onSignOut - Callback invoked when the user selects "Sign out"; errors are caught and shown in a toast
 * @returns The account menu JSX
 */
export function UserDropdown({
  userData,
  isLoadingProfile,
  isVerified,
  kycStatus,
  role,
  onSignOut,
}: UserDropdownProps) {
  const location = useLocation();
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [sheetPath, setSheetPath] = useState<string | null>(null);
  // Open for the page it was opened on, so it closes when the route changes.
  const sheetOpen = sheetPath === location.pathname + location.search;
  const unreadMessageCount = useQuery(api.messages.getUnreadConversationCount);
  const summary = useQuery(api.lotPayments.getMyPaymentSummary);
  const eligibility = useQuery(api.registration.getMyBidEligibility);
  const name = userData?.name?.trim() ?? "";
  const displayName = name.length > 0 ? name : "User";
  const initials = initialsOf(name, userData?.email ?? undefined);
  const links = buildLinks({
    role,
    unreadMessages: unreadMessageCount ?? 0,
    unpaidLots: summary?.awaitingCount ?? 0,
  });

  const signOut = () => {
    onSignOut().catch((err: unknown) => {
      console.error("Sign out failed:", err);
      toast.error("Sign out failed. Please try again.");
    });
  };

  const trigger = (onClick?: () => void): ReactNode => (
    <Button
      variant="ghost"
      className="gap-2 px-2 hover:bg-primary/5 h-12 rounded-md group"
      disabled={isLoadingProfile}
      onClick={onClick}
      aria-haspopup={onClick ? "dialog" : undefined}
      aria-expanded={onClick ? sheetOpen : undefined}
    >
      <div className="flex-col items-end hidden sm:flex">
        <div className="flex items-center gap-1.5">
          {isLoadingProfile ? (
            <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          ) : isVerified ? (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[8px] font-semibold bg-success/10 text-success border-success/20"
            >
              Verified
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[8px] font-semibold bg-warning/10 text-warning border-warning/20"
            >
              {kycStatus === "pending" ? "Pending Review" : "Unverified"}
            </Badge>
          )}
        </div>
        <span className="text-sm font-bold text-primary leading-none mt-1">
          {isLoadingProfile ? "Loading..." : displayName}
        </span>
      </div>
      <span className="sr-only sm:hidden">Account menu</span>
      <div
        data-slot="avatar"
        className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold"
      >
        {isLoadingProfile ? (
          <LoadingIndicator size="sm" />
        ) : initials ? (
          <span aria-hidden="true">{initials}</span>
        ) : (
          <User aria-hidden="true" className="h-4 w-4" />
        )}
      </div>
      <ChevronDown
        aria-hidden="true"
        className="hidden sm:block h-4 w-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform"
      />
    </Button>
  );

  const registrationPrompt = isVerified ? null : (
    <Link
      to="/register"
      className="flex min-h-11 items-center gap-3 rounded-md border border-warning/20 bg-warning/10 p-3 text-warning"
    >
      <ShieldAlert aria-hidden="true" className="size-5" />
      <span className="flex flex-col">
        <span className="text-sm leading-none font-semibold">
          Finish registration
        </span>
        <span className="mt-0.5 text-xs font-medium opacity-80">
          Needed to bid and to sell
        </span>
      </span>
    </Link>
  );

  if (isPhone) {
    return (
      <>
        {trigger(() => {
          setSheetPath(location.pathname + location.search);
        })}
        <BottomSheet
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetPath(open ? location.pathname + location.search : null);
          }}
          title={displayName}
        >
          <div className="mb-2 flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground"
            >
              {initials}
            </div>
            {eligibility?.kind === "ok" ? (
              <p className="inline-flex items-center gap-1.5 rounded-sm bg-ok-soft px-2 py-0.5 text-sm font-semibold text-ok-fg">
                <CheckCircle2 aria-hidden="true" className="size-4" />
                You can bid
              </p>
            ) : null}
          </div>
          {registrationPrompt ? (
            <div className="mb-2">{registrationPrompt}</div>
          ) : null}
          <nav aria-label="Account menu">
            <ul className="m-0 list-none p-0">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.name} className="border-b border-border">
                    <Link
                      to={link.href}
                      aria-label={
                        link.badge
                          ? `${link.name}, ${link.badge.label}`
                          : undefined
                      }
                      className="flex min-h-[52px] items-center gap-4 text-[17px] font-medium"
                    >
                      <Icon aria-hidden="true" className="size-5" />
                      {link.name}
                      {link.badge ? <Count badge={link.badge} /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={signOut}
          >
            Sign out
          </Button>
        </BottomSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger()}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 rounded-md border p-2 shadow-2xl"
      >
        {registrationPrompt ? (
          <DropdownMenuItem asChild className="mb-1 p-0">
            {registrationPrompt}
          </DropdownMenuItem>
        ) : null}
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.href;
          return (
            <DropdownMenuItem
              key={link.name}
              asChild
              className="rounded-md font-semibold text-sm h-11"
            >
              <Link
                to={link.href}
                aria-label={
                  link.badge ? `${link.name}, ${link.badge.label}` : undefined
                }
                className={cn(
                  "flex items-center gap-3 w-full",
                  isActive && "text-primary"
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {link.name}
                {link.badge ? <Count badge={link.badge} /> : null}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={signOut}
          className="rounded-md font-semibold text-sm cursor-pointer focus:bg-destructive/10 focus:text-destructive text-destructive h-11 gap-3"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
