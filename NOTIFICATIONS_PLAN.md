# Notifications Implementation Plan for AgriBid

> Reference implementation: `pretoria-prepaid` notification system
> Status: Planning only - not yet implemented

---

## 1. Current State in AgriBid

AgriBid already has foundational notification infrastructure:

- **`notifications` table** with schema supporting personal + broadcast notifications, types (`info`, `success`, `warning`, `error`), optional deeplinks, and read status
- **`readReceipts` table** for tracking broadcast announcement reads
- **`convex/notifications.ts`** with queries (`getMyNotifications`, `getNotificationArchive`) and mutations (`markAsRead`, `markAllRead`)
- **`userPreferences` table** with notification preference fields (`notificationsBidOutbid`, `notificationsWatchlistEnding`, `notificationsAuctionWon`, `notificationsSellerAuctionApproved`, `notificationsEmailEnabled`) — **these flat booleans will be replaced with a channel-aware structure (see Section 6)**
- **`src/lib/notifications.tsx`** client-side helpers
- **Sonner** already installed for toast notifications
- **Convex crons** already in use for auction settlement and cleanup

### What's Missing

- **Web Push Notifications** (server-to-device alerts when user is away)
- **Notification trigger logic** (actually creating notifications when events occur)
- **Service Worker** push event handling
- **Push subscription management** (UI + backend storage)
- **Notification bell/badge UI** in the app header
- **Rate limiting** to prevent notification spam

---

## 2. Implementation Phases

### Phase 1: In-App Notification Triggers

Wire up notification creation at key application events. These use the existing `notifications` table and require no new infrastructure.

#### 1.1 Outbid Notifications

- **Where:** Bid placement logic (auction mutations)
- **When:** A new bid is placed that outbids the previous highest bidder
- **Action:** Create a notification for the outbid user
- **Respect:** `userPreferences.notificationsBidOutbid`
- **Deeplink:** `/auctions/{auctionId}`

#### 1.2 Auction Won / Lost Notifications

- **Where:** `settleExpiredAuctions` cron (already runs every minute)
- **When:** An auction settles with a winner
- **Action:** Notify the winner (success) and losing bidders (info)
- **Respect:** `userPreferences.notificationsAuctionWon`
- **Deeplink:** `/dashboard/my-bids`

#### 1.3 Seller Listing Approved / Rejected

- **Where:** Admin moderation mutations (approve/reject auction)
- **When:** Admin approves or rejects a listing
- **Action:** Notify the seller
- **Respect:** `userPreferences.notificationsSellerAuctionApproved`
- **Deeplink:** `/dashboard/my-listings`

#### 1.4 Watchlist Ending Soon

- **Where:** New cron job (or extend existing settlement cron)
- **When:** A watched auction is ending within the user's preferred window (1h, 3h, or 24h)
- **Action:** Notify watchers based on their preference
- **Respect:** `userPreferences.notificationsWatchlistEnding`
- **Deeplink:** `/auctions/{auctionId}`

#### 1.5 KYC Status Updates

- **Where:** Admin KYC approval/rejection mutations
- **When:** KYC status changes
- **Action:** Notify the user of verification result

#### 1.6 Admin Broadcast Announcements

- **Where:** Already partially supported via `recipientId: "all"`
- **When:** Admin creates an announcement
- **Action:** Uses existing broadcast + readReceipts pattern

---

### Phase 2: Notification Bell & Badge UI

#### 2.1 Header Notification Bell

- Add a bell icon to the app header/navbar
- Show unread count badge (query unread notifications)
- Dropdown panel with recent notifications on click
- "Mark all as read" action
- "View all" link to full notifications page

#### 2.2 Unread Count Query

- Create an optimized `getUnreadCount` query in `convex/notifications.ts`
- Index: use existing `by_recipient_isRead_createdAt` index
- Include both personal unread + broadcast unread (without read receipt)

#### 2.3 Real-Time Updates

- Convex reactive queries will automatically update the bell badge count
- No additional WebSocket setup needed (Convex handles this)

---

### Phase 3: Web Push Notifications

Modeled directly after pretoria-prepaid's implementation. The exact file names and patterns below mirror that repo.

#### 3.1 VAPID Key Setup

- Generate VAPID key pair: `npx web-push generate-vapid-keys`
- Store in environment variables:
  - `VITE_VAPID_PUBLIC_KEY` (client-side, Vite env — also referenced server-side as `process.env.VITE_VAPID_PUBLIC_KEY` inside the Convex action)
  - `VAPID_PRIVATE_KEY` (Convex environment variable)
  - `VAPID_CONTACT_EMAIL` (Convex environment variable)

