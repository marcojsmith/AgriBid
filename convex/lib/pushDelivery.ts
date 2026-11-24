/** One push to send: where it goes and the JSON text to deliver. */
export interface PushMessage {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: string;
}

/** The subscription shape the `web-push` library takes. */
export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Result of a delivery run. */
export interface DeliveryResult {
  delivered: number;
  /** Endpoints the push service reported gone (404/410); safe to delete. */
  expired: string[];
}

/** Push services whose endpoints we accept (exact hostnames). */
const PUSH_HOSTS: readonly string[] = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
];
/** Push services that use per-device subdomains (hostname suffixes). */
const PUSH_HOST_SUFFIXES: readonly string[] = [
  ".notify.windows.com",
  ".push.apple.com",
];

/**
 * Whether a push endpoint points at a real browser push service. The backend
 * POSTs to every stored endpoint, so anything else (localhost, private or
 * tailnet hosts, other ports, plain http) must never be stored or called.
 *
 * @param url - The endpoint URL from the browser's subscription
 * @returns True for an https URL on a known push-service host and the default port
 */
export function isAllowedPushEndpoint(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.port !== "" && parsed.port !== "443") return false;
  if (parsed.username !== "" || parsed.password !== "") return false;
  const host = parsed.hostname.toLowerCase();
  return (
    PUSH_HOSTS.includes(host) ||
    PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

/**
 * Whether a send error means the subscription no longer exists.
 *
 * @param error - The rejection from the send function
 * @returns True for HTTP 404 or 410
 */
function isGone(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return statusCode === 404 || statusCode === 410;
}

/**
 * Sends every message and reports what happened. One failing endpoint never
 * stops the others. Kept free of `"use node"` so it can be unit tested.
 *
 * @param messages - The pushes to send
 * @param send - Sends one payload to one subscription (e.g. `webpush.sendNotification`)
 * @returns The delivered count and the endpoints that expired
 */
export async function deliverAll(
  messages: readonly PushMessage[],
  send: (target: PushTarget, payload: string) => Promise<unknown>
): Promise<DeliveryResult> {
  const results = await Promise.allSettled(
    messages.map((message) =>
      send(
        {
          endpoint: message.endpoint,
          keys: { p256dh: message.p256dh, auth: message.auth },
        },
        message.payload
      )
    )
  );
  let delivered = 0;
  const expired: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      delivered += 1;
    } else if (isGone(result.reason)) {
      const message = messages[index];
      if (message) expired.push(message.endpoint);
    }
  });
  return { delivered, expired };
}
