// AgriBid service worker: web push only (no caching, no offline mode).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A notification must be shown for every push, or iOS revokes the
// subscription, so fall back to a generic one when the payload is unreadable.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  if (!data || typeof data !== "object") data = {};
  const title = data.title || "AgriBid";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin
  );
  // Only ever open our own pages.
  const url = target.origin === self.location.origin ? target.href : "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const client = windows.find(
          (w) => new URL(w.url).origin === self.location.origin
        );
        if (client && "navigate" in client) {
          return client
            .navigate(url)
            .then((c) => (c || client).focus())
            .catch(() => self.clients.openWindow(url));
        }
        return self.clients.openWindow(url);
      })
  );
});
