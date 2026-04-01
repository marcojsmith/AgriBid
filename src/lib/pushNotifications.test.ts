import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("pushNotifications", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isPushSupported", () => {
    it("returns true when both serviceWorker and PushManager are available", async () => {
      Object.defineProperty(navigator, "serviceWorker", {
        value: { ready: Promise.resolve({}) },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "PushManager", {
        value: class PushManager {},
        writable: true,
        configurable: true,
      });

      const { isPushSupported } = await import("./pushNotifications");
      expect(isPushSupported()).toBe(true);
    });

    it("returns false when serviceWorker is missing", async () => {
      const desc = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
      // @ts-expect-error - test manipulation
      delete navigator.serviceWorker;
      Object.defineProperty(window, "PushManager", {
        value: class PushManager {},
        writable: true,
        configurable: true,
      });

      const { isPushSupported } = await import("./pushNotifications");
      expect(isPushSupported()).toBe(false);

      if (desc) {
        Object.defineProperty(navigator, "serviceWorker", desc);
      }
    });

    it("returns false when PushManager is missing", async () => {
      Object.defineProperty(navigator, "serviceWorker", {
        value: { ready: Promise.resolve({}) },
        writable: true,
        configurable: true,
      });
      const desc = Object.getOwnPropertyDescriptor(window, "PushManager");
      // @ts-expect-error - test manipulation
      delete window.PushManager;

      const { isPushSupported } = await import("./pushNotifications");
      expect(isPushSupported()).toBe(false);

      if (desc) {
        Object.defineProperty(window, "PushManager", desc);
      }
    });
  });

  describe("getNotificationPermission", () => {
    it("returns the current Notification.permission", async () => {
      Object.defineProperty(window, "Notification", {
        value: { permission: "granted" },
        writable: true,
        configurable: true,
      });

      const { getNotificationPermission } = await import("./pushNotifications");
      expect(getNotificationPermission()).toBe("granted");
    });
  });

  describe("subscribeUserToPush", () => {
    it("throws when permission is denied", async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue("denied");
      Object.defineProperty(window, "Notification", {
        value: {
          requestPermission: mockRequestPermission,
          permission: "default",
        },
        writable: true,
        configurable: true,
      });

      const { subscribeUserToPush } = await import("./pushNotifications");
      await expect(subscribeUserToPush()).rejects.toThrow(
        "Notification permission was denied"
      );
    });

    it("reuses existing subscription when one exists", async () => {
      vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "somekey");

      const mockGetSubscription = vi.fn().mockResolvedValue({
        endpoint: "https://existing.com/sub",
        expirationTime: null,
        keys: { p256dh: "xyz", auth: "uvw" },
        toJSON: () => ({
          endpoint: "https://existing.com/sub",
          expirationTime: null,
          keys: { p256dh: "xyz", auth: "uvw" },
        }),
      });
      const mockSubscribe = vi.fn();
      const mockRequestPermission = vi.fn().mockResolvedValue("granted");

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
              subscribe: mockSubscribe,
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(window, "Notification", {
        value: {
          requestPermission: mockRequestPermission,
          permission: "default",
        },
        writable: true,
        configurable: true,
      });

      const { subscribeUserToPush } = await import("./pushNotifications");
      const result = await subscribeUserToPush();

      expect(result.endpoint).toBe("https://existing.com/sub");
      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it("creates new subscription when none exists and VAPID key is set", async () => {
      vi.stubEnv(
        "VITE_VAPID_PUBLIC_KEY",
        "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"
      );

      const mockGetSubscription = vi.fn().mockResolvedValue(null);
      const mockSubscribe = vi.fn().mockResolvedValue({
        endpoint: "https://push.example.com/sub",
        expirationTime: null,
        keys: { p256dh: "abc", auth: "def" },
        toJSON: () => ({
          endpoint: "https://push.example.com/sub",
          expirationTime: null,
          keys: { p256dh: "abc", auth: "def" },
        }),
      });
      const mockRequestPermission = vi.fn().mockResolvedValue("granted");

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
              subscribe: mockSubscribe,
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(window, "Notification", {
        value: {
          requestPermission: mockRequestPermission,
          permission: "default",
        },
        writable: true,
        configurable: true,
      });

      const { subscribeUserToPush } = await import("./pushNotifications");
      const result = await subscribeUserToPush();

      expect(result.endpoint).toBe("https://push.example.com/sub");
      expect(result.keys.p256dh).toBe("abc");
      expect(result.keys.auth).toBe("def");
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });

    it("throws when VITE_VAPID_PUBLIC_KEY is not set and no existing subscription", async () => {
      vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");

      const mockGetSubscription = vi.fn().mockResolvedValue(null);
      const mockSubscribe = vi.fn();
      const mockRequestPermission = vi.fn().mockResolvedValue("granted");

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
              subscribe: mockSubscribe,
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(window, "Notification", {
        value: {
          requestPermission: mockRequestPermission,
          permission: "default",
        },
        writable: true,
        configurable: true,
      });

      const { subscribeUserToPush } = await import("./pushNotifications");
      await expect(subscribeUserToPush()).rejects.toThrow(
        "VITE_VAPID_PUBLIC_KEY is not set"
      );
      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it("throws when subscription is missing p256dh/auth keys", async () => {
      vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "somekey");

      const mockGetSubscription = vi.fn().mockResolvedValue(null);
      const mockSubscribe = vi.fn().mockResolvedValue({
        endpoint: "https://push.example.com/sub",
        expirationTime: null,
        keys: {},
        toJSON: () => ({
          endpoint: "https://push.example.com/sub",
          expirationTime: null,
          keys: {},
        }),
      });
      const mockRequestPermission = vi.fn().mockResolvedValue("granted");

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
              subscribe: mockSubscribe,
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(window, "Notification", {
        value: {
          requestPermission: mockRequestPermission,
          permission: "default",
        },
        writable: true,
        configurable: true,
      });

      const { subscribeUserToPush } = await import("./pushNotifications");
      await expect(subscribeUserToPush()).rejects.toThrow(
        "Push subscription is missing required cryptographic keys"
      );
    });
  });

  describe("unsubscribeUserFromPush", () => {
    it("calls subscription.unsubscribe() and returns its result", async () => {
      const mockUnsubscribe = vi.fn().mockResolvedValue(true);
      const mockGetSubscription = vi.fn().mockResolvedValue({
        unsubscribe: mockUnsubscribe,
      });

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      const { unsubscribeUserFromPush } = await import("./pushNotifications");
      const result = await unsubscribeUserFromPush();

      expect(result).toBe(true);
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it("returns true when no subscription exists", async () => {
      const mockGetSubscription = vi.fn().mockResolvedValue(null);

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      const { unsubscribeUserFromPush } = await import("./pushNotifications");
      const result = await unsubscribeUserFromPush();

      expect(result).toBe(true);
    });
  });

  describe("clearBadge", () => {
    it("does nothing when clearAppBadge is not in navigator", async () => {
      const { clearBadge } = await import("./pushNotifications");
      await expect(clearBadge()).resolves.toBeUndefined();
    });

    it("calls clearAppBadge when available", async () => {
      const mockClearBadge = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clearAppBadge", {
        value: mockClearBadge,
        writable: true,
        configurable: true,
      });

      const { clearBadge } = await import("./pushNotifications");
      await clearBadge();

      expect(mockClearBadge).toHaveBeenCalledTimes(1);
    });

    it("swallows errors from clearAppBadge", async () => {
      const mockClearBadge = vi.fn().mockRejectedValue(new Error("fail"));
      Object.defineProperty(navigator, "clearAppBadge", {
        value: mockClearBadge,
        writable: true,
        configurable: true,
      });

      const { clearBadge } = await import("./pushNotifications");
      await expect(clearBadge()).resolves.toBeUndefined();
    });
  });
});
