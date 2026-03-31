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
 * Reusable toggle switch button.
 *
 * @param root0 - ToggleSwitch props.
 * @param root0.label - Accessible label for the switch.
 * @param root0.checked - Whether the switch is on.
 * @param root0.onChange - Callback when the switch is toggled.
 * @param root0.description - Optional description text below the label.
 * @returns The toggle switch JSX element.
 */
function ToggleSwitch({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label className="text-sm font-bold">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
          checked ? "bg-primary" : "bg-input"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

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

        <ToggleSwitch
          label="Show Filter Sidebar by Default"
          checked={preferences?.sidebarOpen ?? false}
          onChange={() =>
            update({ sidebarOpen: !(preferences?.sidebarOpen ?? false) })
          }
          description="Desktop only"
        />

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

        <ToggleSwitch
          label="Require Bid Confirmation"
          checked={preferences?.biddingRequireConfirmation ?? false}
          onChange={() =>
            update({
              biddingRequireConfirmation: !(
                preferences?.biddingRequireConfirmation ?? false
              ),
            })
          }
          description="Show a confirmation dialog before placing bids"
        />

        <ToggleSwitch
          label="Enable Proxy Bidding by Default"
          checked={preferences?.biddingProxyBidDefault ?? false}
          onChange={() =>
            update({
              biddingProxyBidDefault: !(
                preferences?.biddingProxyBidDefault ?? false
              ),
            })
          }
          description="Automatically bid up to your maximum amount"
        />
      </section>

      {/* Notification Preferences */}
      <section className="space-y-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">
          Notifications
        </h2>
        <p className="text-xs text-muted-foreground -mt-3">
          These settings control which in-app notification types you receive.
        </p>

        <ToggleSwitch
          label="Outbid Alerts"
          checked={preferences?.notificationsBidOutbid ?? true}
          onChange={() =>
            update({
              notificationsBidOutbid: !(
                preferences?.notificationsBidOutbid ?? true
              ),
            })
          }
        />

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

        <ToggleSwitch
          label="Auction Won Notifications"
          checked={preferences?.notificationsAuctionWon ?? true}
          onChange={() =>
            update({
              notificationsAuctionWon: !(
                preferences?.notificationsAuctionWon ?? true
              ),
            })
          }
        />

        {isSeller && (
          <ToggleSwitch
            label="Auction Approval Notifications"
            checked={preferences?.notificationsSellerAuctionApproved ?? true}
            onChange={() =>
              update({
                notificationsSellerAuctionApproved: !(
                  preferences?.notificationsSellerAuctionApproved ?? true
                ),
              })
            }
            description="Notify when your auction listing is approved"
          />
        )}

        <ToggleSwitch
          label="Email Notifications"
          checked={preferences?.notificationsEmailEnabled ?? false}
          onChange={() =>
            update({
              notificationsEmailEnabled: !(
                preferences?.notificationsEmailEnabled ?? false
              ),
            })
          }
          description="Receive notifications via email (in addition to in-app)"
        />
      </section>
    </div>
  );
}
