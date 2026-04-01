import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { useRef, useState } from "react";

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
   * Toggles push notifications for a specific notification type.
   * When enabling: requests browser permission, subscribes, saves to backend.
   * When disabling: updates preference, removes subscription if no push types left.
   *
   * @param prefKey - The notification preference field to toggle push for
   */
  const togglePush = async (
    prefKey:
      | "notificationsOutbid"
      | "notificationsAuctionWon"
      | "notificationsWatchlistEnding"
      | "notificationsListingApproved"
  ) => {
    if (!session) {
      toast.error("Not signed in");
      return;
    }

    const current = preferences?.[prefKey] ?? {
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
        if (prefKey === "notificationsOutbid") {
          await updateMyPreferences({
            notificationsOutbid: { ...current, push: true },
          });
        } else if (prefKey === "notificationsAuctionWon") {
          await updateMyPreferences({
            notificationsAuctionWon: { ...current, push: true },
          });
        } else if (prefKey === "notificationsWatchlistEnding") {
          await updateMyPreferences({
            notificationsWatchlistEnding: {
              ...current,
              window: (preferences?.notificationsWatchlistEnding?.window ??
                "1h") as "disabled" | "1h" | "3h" | "24h",
              push: true,
            },
          });
        } else {
          await updateMyPreferences({
            notificationsListingApproved: { ...current, push: true },
          });
        }
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
        if (prefKey === "notificationsOutbid") {
          await updateMyPreferences({
            notificationsOutbid: { ...current, push: false },
          });
        } else if (prefKey === "notificationsAuctionWon") {
          await updateMyPreferences({
            notificationsAuctionWon: { ...current, push: false },
          });
        } else if (prefKey === "notificationsWatchlistEnding") {
          await updateMyPreferences({
            notificationsWatchlistEnding: {
              ...current,
              window: (preferences?.notificationsWatchlistEnding?.window ??
                "1h") as "disabled" | "1h" | "3h" | "24h",
              push: false,
            },
          });
        } else {
          await updateMyPreferences({
            notificationsListingApproved: { ...current, push: false },
          });
        }

        // Check if any push types remain enabled
        const prefs = preferences;
        const remainingPush =
          (prefKey !== "notificationsOutbid" &&
            (prefs?.notificationsOutbid?.push ?? false)) ||
          (prefKey !== "notificationsAuctionWon" &&
            (prefs?.notificationsAuctionWon?.push ?? false)) ||
          (prefKey !== "notificationsWatchlistEnding" &&
            (prefs?.notificationsWatchlistEnding?.push ?? false)) ||
          (prefKey !== "notificationsListingApproved" &&
            (prefs?.notificationsListingApproved?.push ?? false));

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
  };

  const update = (
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
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-bold">Outbid Alerts</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When someone outbids you
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                role="switch"
                aria-label="Outbid Alerts in-app"
                aria-checked={preferences?.notificationsOutbid?.inApp ?? true}
                onClick={() => {
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
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
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  (preferences?.notificationsOutbid?.inApp ?? true)
                    ? "bg-primary"
                    : "bg-input"
                }`}
                title="In-app"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                    (preferences?.notificationsOutbid?.inApp ?? true)
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
              {pushSupported && (
                <button
                  type="button"
                  role="switch"
                  aria-label="Outbid Alerts push"
                  aria-checked={preferences?.notificationsOutbid?.push ?? false}
                  onClick={() => void togglePush("notificationsOutbid")}
                  disabled={isEnablingPush}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
                    (preferences?.notificationsOutbid?.push ?? false)
                      ? "bg-blue-600"
                      : "bg-input"
                  }`}
                  title="Push"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                      (preferences?.notificationsOutbid?.push ?? false)
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-bold">
                Watchlist Ending Alerts
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When watched auctions are ending soon
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                role="switch"
                aria-label="Watchlist Ending Alerts in-app"
                aria-checked={
                  preferences?.notificationsWatchlistEnding?.inApp ?? true
                }
                onClick={() => {
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const current =
                      preferences?.notificationsWatchlistEnding ?? {
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
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  (preferences?.notificationsWatchlistEnding?.inApp ?? true)
                    ? "bg-primary"
                    : "bg-input"
                }`}
                title="In-app"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                    (preferences?.notificationsWatchlistEnding?.inApp ?? true)
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
              {pushSupported && (
                <button
                  type="button"
                  role="switch"
                  aria-label="Watchlist Ending Alerts push"
                  aria-checked={
                    preferences?.notificationsWatchlistEnding?.push ?? false
                  }
                  onClick={() =>
                    void togglePush("notificationsWatchlistEnding")
                  }
                  disabled={isEnablingPush}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
                    (preferences?.notificationsWatchlistEnding?.push ?? false)
                      ? "bg-blue-600"
                      : "bg-input"
                  }`}
                  title="Push"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                      (preferences?.notificationsWatchlistEnding?.push ?? false)
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              )}
            </div>
          </div>

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
              <SelectTrigger className="w-48 h-10 rounded-xl border-2 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1 hour before</SelectItem>
                <SelectItem value="3h">3 hours before</SelectItem>
                <SelectItem value="24h">24 hours before</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-bold">
                Auction Won Notifications
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When you win or an auction ends
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                role="switch"
                aria-label="Auction Won Notifications in-app"
                aria-checked={
                  preferences?.notificationsAuctionWon?.inApp ?? true
                }
                onClick={() => {
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
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
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  (preferences?.notificationsAuctionWon?.inApp ?? true)
                    ? "bg-primary"
                    : "bg-input"
                }`}
                title="In-app"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                    (preferences?.notificationsAuctionWon?.inApp ?? true)
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
              {pushSupported && (
                <button
                  type="button"
                  role="switch"
                  aria-label="Auction Won Notifications push"
                  aria-checked={
                    preferences?.notificationsAuctionWon?.push ?? false
                  }
                  onClick={() => void togglePush("notificationsAuctionWon")}
                  disabled={isEnablingPush}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
                    (preferences?.notificationsAuctionWon?.push ?? false)
                      ? "bg-blue-600"
                      : "bg-input"
                  }`}
                  title="Push"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                      (preferences?.notificationsAuctionWon?.push ?? false)
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              )}
            </div>
          </div>

          {isSeller && (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-bold">
                  Auction Approval Notifications
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When your auction listing is approved
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  role="switch"
                  aria-label="Auction Approval Notifications in-app"
                  aria-checked={
                    preferences?.notificationsListingApproved?.inApp ?? true
                  }
                  onClick={() => {
                    const current =
                      preferences?.notificationsListingApproved ?? {
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const current =
                        preferences?.notificationsListingApproved ?? {
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
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    (preferences?.notificationsListingApproved?.inApp ?? true)
                      ? "bg-primary"
                      : "bg-input"
                  }`}
                  title="In-app"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                      (preferences?.notificationsListingApproved?.inApp ?? true)
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
                {pushSupported && (
                  <button
                    type="button"
                    role="switch"
                    aria-label="Auction Approval Notifications push"
                    aria-checked={
                      preferences?.notificationsListingApproved?.push ?? false
                    }
                    onClick={() =>
                      void togglePush("notificationsListingApproved")
                    }
                    disabled={isEnablingPush}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
                      (preferences?.notificationsListingApproved?.push ?? false)
                        ? "bg-blue-600"
                        : "bg-input"
                    }`}
                    title="Push"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                        (preferences?.notificationsListingApproved?.push ??
                        false)
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>
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
            <SelectTrigger className="w-48 h-10 rounded-xl border-2 font-bold">
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
