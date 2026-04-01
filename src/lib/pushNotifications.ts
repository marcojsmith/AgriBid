/** Shape of a push subscription as returned by PushManager.subscribe(). */
export interface PushSubscriptionData {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Converts a base64url string to a Uint8Array.
 * Required for the applicationServerKey when subscribing to push.
 *
 * @param base64String - Base64url-encoded string
 * @returns Decoded Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks whether the browser supports service workers and the Push API.
 *
 * @returns `true` if push notifications are supported
 */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * Requests notification permission and subscribes the user to push.
 * Reuses an existing subscription if one already exists.
 *
 * @returns The subscription as PushSubscriptionJSON
 * @throws If permission is denied or subscription fails
 */
export async function subscribeUserToPush(): Promise<PushSubscriptionData> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was denied");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      throw new Error(
        "VITE_VAPID_PUBLIC_KEY is not set. Push notifications cannot be enabled."
      );
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });
  }

  const json = subscription.toJSON();

  if (!json.keys?.p256dh || !json.keys?.auth) {
    throw new Error(
      "Push subscription is missing required cryptographic keys (p256dh/auth)"
    );
  }

  return {
    endpoint: json.endpoint ?? subscription.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

/**
 * Unsubscribes the user from push notifications.
 *
 * @returns `true` if successfully unsubscribed
 */
export async function unsubscribeUserFromPush(): Promise<boolean> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    return await subscription.unsubscribe();
  }
  return true;
}

/**
 * Clears the PWA home screen badge (Badging API).
 * Safe to call even if Badging API is not supported.
 */
export async function clearBadge(): Promise<void> {
  if ("clearAppBadge" in navigator) {
    try {
      await (
        navigator as Navigator & {
          clearAppBadge: () => Promise<void>;
        }
      ).clearAppBadge();
    } catch {
      // Badge API may not be available on all platforms
    }
  }
}

/**
 * Gets the current notification permission state.
 *
 * @returns The current NotificationPermission value
 */
export function getNotificationPermission(): NotificationPermission {
  return Notification.permission;
}