#### 3.2 Schema Changes

Add push fields to the `profiles` table (single subscription per device/session, consistent with pretoria-prepaid). For AgriBid, also consider a separate `pushSubscriptions` table for multi-device support (see Section 6).

```typescript
// In convex/schema.ts — add to profiles table
pushNotificationsEnabled: v.optional(v.boolean()),
lastPushSent: v.optional(v.number()), // rate limiting timestamp per user
pushSubscription: v.optional(
  v.object({
    endpoint: v.string(),
    expirationTime: v.union(v.number(), v.null()),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
  })
),
```

#### 3.3 Push Subscription Utilities (Client)

Create `src/lib/push-notifications.ts` — copy exactly from `pretoria-prepaid/src/lib/push-notifications.ts`:

- `urlBase64ToUint8Array(base64String)` — internal helper, converts VAPID public key
- `isPushSupported()` — checks `"serviceWorker" in navigator && "PushManager" in window`
- `subscribeUserToPush()` — requests permission, gets/creates subscription via `PushManager`, returns `PushSubscriptionJSON`
- `unsubscribeUserFromPush()` — unsubscribes and returns boolean
- `clearBadge()` — clears PWA home screen badge via Badging API
- `PushSubscriptionJSON` interface (exported): `{ endpoint, expirationTime, keys: { p256dh, auth } }`

#### 3.4 Push Subscription Mutations (Backend)

