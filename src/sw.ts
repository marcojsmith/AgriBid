/// <reference lib="webworker" />

import { precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    unreadCount?: number;
  };
}

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Handles incoming push events and displays notifications.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: PushNotificationData;
  try {
    payload = event.data.json() as PushNotificationData;
  } catch {
    payload = {
      title: "AgriBid",
      body: "You have a new notification",
    };
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon ?? "/icons/icon-192x192.png",
    badge: payload.badge ?? "/icons/badge-72x72.png",
    data: payload.data,
    tag: "agribid-notification",
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title, options);

      if (payload.data?.unreadCount !== undefined) {
        if ("setAppBadge" in navigator) {
          try {
            await (
              navigator as unknown as {
                setAppBadge: (count: number) => Promise<void>;
              }
            ).setAppBadge(payload.data.unreadCount);
          } catch {
            // Badge API not supported on this platform
          }
        }
      }
    })()
  );
});

/**
 * Handles notification click — navigates to the linked URL or dashboard.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = new URL(
    (event.notification.data?.url as string) || "/dashboard",
    self.location.origin
  ).href;

  event.waitUntil(
    (async () => {
      if ("clearAppBadge" in navigator) {
        try {
          await (
            navigator as unknown as {
              clearAppBadge: () => Promise<void>;
            }
          ).clearAppBadge();
        } catch {
          // Badge API not supported
        }
      }

      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await (client as WindowClient).focus();
          if ("navigate" in client) {
            await (client as WindowClient).navigate(urlToOpen);
          }
          return;
        }
      }

      await self.clients.openWindow(urlToOpen);
    })()
  );
});

/**
 * Handles push subscription changes (rotation).
 * The actual backend sync is deferred to the useProfile hook on next app open
 * because Convex is not accessible from the service worker.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const oldSubscription = event.oldSubscription;
      if (!oldSubscription) return;

      const subscribeOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      };
      if (oldSubscription.options.applicationServerKey !== null) {
        subscribeOptions.applicationServerKey =
          oldSubscription.options.applicationServerKey;
      }
      await self.registration.pushManager.subscribe(subscribeOptions);

      // Backend sync happens on next app load via the push subscription sync effect
    })()
  );
});
