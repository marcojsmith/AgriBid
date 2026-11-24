import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  currentSubscription,
  pushSupported,
  subscribeToPush,
  urlBase64ToUint8Array,
} from "./push";

const keys = { endpoint: "https://push/x", keys: { p256dh: "P", auth: "A" } };
const subscriptionOf = (json: unknown) => ({ toJSON: () => json });

let pushManager: {
  getSubscription: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};
let register: ReturnType<typeof vi.fn>;
let getRegistration: ReturnType<typeof vi.fn>;

beforeEach(() => {
  pushManager = { getSubscription: vi.fn(), subscribe: vi.fn() };
  register = vi.fn().mockResolvedValue(undefined);
  getRegistration = vi.fn().mockResolvedValue({ pushManager });
  vi.stubGlobal("Notification", { permission: "default" });
  vi.stubGlobal("PushManager", function PushManager() {
    return undefined;
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register,
      ready: Promise.resolve({ pushManager }),
      getRegistration,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 with and without padding", () => {
    expect([...urlBase64ToUint8Array("AQID")]).toEqual([1, 2, 3]);
    expect([...urlBase64ToUint8Array("-_8")]).toEqual([251, 255]);
  });
});

describe("pushSupported", () => {
  it("is true when the three APIs exist", () => {
    expect(pushSupported()).toBe(true);
  });

  it("is false without a service worker", () => {
    Reflect.deleteProperty(navigator, "serviceWorker");
    expect(pushSupported()).toBe(false);
  });

  it("is false without PushManager or Notification", () => {
    Reflect.deleteProperty(window, "PushManager");
    expect(pushSupported()).toBe(false);
    vi.stubGlobal("PushManager", function PushManager() {
      return undefined;
    });
    vi.stubGlobal("Notification", undefined);
    expect(pushSupported()).toBe(false);
  });
});

describe("subscribeToPush", () => {
  it("reuses an existing subscription", async () => {
    pushManager.getSubscription.mockResolvedValue(subscriptionOf(keys));
    expect(await subscribeToPush("AQID")).toEqual({
      endpoint: "https://push/x",
      p256dh: "P",
      auth: "A",
    });
    expect(register).toHaveBeenCalledWith("/sw.js");
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("subscribes with the VAPID key when there is none", async () => {
    pushManager.getSubscription.mockResolvedValue(null);
    pushManager.subscribe.mockResolvedValue(subscriptionOf(keys));
    await subscribeToPush("AQID");
    const options = pushManager.subscribe.mock.calls[0]?.[0] as {
      userVisibleOnly: boolean;
      applicationServerKey: Uint8Array;
    };
    expect(options.userVisibleOnly).toBe(true);
    expect([...options.applicationServerKey]).toEqual([1, 2, 3]);
  });

  it("throws when the subscription has no keys", async () => {
    pushManager.getSubscription.mockResolvedValue(
      subscriptionOf({ endpoint: "https://push/x" })
    );
    await expect(subscribeToPush("AQID")).rejects.toThrow("no keys");
  });
});

describe("currentSubscription", () => {
  it("returns the stored shape", async () => {
    pushManager.getSubscription.mockResolvedValue(subscriptionOf(keys));
    expect(await currentSubscription()).toEqual({
      endpoint: "https://push/x",
      p256dh: "P",
      auth: "A",
    });
  });

  it("is null without push support, a registration or a subscription", async () => {
    pushManager.getSubscription.mockResolvedValue(null);
    expect(await currentSubscription()).toBeNull();
    getRegistration.mockResolvedValue(undefined);
    expect(await currentSubscription()).toBeNull();
    Reflect.deleteProperty(navigator, "serviceWorker");
    expect(await currentSubscription()).toBeNull();
  });
});
