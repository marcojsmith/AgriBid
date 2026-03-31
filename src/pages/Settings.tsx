import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";

import { useSession } from "@/lib/auth-client";
import { LoadingPage } from "@/components/LoadingIndicator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * User settings page for managing persistent preferences.
 *
 * Allows authenticated users to configure display, bidding, and notification preferences.
 * Changes are persisted automatically to Convex on each interaction.
 *
 * @returns The settings page JSX element.
 */
export default function Settings() {
  const { data: session } = useSession();
  const preferences = useQuery(api.userPreferences.getMyPreferences, {});
  const myProfile = useQuery(api.users.getMyProfile, {});
  const updateMyPreferences = useMutation(
    api.userPreferences.updateMyPreferences
  );

  if (preferences === undefined || myProfile === undefined) {
    return <LoadingPage message="Loading settings..." />;
  }

  const isSeller = myProfile?.profile?.role === "seller";

  const update = (fields: Parameters<typeof updateMyPreferences>[0]) => {
    if (!session) return;
    void updateMyPreferences(fields);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-10">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-primary">
          Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your preferences are saved automatically.
        </p>
      </div>

      {/* Display Preferences */}
      <section className="space-y-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">
          Display
        </h2>

        <div className="space-y-2">
          <Label className="text-sm font-bold">Default View Mode</Label>
          <Select
            value={preferences?.viewMode ?? "detailed"}
            onValueChange={(value: "compact" | "detailed") =>
              update({ viewMode: value })
            }
          >
            <SelectTrigger className="w-48 h-10 rounded-xl border-2 font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="detailed">Detailed</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-bold">
              Show Filter Sidebar by Default
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">Desktop only</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Show Filter Sidebar by Default"
            aria-checked={preferences?.sidebarOpen ?? false}
            onClick={() =>
              update({ sidebarOpen: !(preferences?.sidebarOpen ?? false) })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
              (preferences?.sidebarOpen ?? false) ? "bg-primary" : "bg-input"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                (preferences?.sidebarOpen ?? false)
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-bold">Default Auction Status</Label>
          <Select
            value={preferences?.defaultStatusFilter ?? "active"}
            onValueChange={(value: "active" | "closed" | "all") =>
              update({ defaultStatusFilter: value })
            }
          >
            <SelectTrigger className="w-48 h-10 rounded-xl border-2 font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active Auctions</SelectItem>
              <SelectItem value="closed">Closed Auctions</SelectItem>
              <SelectItem value="all">All Auctions</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Bidding Preferences */}
      <section className="space-y-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">
          Bidding
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-bold">
              Require Bid Confirmation
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Show a confirmation dialog before placing bids
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Require Bid Confirmation"
            aria-checked={preferences?.biddingRequireConfirmation ?? false}
            onClick={() =>
              update({
                biddingRequireConfirmation: !(
                  preferences?.biddingRequireConfirmation ?? false
                ),
              })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
              (preferences?.biddingRequireConfirmation ?? false)
                ? "bg-primary"
                : "bg-input"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                (preferences?.biddingRequireConfirmation ?? false)
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-bold">
              Enable Proxy Bidding by Default
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically bid up to your maximum amount
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Enable Proxy Bidding by Default"
            aria-checked={preferences?.biddingProxyBidDefault ?? false}
            onClick={() =>
              update({
                biddingProxyBidDefault: !(
                  preferences?.biddingProxyBidDefault ?? false
                ),
              })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
              (preferences?.biddingProxyBidDefault ?? false)
                ? "bg-primary"
                : "bg-input"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                (preferences?.biddingProxyBidDefault ?? false)
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="space-y-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">
          Notifications
        </h2>
        <p className="text-xs text-muted-foreground -mt-3">
          These settings control which in-app notification types you receive.
        </p>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold">Outbid Alerts</Label>
          <button
            type="button"
            role="switch"
            aria-label="Outbid Alerts"
            aria-checked={preferences?.notificationsBidOutbid ?? true}
            onClick={() =>
              update({
                notificationsBidOutbid: !(
                  preferences?.notificationsBidOutbid ?? true
                ),
              })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
              (preferences?.notificationsBidOutbid ?? true)
                ? "bg-primary"
                : "bg-input"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                (preferences?.notificationsBidOutbid ?? true)
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-bold">Watchlist Ending Alerts</Label>
          <Select
            value={preferences?.notificationsWatchlistEnding ?? "1h"}
            onValueChange={(value: "disabled" | "1h" | "3h" | "24h") =>
              update({ notificationsWatchlistEnding: value })
            }
          >
            <SelectTrigger className="w-48 h-10 rounded-xl border-2 font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="1h">1 hour before</SelectItem>
              <SelectItem value="3h">3 hours before</SelectItem>
              <SelectItem value="24h">24 hours before</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold">Auction Won Notifications</Label>
          <button
            type="button"
            role="switch"
            aria-label="Auction Won Notifications"
            aria-checked={preferences?.notificationsAuctionWon ?? true}
            onClick={() =>
              update({
                notificationsAuctionWon: !(
                  preferences?.notificationsAuctionWon ?? true
                ),
              })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
              (preferences?.notificationsAuctionWon ?? true)
                ? "bg-primary"
                : "bg-input"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                (preferences?.notificationsAuctionWon ?? true)
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {isSeller && (
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-bold">
                Auction Approval Notifications
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Notify when your auction listing is approved
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Auction Approval Notifications"
              aria-checked={
                preferences?.notificationsSellerAuctionApproved ?? true
              }
              onClick={() =>
                update({
                  notificationsSellerAuctionApproved: !(
                    preferences?.notificationsSellerAuctionApproved ?? true
                  ),
                })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                (preferences?.notificationsSellerAuctionApproved ?? true)
                  ? "bg-primary"
                  : "bg-input"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                  (preferences?.notificationsSellerAuctionApproved ?? true)
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-bold">Email Notifications</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receive notifications via email (in addition to in-app)
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Email Notifications"
            aria-checked={preferences?.notificationsEmailEnabled ?? false}
            onClick={() =>
              update({
                notificationsEmailEnabled: !(
                  preferences?.notificationsEmailEnabled ?? false
                ),
              })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
              (preferences?.notificationsEmailEnabled ?? false)
                ? "bg-primary"
                : "bg-input"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                (preferences?.notificationsEmailEnabled ?? false)
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>
    </div>
  );
}
