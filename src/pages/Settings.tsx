import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { useRef, useState, useCallback } from "react";

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
import {
  isPushSupported,
  subscribeUserToPush,
  unsubscribeUserFromPush,
} from "@/lib/pushNotifications";

type PrefKey =
  | "notificationsOutbid"
  | "notificationsAuctionWon"
  | "notificationsWatchlistEnding"
  | "notificationsListingApproved"
  | "notificationsAuctionLost"
  | "notificationsReserveNotMet";

type NotificationPref = {
  inApp: boolean;
  push: boolean;
  email: boolean;
  whatsapp: boolean;
};

type WatchlistPref = NotificationPref & {
  window: "disabled" | "1h" | "3h" | "24h";
};

const DEFAULT_NOTIFICATION_PREF: NotificationPref = {
  inApp: true,
  push: false,
  email: false,
  whatsapp: false,
};

const DEFAULT_WATCHLIST_PREF: WatchlistPref = {
  inApp: true,
  push: false,
  email: false,
  whatsapp: false,
  window: "1h",
};

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
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange();
          }
        }}
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
 * Renders a notification preference row with in-app and push toggles.
 *
 * @param props - Component props
 * @param props.label - Display label for the notification type
 * @param props.description - Subtitle description
 * @param props.prefKey - Preference field key
 * @param props.inAppChecked - Whether in-app is enabled
 * @param props.pushChecked - Whether push is enabled
 * @param props.onInAppToggle - Handler for in-app toggle
 * @param props.onPushToggle - Handler for push toggle
 * @param props.pushSupported - Whether push is supported in browser
 * @param props.isEnablingPush - Whether push enable is in progress
 * @returns JSX for the notification toggle row
 */
