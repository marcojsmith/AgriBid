// app/src/components/header/UserDropdown.tsx
import { Link } from "react-router-dom";
import {
  User,
  LogOut,
  LayoutDashboard,
  Heart,
  ChevronDown,
  Settings,
  ShieldAlert,
  MessageSquare,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingIndicator } from "../ui/LoadingIndicator";
import type { UserDataWithProfile } from "@/types/auth";

interface UserDropdownProps {
  userData: UserDataWithProfile | null | undefined;
  isLoadingProfile: boolean;
  isVerified: boolean;
  kycStatus: string | undefined;
  profileId: string | undefined;
  role: string | undefined;
  onSignOut: () => Promise<void>;
}

/**
 * Render a user account dropdown with profile status, navigation links, and a sign-out action.
 *
 * Displays a trigger button that shows loading state, verification badge, user name, and avatar.
 * The dropdown menu includes KYC prompt (when needed), public profile link (or syncing state),
 * optional admin moderation link, common navigation items (My Bids, Watchlist, My Listings, Support),
 * and a Sign Out item that invokes the provided sign-out callback.
 *
 * @param userData - Optional user data object (may include display name and profile information)
 * @param isLoadingProfile - Whether profile data is currently loading; disables interaction and shows placeholders
 * @param isVerified - Whether the user's identity/KYC has been verified
 * @param kycStatus - KYC status string (e.g., "pending"); used to determine KYC-related UI states
 * @param profileId - Public profile identifier; when present, enables the Public Profile link
 * @param role - User role (e.g., "admin"); used to conditionally show admin links
 * @param onSignOut - Callback invoked when the user selects "Sign Out"
 *
 * @returns The dropdown menu JSX containing the trigger and account-related menu items
 */
export function UserDropdown({
  userData,
  isLoadingProfile,
  isVerified,
  kycStatus,
  profileId,
  role,
  onSignOut,
}: UserDropdownProps) {
  return (
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
              <LoadingIndicator size="sm" />
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
          onClick={() => {
            onSignOut().catch((err) => {
              console.error("Sign out failed:", err);
            });
          }}
          className="rounded-xl font-black uppercase text-[10px] tracking-widest cursor-pointer focus:bg-destructive/10 focus:text-destructive text-destructive h-10 gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}