Add to `convex/users.ts` (same file as other profile mutations, matching pretoria-prepaid's `convex/users.ts`):

**`updateProfile` mutation** — extend existing mutation to accept push fields:

```typescript
pushNotificationsEnabled: v.optional(v.boolean()),
pushSubscription: v.optional(v.object({ endpoint, expirationTime, keys: { p256dh, auth } })),
```

- When `pushNotificationsEnabled === false`, set `pushSubscription: undefined` automatically.

**`updatePushSubscription` mutation** (new, separate from `updateProfile`) — used by the silent-sync hook:

```typescript
args: {
  pushNotificationsEnabled: v.boolean(),
  pushSubscription: v.optional(v.object({ ... })),
}
```

#### 3.5 Silent Sync in `useProfile` Hook

The `useProfile` hook (wherever it lives in AgriBid — likely `src/hooks/useProfile.ts`) must silently sync the push subscription on app load. This handles subscription rotation and new-device login without requiring the user to revisit Settings.

Pattern (from `pretoria-prepaid/src/hooks/useProfile.tsx`):

```typescript
const hasSyncedRef = useRef(false);

useEffect(() => {
  if (
    profile &&
    profile.pushNotificationsEnabled &&
    !hasSyncedRef.current &&
    isPushSupported()
  ) {
    hasSyncedRef.current = true; // prevent re-entrancy
    (async () => {
      try {
        const subscription = await subscribeUserToPush();
        const currentSub = profile.pushSubscription;
        const isDifferent =
          !currentSub ||
          currentSub.endpoint !== subscription.endpoint ||
          JSON.stringify(currentSub.keys) !== JSON.stringify(subscription.keys);

        if (isDifferent) {
          await updatePushSubscription({
            pushNotificationsEnabled: true,
            pushSubscription: subscription,
          });
        }
      } catch (err) {
        console.error("Failed to silently sync push subscription:", err);
      }
    })();
  }
}, [profile, updatePushSubscription]);
```

#### 3.6 Service Worker Setup

Create `src/sw.ts` — structure from `pretoria-prepaid/src/sw.ts`:

```typescript
/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
```

**`push` event handler:**

- Parse `event.data.json()` → `{ title, body, icon, badge, data: { url } }`
- Call `self.registration.showNotification(title, options)`
- Set app badge via Badging API if `data.unreadCount` is present
- Fallback notification on parse error

**`notificationclick` handler:**

- Close notification
- Clear app badge
- `urlToOpen = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href`
- Find existing window client on origin → focus + navigate; else `openWindow(urlToOpen)`

**`pushsubscriptionchange` handler:**

- If `newSubscription` not provided by browser, re-subscribe using `oldSubscription.options.applicationServerKey`
- Log the new subscription; actual backend sync deferred to `useProfile` on next app open (Convex not accessible from SW)

**`vite.config.ts` changes:**

```typescript
import { VitePWA } from "vite-plugin-pwa";
import basicSsl from "@vitejs/plugin-basic-ssl"; // Required: Push API needs HTTPS even in dev

VitePWA({
  strategies: "injectManifest",
  srcDir: "src",
  filename: "sw.ts",
  registerType: "autoUpdate",
  devOptions: { enabled: true, type: "module" },
  includeAssets: ["favicon.ico", "robots.txt", "icons/*.png"],
  manifest: {
    name: "AgriBid",
    short_name: "AgriBid",
    // ... other PWA manifest fields
    display: "standalone",
    start_url: "/",
    icons: [
      /* 192x192, 512x512, 512x512 maskable */
    ],
  },
});
```

> **Dependencies:** `bun add vite-plugin-pwa web-push @vitejs/plugin-basic-ssl`

#### 3.7 `RegisterSW` Component

Create `src/components/RegisterSW.tsx` — from `pretoria-prepaid/src/components/RegisterSW.tsx`:

- Uses `useRegisterSW` from `virtual:pwa-register/react`
- Shows Sonner toast when app is ready offline (`offlineReady`)
- Shows Sonner toast with "Reload" action when update is available (`needRefresh`)
- Returns `null` (no UI)
- Mount in root `App.tsx` (outside all routes, alongside `<Toaster />`)

#### 3.8 Clear Badge in `App.tsx`

In the root `App` component, call `clearBadge()` on mount and on `visibilitychange`:

```typescript
import { clearBadge } from "@/lib/push-notifications";

useEffect(() => {
  clearBadge();
  const handler = () => {
    if (document.visibilityState === "visible") clearBadge();
  };
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}, []);
```

#### 3.9 Push Delivery Action (Backend)

Create `convex/pushActions.ts` (Convex action — must use external Node.js `web-push` library):

```typescript
"use node"; // Required at top of file — this action uses Node built-ins
```

Structure (from `pretoria-prepaid/convex/alerts.ts`):

- `sendPushNotifications` (or per-event actions) — called by cron or event trigger mutations
- On each call: load VAPID keys from `process.env`, call `webpush.setVapidDetails(...)`, then loop eligible users
- For each user: check rate limit via `lastPushSent`, compute whether notification is needed, call `webpush.sendNotification(subscription, payload)`
- **Payload shape:** `JSON.stringify({ title, body, icon, badge, data: { url } })`
- **Error handling:**
  - `statusCode === 410 || 404` → subscription expired, call `removeExpiredSubscription` mutation
  - `statusCode === 403` → VAPID mismatch, log error
  - Other errors → log and continue

#### 3.10 Internal Query/Mutation Helpers (Backend)

Create `convex/pushQueries.ts` (internal helpers, from `pretoria-prepaid/convex/alerts_queries.ts`):

- `getProfilesWithPushEnabled` (internalQuery) — `.filter(q => q.eq(q.field("pushNotificationsEnabled"), true)).collect()`
- `removeExpiredSubscription` (internalMutation) — patches `pushSubscription: undefined, pushNotificationsEnabled: false`
- `updatePushTimestamp` (internalMutation) — patches `lastPushSent: Date.now()`

#### 3.11 Cron Trigger

Add to `convex/crons.ts` (extend existing crons file):

```typescript
crons.interval(
  "send push notifications",
  { minutes: 5 },
  internal.pushActions.sendPushNotifications,
  {}
);
```

Adjust interval based on event type (outbid can be event-driven; watchlist ending can be cron-driven).

#### 3.12 Settings Page Integration

In the notification preferences section of user settings (from `pretoria-prepaid/src/pages/Settings.tsx`):

```typescript
const [pushSupported] = useState(isPushSupported());

// On save, when enabling push:
const subscription = await subscribeUserToPush();
await updateProfile({
  pushNotificationsEnabled: true,
  pushSubscription: subscription,
});

// On save, when disabling push:
await unsubscribeUserFromPush();
await updateProfile({ pushNotificationsEnabled: false });
```

- Show toggle disabled with explanation if `!pushSupported`
- Handle `subscribeUserToPush()` errors (permission denied) by resetting the toggle and showing a toast error

---

### Phase 4: Notification Preferences UI

#### 4.1 Settings Page Integration

Add notification preferences section to user settings (or dedicated page):

- **Push Notifications** master toggle (triggers browser permission + subscription)
- Per-event rows, each showing which channels are active for that event:
  - **Outbid Alerts** — in-app toggle, push toggle
  - **Auction Won** — in-app toggle, push toggle
  - **Watchlist Ending** — in-app toggle, push toggle, timing dropdown (disabled, 1h, 3h, 24h)
  - **Seller Listing Approved** — in-app toggle, push toggle
- Channels that are not yet implemented (email, WhatsApp) are hidden from the UI until their respective vendors are integrated; the schema already stores their values as `false` by default.

#### 4.2 Preference Enforcement

All notification triggers must check user preferences before creating notifications or sending push. Create a helper:

```typescript
async function shouldNotify(
  ctx: QueryCtx,
  userId: string,
  eventType: NotificationEventType
): Promise<{
  inApp: boolean;
  push: boolean;
  email: boolean;
  whatsapp: boolean;
}>;
```

---

### Phase 5: PWA Enhancements (Optional)

#### 5.1 App Badge API

- Set badge count on push receive (unread notification count)
- Clear badge on notification click or when viewing notifications page

#### 5.2 PWA Install Prompt

- Custom install prompt component (reference: `pretoria-prepaid/src/components/InstallPrompt.tsx`)
- Android/Chrome native prompt interception
- iOS manual instructions
- LocalStorage flag to prevent repeated prompts

#### 5.3 Offline Ready Notification

- Show toast when service worker is installed and app is available offline

---

## 3. File Changes Summary

### New Files

| File                                  | Purpose                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/lib/push-notifications.ts`       | Client-side push subscription utilities (copy from pretoria-prepaid)                  |
| `src/sw.ts`                           | Service worker: push events, notification click, subscription rotation                |
| `convex/pushActions.ts`               | Node.js action for sending pushes via `web-push` (`"use node"` at top)                |
| `convex/pushQueries.ts`               | Internal queries/mutations: get eligible profiles, remove expired, update timestamp   |
| `src/components/NotificationBell.tsx` | Header bell icon with unread badge + dropdown                                         |
| `src/components/InstallPrompt.tsx`    | PWA install prompt (Phase 5, copy from pretoria-prepaid)                              |
| `src/components/RegisterSW.tsx`       | SW registration: offline-ready + update-available toasts (copy from pretoria-prepaid) |

### Modified Files

| File                                        | Changes                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `convex/schema.ts`                          | Add `pushNotificationsEnabled`, `lastPushSent`, `pushSubscription` to profiles (or new table for multi-device) |
| `convex/notifications.ts`                   | Add `getUnreadCount` query, notification creation helpers                                                      |
| `convex/crons.ts`                           | Add push notification cron (e.g. every 5 min); add watchlist ending soon check                                 |
| `convex/auctions/mutations/*.ts`            | Add outbid notification trigger in bid placement                                                               |
| `convex/auctions/internal.ts`               | Add won/lost notifications in settlement logic                                                                 |
| `convex/users.ts`                           | Add `updatePushSubscription` mutation; extend `updateProfile` with push fields                                 |
| `src/hooks/useProfile.ts`                   | Add silent-sync effect for push subscription rotation                                                          |
| `src/App.tsx`                               | Mount `<RegisterSW />`, `<InstallPrompt />`; call `clearBadge()` on mount + visibilitychange                   |
| `src/components/Header.tsx` (or equivalent) | Integrate `NotificationBell` component                                                                         |
| `vite.config.ts`                            | Add `VitePWA` with `injectManifest` strategy; add `basicSsl` plugin for dev HTTPS                              |
| `package.json`                              | Add `web-push`, `vite-plugin-pwa`, `@vitejs/plugin-basic-ssl` dependencies                                     |

---

## 4. New Dependencies

```bash
bun add web-push vite-plugin-pwa @vitejs/plugin-basic-ssl
bun add -d @types/web-push
```

`web-push` is only used server-side in the Convex Node.js action. `vite-plugin-pwa` handles SW bundling. `basicSsl` enables HTTPS in dev (required for the Push API in browsers).

---

## 5. Environment Variables

| Variable                | Scope         | Purpose                    |
| ----------------------- | ------------- | -------------------------- |
| `VITE_VAPID_PUBLIC_KEY` | Client (Vite) | Push subscription creation |
| `VAPID_PRIVATE_KEY`     | Convex env    | Push notification signing  |
| `VAPID_CONTACT_EMAIL`   | Convex env    | Required by web-push spec  |

Generate with: `npx web-push generate-vapid-keys`

---

## 6. Key Design Decisions

### Channel-Aware Notification Preferences

The existing flat boolean fields in `userPreferences` (e.g. `notificationsBidOutbid: boolean`) only model a single delivery channel. Replace them with a per-event, per-channel structure so future channels (email, WhatsApp, SMS, etc.) can be toggled independently without a schema migration:

```typescript
// New shape in userPreferences (replaces the flat boolean fields)
notificationsOutbid: v.object({
  inApp:     v.boolean(),  // always supported
  push:      v.boolean(),  // Phase 3
  email:     v.boolean(),  // future — default false, hidden in UI until vendor integrated
  whatsapp:  v.boolean(),  // future — default false, hidden in UI until vendor integrated
}),
notificationsAuctionWon: v.object({ inApp: v.boolean(), push: v.boolean(), email: v.boolean(), whatsapp: v.boolean() }),
notificationsWatchlistEnding: v.object({
  inApp:     v.boolean(),
  push:      v.boolean(),
  email:     v.boolean(),
  whatsapp:  v.boolean(),
  window:    v.union(v.literal("disabled"), v.literal("1h"), v.literal("3h"), v.literal("24h")),
}),
notificationsListingApproved: v.object({ inApp: v.boolean(), push: v.boolean(), email: v.boolean(), whatsapp: v.boolean() }),
```

**Rules:**

- All channel fields default to `false` except `inApp` which defaults to `true`.
- The UI only renders toggles for channels that have a vendor integrated. Unimplemented channels remain in the schema silently.
- When a new channel vendor is added, only the UI needs to expose the toggle — no schema change required.

### Multi-Device Push Subscriptions

Unlike pretoria-prepaid (single subscription per user), AgriBid should support multiple devices per user since bidders may monitor auctions from phone + desktop simultaneously. Use a separate `pushSubscriptions` table:

```typescript
pushSubscriptions: defineTable({
  userId: v.string(),
  deviceLabel: v.optional(v.string()),
  endpoint: v.string(),
  expirationTime: v.union(v.number(), v.null()),
  keys: v.object({ p256dh: v.string(), auth: v.string() }),
  createdAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_endpoint", ["endpoint"]);
```

**Auto-registration on login:** A user enables push notifications once (in Settings). On subsequent logins from any new device, the app silently checks whether that device's browser has a registered subscription. If not, and the user's global push preference is enabled, the permission prompt is shown automatically — no repeat trip to Settings required.

### Rate Limiting Strategy

Different notification types need different cooldowns:

| Type             | Cooldown             | Rationale                         |
| ---------------- | -------------------- | --------------------------------- |
| Outbid           | 5 minutes            | Rapid bidding wars shouldn't spam |
| Auction won/lost | None                 | One-time event                    |
| Watchlist ending | Per threshold window | Once per ending window            |
| Listing approved | None                 | One-time event                    |
| KYC update       | None                 | One-time event                    |
| Admin broadcast  | None                 | Admin-controlled frequency        |

### Notification Priority

Push notifications should only fire for high-priority events. In-app notifications cover everything. Suggested push-worthy events:

- Outbid on an auction
- Auction won
- Watchlist auction ending soon
- KYC status change

Lower priority (in-app only by default):

- Auction lost (participated but didn't win)
- Listing approved/rejected
- Admin broadcasts

---

## 7. Testing Strategy

### Unit Tests

- Push subscription utilities (`push-notifications.test.ts`)
- Service worker event handlers (`sw.test.ts`)
- Notification preference enforcement logic
- Rate limiting logic

### Integration Tests

- Notification creation on bid placement (convex-test)
- Settlement notification dispatch (convex-test)
- Watchlist ending cron logic (convex-test)
- Push subscription save/remove mutations

### Manual Testing

- Browser permission flow (grant, deny, revoke)
- Push notification delivery on multiple browsers
- Notification click-through navigation
- Multi-device subscription management
- Offline badge behavior

---

## 8. Implementation Order & Estimates

| Phase       | Description                  | Priority |
| ----------- | ---------------------------- | -------- |
| **Phase 1** | In-app notification triggers | High     |
| **Phase 2** | Notification bell & badge UI | High     |
| **Phase 3** | Web Push notifications       | Medium   |
| **Phase 4** | Notification preferences UI  | Medium   |
| **Phase 5** | PWA enhancements             | Low      |

Phases 1 and 2 can be developed in parallel. Phase 3 depends on Phase 1 triggers being in place. Phase 4 can start alongside Phase 3. Phase 5 is optional polish.