function NotificationToggleRow({
  label,
  description,
  prefKey,
  inAppChecked,
  pushChecked,
  onInAppToggle,
  onPushToggle,
  pushSupported,
  isEnablingPush,
}: {
  label: string;
  description: string;
  prefKey: PrefKey;
  inAppChecked: boolean;
  pushChecked: boolean;
  onInAppToggle: () => void;
  onPushToggle: (key: PrefKey) => void;
  pushSupported: boolean;
  isEnablingPush: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label className="text-sm font-bold">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          role="switch"
          aria-label={`${label} in-app`}
          aria-checked={inAppChecked}
          onClick={onInAppToggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onInAppToggle();
            }
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
            inAppChecked ? "bg-primary" : "bg-input"
          }`}
          title="In-app"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
              inAppChecked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        {pushSupported && (
          <button
            type="button"
            role="switch"
            aria-label={`${label} push`}
            aria-checked={pushChecked}
            onClick={() => onPushToggle(prefKey)}
            disabled={isEnablingPush}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
              pushChecked ? "bg-blue-600" : "bg-input"
            }`}
            title="Push"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                pushChecked ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        )}
      </div>
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
  const updatePushSub = useMutation(api.users.updatePushSubscription);
  const isSavingRef = useRef(false);
  const [pushSupported] = useState(isPushSupported());
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  if (preferences === undefined || myProfile === undefined) {
    return <LoadingPage message="Loading settings..." />;
  }

  const isSeller = myProfile?.profile?.role === "seller";

  /**
   * Builds the updated preference object for a given key and push state.
   *
   * @param prefs - Current preferences
   * @param prefKey - The preference field to update
   * @param pushValue - The new push value
   * @returns The updated preference object
   */
  const buildUpdatedPref = useCallback(
    (
      prefs: NonNullable<typeof preferences>,
      prefKey: PrefKey,
      pushValue: boolean
    ): Parameters<typeof updateMyPreferences>[0] => {
      if (prefKey === "notificationsWatchlistEnding") {
        const current: WatchlistPref =
          prefs.notificationsWatchlistEnding ?? DEFAULT_WATCHLIST_PREF;
        return {
          notificationsWatchlistEnding: {
            ...current,
            window: current.window ?? "1h",
            push: pushValue,
          },
        };
      }
      const current: NotificationPref =
        (prefs[prefKey] as NotificationPref | undefined) ??
        DEFAULT_NOTIFICATION_PREF;
      return { [prefKey]: { ...current, push: pushValue } };
    },
    [updateMyPreferences]
  );

  /**
   * Toggles push notifications for a specific notification type.
   * When enabling: requests browser permission, subscribes, saves to backend.
   * When disabling: updates preference, removes subscription if no push types left.
   *
   * @param prefKey - The notification preference field to toggle push for
   */
  const togglePush = useCallback(
    async (prefKey: PrefKey) => {
      if (!session) {
        toast.error("Not signed in");
        return;
      }
      if (!preferences) return;

      const current = preferences[prefKey] ?? {
        inApp: true,
        push: false,
        email: false,
        whatsapp: false,
      };
      const isEnabling = !current.push;

      if (isEnabling) {
        setIsEnablingPush(true);
        try {
          const subscription = await subscribeUserToPush();
          await updatePushSub({
            pushNotificationsEnabled: true,
            pushSubscription: subscription,
          });
          await updateMyPreferences(
            buildUpdatedPref(preferences, prefKey, true)
          );
          toast.success("Push notifications enabled");
        } catch (err) {
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to enable push notifications"
          );
        } finally {
          setIsEnablingPush(false);
        }
      } else {
        try {
          await updateMyPreferences(
            buildUpdatedPref(preferences, prefKey, false)
          );

          // Build the intended new state to check remaining push
          const newPrefs = {
            ...preferences,
            [prefKey]: buildUpdatedPref(preferences, prefKey, false),
          };
          const remainingPush =
            newPrefs.notificationsOutbid?.push ||
            newPrefs.notificationsAuctionWon?.push ||
            newPrefs.notificationsWatchlistEnding?.push ||
            newPrefs.notificationsListingApproved?.push;

          if (!remainingPush) {
            await unsubscribeUserFromPush();
            await updatePushSub({ pushNotificationsEnabled: false });
          }
          toast.success("Push notifications disabled");
        } catch (err) {
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to disable push notifications"
          );
        }
      }
    },
    [session, preferences, updatePushSub, updateMyPreferences, buildUpdatedPref]
  );

  const update = useCallback(
    (
      fieldsOrUpdater:
        | Parameters<typeof updateMyPreferences>[0]
        | ((
            current: NonNullable<typeof preferences>
          ) => Parameters<typeof updateMyPreferences>[0])
    ) => {
      if (!session) {
        toast.error("Not signed in");
        return;
      }

      if (isSavingRef.current) {
        return;
      }

      isSavingRef.current = true;

      const fields =
        typeof fieldsOrUpdater === "function"
          ? fieldsOrUpdater(preferences!)
          : fieldsOrUpdater;

      updateMyPreferences(fields)
        .then(() => {
          toast.success("Setting saved");
        })
        .catch(() => {
          toast.error("Failed to save setting");
        })
        .finally(() => {
          isSavingRef.current = false;
        });
    },
    [session, preferences, updateMyPreferences]
  );

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

      {/* Notification Preferences */}
      <section className="space-y-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">
          Notifications
        </h2>
        <p className="text-xs text-muted-foreground -mt-3">
          Control which notification types you receive and through which
          channels.
        </p>

        {!pushSupported && (
          <p className="text-xs text-muted-foreground bg-muted p-3 rounded">
            Push notifications are not supported in this browser.
          </p>
        )}

        <div className="space-y-4">
          {pushSupported && (
            <div className="flex items-center justify-end gap-4 pr-0.5">
              <span className="text-xs font-medium text-muted-foreground w-11 text-center">
                In-app
              </span>
              <span className="text-xs font-medium text-muted-foreground w-11 text-center">
                Push
              </span>
            </div>
          )}

          <NotificationToggleRow
            label="Outbid Alerts"
            description="When someone outbids you"
            prefKey="notificationsOutbid"
            inAppChecked={preferences?.notificationsOutbid?.inApp ?? true}
            pushChecked={preferences?.notificationsOutbid?.push ?? false}
            onInAppToggle={() => {
              const current = preferences?.notificationsOutbid ?? {
                inApp: true,
                push: false,
                email: false,
                whatsapp: false,
              };
              update({
                notificationsOutbid: {
                  ...current,
                  inApp: !current.inApp,
                },
              });
            }}
            onPushToggle={togglePush}
            pushSupported={pushSupported}
            isEnablingPush={isEnablingPush}
          />

          <NotificationToggleRow
            label="Watchlist Ending Alerts"
            description="When watched auctions are ending soon"
            prefKey="notificationsWatchlistEnding"
            inAppChecked={
              preferences?.notificationsWatchlistEnding?.inApp ?? true
            }
            pushChecked={
              preferences?.notificationsWatchlistEnding?.push ?? false
            }
            onInAppToggle={() => {
              const current = preferences?.notificationsWatchlistEnding ?? {
                inApp: true,
                push: false,
                email: false,
                whatsapp: false,
                window: "1h" as const,
              };
              update({
                notificationsWatchlistEnding: {
                  ...current,
                  inApp: !current.inApp,
                },
              });
            }}
            onPushToggle={togglePush}
            pushSupported={pushSupported}
            isEnablingPush={isEnablingPush}
          />

          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold">
              Alert Before Auction Ends
            </Label>
            <Select
              value={preferences?.notificationsWatchlistEnding?.window ?? "1h"}
              disabled={
                !(preferences?.notificationsWatchlistEnding?.inApp ?? true)
              }
              onValueChange={(value: "1h" | "3h" | "24h") =>
                update({
                  notificationsWatchlistEnding: {
                    ...(preferences?.notificationsWatchlistEnding ?? {
                      inApp: true,
                      push: false,
                      email: false,
                      whatsapp: false,
                    }),
                    window: value,
                  },
                })
              }
            >
              <SelectTrigger className="w-48 h-10 rounded-md border-2 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1 hour before</SelectItem>
                <SelectItem value="3h">3 hours before</SelectItem>
                <SelectItem value="24h">24 hours before</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <NotificationToggleRow
            label="Auction Won Notifications"
            description="When you win or an auction ends"
            prefKey="notificationsAuctionWon"
            inAppChecked={preferences?.notificationsAuctionWon?.inApp ?? true}
            pushChecked={preferences?.notificationsAuctionWon?.push ?? false}
            onInAppToggle={() => {
              const current = preferences?.notificationsAuctionWon ?? {
                inApp: true,
                push: false,
                email: false,
                whatsapp: false,
              };
              update({
                notificationsAuctionWon: {
                  ...current,
                  inApp: !current.inApp,
                },
              });
            }}
            onPushToggle={togglePush}
            pushSupported={pushSupported}
            isEnablingPush={isEnablingPush}
          />

          <NotificationToggleRow
            label="Auction Lost Notifications"
            description="When an auction you bid on ends and you did not win"
            prefKey="notificationsAuctionLost"
            inAppChecked={preferences?.notificationsAuctionLost?.inApp ?? true}
            pushChecked={preferences?.notificationsAuctionLost?.push ?? false}
            onInAppToggle={() => {
              const current = preferences?.notificationsAuctionLost ?? {
                inApp: true,
                push: false,
                email: false,
                whatsapp: false,
              };
              update({
                notificationsAuctionLost: {
                  ...current,
                  inApp: !current.inApp,
                },
              });
            }}
            onPushToggle={togglePush}
            pushSupported={pushSupported}
            isEnablingPush={isEnablingPush}
          />

          <NotificationToggleRow
            label="Reserve Not Met Notifications"
            description="When your auction closes without meeting the reserve price"
            prefKey="notificationsReserveNotMet"
            inAppChecked={
              preferences?.notificationsReserveNotMet?.inApp ?? true
            }
            pushChecked={preferences?.notificationsReserveNotMet?.push ?? false}
            onInAppToggle={() => {
              const current = preferences?.notificationsReserveNotMet ?? {
                inApp: true,
                push: false,
                email: false,
                whatsapp: false,
              };
              update({
                notificationsReserveNotMet: {
                  ...current,
                  inApp: !current.inApp,
                },
              });
            }}
            onPushToggle={togglePush}
            pushSupported={pushSupported}
            isEnablingPush={isEnablingPush}
          />

          {isSeller && (
            <NotificationToggleRow
              label="Auction Approval Notifications"
              description="When your auction listing is approved"
              prefKey="notificationsListingApproved"
              inAppChecked={
                preferences?.notificationsListingApproved?.inApp ?? true
              }
              pushChecked={
                preferences?.notificationsListingApproved?.push ?? false
              }
              onInAppToggle={() => {
                const current = preferences?.notificationsListingApproved ?? {
                  inApp: true,
                  push: false,
                  email: false,
                  whatsapp: false,
                };
                update({
                  notificationsListingApproved: {
                    ...current,
                    inApp: !current.inApp,
                  },
                });
              }}
              onPushToggle={togglePush}
              pushSupported={pushSupported}
              isEnablingPush={isEnablingPush}
            />
          )}
        </div>
      </section>

      {/* Display Preferences */}
      <section className="space-y-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">
          Display
        </h2>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold">Default View Mode</Label>
          <Select
            value={preferences?.viewMode ?? "detailed"}
            onValueChange={(value: "compact" | "detailed") =>
              update({ viewMode: value })
            }
          >
            <SelectTrigger className="w-48 h-10 rounded-md border-2 font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="detailed">Detailed</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-end gap-4 pr-0.5">
            <span className="text-xs font-medium text-muted-foreground w-11 text-center">
              On/Off
            </span>
          </div>
          <ToggleSwitch
            label="Show Filter Sidebar by Default"
            checked={preferences?.sidebarOpen ?? false}
            onChange={() =>
              update({ sidebarOpen: !(preferences?.sidebarOpen ?? false) })
            }
            description="Desktop only"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold">Default Auction Status</Label>
          <Select
            value={preferences?.defaultStatusFilter ?? "active"}
            onValueChange={(value: "active" | "closed" | "all") =>
              update({ defaultStatusFilter: value })
            }
          >
            <SelectTrigger className="w-48 h-10 rounded-md border-2 font-bold">
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

        <div className="space-y-4">
          <div className="flex items-center justify-end gap-4 pr-0.5">
            <span className="text-xs font-medium text-muted-foreground w-11 text-center">
              On/Off
            </span>
          </div>
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
        </div>
      </section>
    </div>
  );
}
