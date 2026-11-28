import { useId, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ChevronRight } from "lucide-react";

import { SubPage } from "@/components/account/AccountLayout";
import { AddToHomeScreenSheet } from "@/components/ds/AddToHomeScreenSheet";
import { Banner } from "@/components/ds/Banner";
import { showToast } from "@/components/ds/showToast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { usePushStatus } from "@/hooks/usePushStatus";
import { WATCHED_ALERTS_ON_PATCH, watchedAlertsOn } from "@/lib/account";
import { buildTitle } from "@/lib/seo";
import { cn } from "@/lib/utils";

/** The three push switches, in display order. */
const SWITCHES = [
  {
    key: "notificationsWatchedLots",
    label: "Watched lots",
    text: "You've been outbid. Closing in 1 hour.",
    paused: "watchAlertsEnabled",
    pausedText: "Alerts for watched lots are paused right now.",
  },
  {
    key: "notificationsLotsWon",
    label: "Lots you win",
    text: "Payment and collection reminders.",
  },
  {
    key: "notificationsSalesOpening",
    label: "Sales opening",
    text: "When a sale you asked about opens.",
    paused: "pushRemindersEnabled",
    pausedText: "Sale reminders are paused right now.",
  },
] as const;

type SwitchKey = (typeof SWITCHES)[number]["key"];

interface SwitchRowProps {
  label: string;
  text: string;
  note?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}

/**
 * One switch row: label, one line of help and a 52px switch, all on a 56px
 * minimum row. The switch carries the label for screen readers.
 *
 * @param props - Component props
 * @param props.label - Switch name
 * @param props.text - What it covers
 * @param props.note - An extra note, for example that alerts are paused
 * @param props.checked - Whether it is on
 * @param props.disabled - Dim it and ignore taps
 * @param props.onChange - Called with the new value
 * @returns The row
 */
function SwitchRow({
  label,
  text,
  note,
  checked,
  disabled,
  onChange,
}: SwitchRowProps) {
  const id = useId();
  return (
    <li
      className={cn(
        "flex min-h-14 items-center gap-3 border-b border-border py-2"
      )}
    >
      <label htmlFor={id} className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[17px] font-semibold",
            disabled && "text-muted-foreground"
          )}
        >
          {label}
        </span>
        <span className="block text-sm text-muted-foreground">{text}</span>
        {note ? (
          <span className="block text-sm font-semibold text-warn-fg">
            {note}
          </span>
        ) : null}
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="h-8 w-[52px] [&>span]:ml-0.5 [&>span]:size-6"
      />
    </li>
  );
}

/**
 * The notifications page: "On this phone" (on, off, blocked, needs the Home
 * Screen app, or not available) and the three switches (watched lots, lots you
 * win, sales opening). Only push is ever sent. A switch that an admin has
 * paused still shows, with a note. The switches are dimmed while this phone
 * is off.
 *
 * @returns The page
 */
export default function NotificationsPage() {
  const push = usePushStatus();
  const prefs = useQuery(api.userPreferences.getMyPreferences);
  const settings = useQuery(api.admin.platformSettings.getPlatformSettings);
  const update = useMutation(api.userPreferences.updateMyPreferences);
  const [installOpen, setInstallOpen] = useState(false);

  const head = (
    <Helmet>
      <title>{buildTitle("Notifications")}</title>
      <meta name="robots" content="noindex" />
    </Helmet>
  );

  if (prefs === undefined || push.state === "loading") {
    return (
      <SubPage title="Notifications">
        {head}
        <div
          role="status"
          aria-label="Loading notifications"
          className="space-y-3"
        >
          <Skeleton className="h-11 w-full" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </SubPage>
    );
  }

  const turnOn = async () => {
    const result = await push.turnOn();
    if (result === "install") setInstallOpen(true);
    else if (result === "blocked") {
      showToast(
        "Still blocked. Allow notifications in your browser settings.",
        "error"
      );
    } else if (result === "unsupported") {
      showToast("This browser can't receive notifications.", "error");
    } else if (result === "failed") {
      showToast("Couldn't turn on notifications. Try again.", "error");
    } else showToast("Notifications are on for this phone.");
  };

  const turnOff = async () => {
    try {
      await push.turnOff();
      showToast("Notifications are off for this phone.");
    } catch {
      showToast("Couldn't turn off notifications. Try again.", "error");
    }
  };

  const change = (key: SwitchKey, next: boolean) => {
    // Turning Watched lots on also clears the retired outbid and ending
    // settings, which still gate each alert on the server.
    const patch =
      key === "notificationsWatchedLots"
        ? next
          ? WATCHED_ALERTS_ON_PATCH
          : { notificationsWatchedLots: false }
        : key === "notificationsLotsWon"
          ? { notificationsLotsWon: next }
          : { notificationsSalesOpening: next };
    update(patch).catch(() => {
      showToast("Couldn't save that. Try again.", "error");
    });
  };

  const showSwitches = push.state === "on" || push.state === "off";
  const state = push.state;

  return (
    <SubPage title="Notifications">
      {head}
      {state === "on" ? (
        <Banner kind="ok">On for this phone</Banner>
      ) : state === "off" ? (
        <Banner kind="warn">Notifications are off on this phone</Banner>
      ) : state === "blocked" ? (
        <Banner kind="warn">Notifications are blocked in your browser</Banner>
      ) : state === "install" ? (
        <Banner kind="warn">Add AgriBid to your Home Screen first</Banner>
      ) : (
        <Banner kind="info">This browser can't receive notifications</Banner>
      )}

      {state === "blocked" ? (
        <p className="text-base text-muted-foreground">
          Allow notifications for AgriBid in your browser settings, then come
          back and turn them on.
        </p>
      ) : null}
      {state === "install" ? (
        <p className="text-base text-muted-foreground">
          iPhone only sends notifications to apps on the Home Screen.
        </p>
      ) : null}

      {state === "off" || state === "blocked" ? (
        <Button
          type="button"
          className="w-full"
          disabled={push.busy}
          onClick={() => {
            void turnOn();
          }}
        >
          Turn on notifications
        </Button>
      ) : null}
      {state === "install" ? (
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            setInstallOpen(true);
          }}
        >
          Show me how
        </Button>
      ) : null}

      {showSwitches ? (
        <ul className="list-none p-0">
          {SWITCHES.map((item) => {
            const pausedKey = "paused" in item ? item.paused : undefined;
            const paused =
              pausedKey !== undefined && settings?.[pausedKey] === false;
            return (
              <SwitchRow
                key={item.key}
                label={item.label}
                text={item.text}
                note={
                  paused && "pausedText" in item ? item.pausedText : undefined
                }
                checked={
                  item.key === "notificationsWatchedLots"
                    ? watchedAlertsOn(prefs)
                    : prefs?.[item.key] !== false
                }
                disabled={state !== "on"}
                onChange={(next) => {
                  change(item.key, next);
                }}
              />
            );
          })}
        </ul>
      ) : null}

      {state === "on" ? (
        <>
          <p className="text-sm text-muted-foreground">
            We only send push notifications, never SMS or email.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={push.busy}
            onClick={() => {
              void turnOff();
            }}
          >
            Turn off on this phone
          </Button>
        </>
      ) : null}

      {state === "blocked" ? (
        <button
          type="button"
          onClick={() => {
            setInstallOpen(true);
          }}
          className="inline-flex min-h-11 items-center gap-1 text-base font-semibold"
        >
          On iPhone: add AgriBid to your Home Screen
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      ) : null}
      <AddToHomeScreenSheet open={installOpen} onOpenChange={setInstallOpen} />
    </SubPage>
  );
}
