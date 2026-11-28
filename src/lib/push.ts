/** A browser push subscription in the shape the backend stores. */
export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Whether this browser can do web push at all (service worker, Push API and
 * Notification API).
 *
 * @returns True when push is possible
 */
export function pushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

/**
 * Decodes a URL-safe base64 VAPID public key for `pushManager.subscribe`.
 *
 * @param key - The URL-safe base64 key
 * @returns The key bytes
 */
export function urlBase64ToUint8Array(key: string): Uint8Array<ArrayBuffer> {
  const padded = key + "=".repeat((4 - (key.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Converts a browser subscription to the stored shape.
 *
 * @param subscription - The browser subscription
 * @returns Endpoint and keys, or null when the keys are missing
 */
function toKeys(subscription: PushSubscription): PushSubscriptionKeys | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, p256dh, auth };
}

/**
 * Registers the service worker and subscribes this browser to push, reusing
 * an existing subscription when there is one. Notification permission must
 * already be granted.
 *
 * @param vapidKey - The server's public VAPID key
 * @returns The subscription to store on the server
 * @throws Error when the browser returns a subscription without keys
 */
export async function subscribeToPush(
  vapidKey: string
): Promise<PushSubscriptionKeys> {
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));
  const keys = toKeys(subscription);
  if (!keys) throw new Error("Push subscription has no keys");
  return keys;
}

/**
 * The current subscription of this browser, without prompting or registering.
 *
 * @returns The subscription, or null when there is none
 */
export async function currentSubscription(): Promise<PushSubscriptionKeys | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return null;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? toKeys(subscription) : null;
}

/**
 * Drops this browser's push subscription (the browser side of "Turn off on
 * this phone"). Safe to call when there is none.
 *
 * @returns The endpoint that was removed, or null when there was no subscription
 */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return endpoint;
}
