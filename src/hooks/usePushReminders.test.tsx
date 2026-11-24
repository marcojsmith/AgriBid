import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "convex/_generated/dataModel";

interface HookMocks {
  authed: boolean;
  reminded: boolean;
  vapid: string | null | undefined;
  needsInstall: boolean;
  supported: boolean;
  permission: string;
  requestResult: "granted" | "denied" | "unsupported";
  save: ReturnType<typeof vi.fn>;
  setReminder: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  current: ReturnType<typeof vi.fn>;
}

const m = vi.hoisted((): HookMocks => ({
  authed: true,
  reminded: false,
  vapid: "vapid-key",
  needsInstall: false,
  supported: true,
  permission: "default",
  requestResult: "granted",
  save: vi.fn(),
  setReminder: vi.fn(),
  subscribe: vi.fn(),
  current: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: m.authed }),
  useQuery: (ref: { name: string }, args: unknown) => {
    if (args === "skip") return undefined;
    return ref.name === "getMySaleReminder" ? m.reminded : m.vapid;
  },
  useMutation: (ref: { name: string }) =>
    ref.name === "saveSubscription" ? m.save : m.setReminder,
}));
vi.mock("convex/_generated/api", () => ({
  api: {
    push: {
      getMySaleReminder: { name: "getMySaleReminder" },
      getVapidPublicKey: { name: "getVapidPublicKey" },
      saveSubscription: { name: "saveSubscription" },
      setSaleReminder: { name: "setSaleReminder" },
    },
  },
}));
vi.mock("@/lib/homeScreen", () => ({
  browserNeedsHomeScreenInstall: () => m.needsInstall,
}));
vi.mock("@/lib/push", () => ({
  pushSupported: () => m.supported,
  subscribeToPush: m.subscribe,
  currentSubscription: m.current,
}));
vi.mock("@/lib/reminders", () => ({
  requestReminderPermission: () => Promise.resolve(m.requestResult),
}));

import { usePushReminders } from "./usePushReminders";

const SALE = "a1" as Id<"auctions">;
const sub = { endpoint: "https://push/x", p256dh: "P", auth: "A" };

beforeEach(() => {
  vi.clearAllMocks();
  m.authed = true;
  m.reminded = false;
  m.vapid = "vapid-key";
  m.needsInstall = false;
  m.supported = true;
  m.permission = "default";
  m.requestResult = "granted";
  m.save.mockResolvedValue(null);
  m.setReminder.mockResolvedValue(null);
  m.subscribe.mockResolvedValue(sub);
  m.current.mockResolvedValue(null);
  vi.stubGlobal("Notification", {
    get permission() {
      return m.permission;
    },
  });
});

describe("nextStep", () => {
  const step = () =>
    renderHook(() => usePushReminders(SALE)).result.current.nextStep();

  it("removes first when already reminded", () => {
    m.reminded = true;
    m.needsInstall = true;
    expect(step()).toBe("remove");
  });

  it("asks iPhone Safari visitors to install before anything else", () => {
    m.needsInstall = true;
    m.authed = false;
    expect(step()).toBe("home-screen");
  });

  it("asks guests to sign in", () => {
    m.authed = false;
    expect(step()).toBe("sign-in");
  });

  it("reports unsupported browsers", () => {
    m.supported = false;
    expect(step()).toBe("unsupported");
  });

  it("skips the prompt once permission is granted", () => {
    m.permission = "granted";
    expect(step()).toBe("subscribe");
  });

  it("otherwise asks for permission", () => {
    expect(step()).toBe("permission");
    m.permission = "denied";
    expect(step()).toBe("permission");
  });
});

describe("enable", () => {
  const enable = () =>
    renderHook(() => usePushReminders(SALE)).result.current.enable();

  it("subscribes, saves the subscription and the reminder", async () => {
    expect(await enable()).toBe("granted");
    expect(m.subscribe).toHaveBeenCalledWith("vapid-key");
    expect(m.save).toHaveBeenCalledWith(sub);
    expect(m.setReminder).toHaveBeenCalledWith({ auctionId: SALE, on: true });
  });

  it("returns the permission outcome without subscribing", async () => {
    m.requestResult = "denied";
    expect(await enable()).toBe("denied");
    m.requestResult = "unsupported";
    expect(await enable()).toBe("unsupported");
    expect(m.subscribe).not.toHaveBeenCalled();
  });

  it("is unsupported without a VAPID key", async () => {
    m.vapid = null;
    expect(await enable()).toBe("unsupported");
    expect(m.subscribe).not.toHaveBeenCalled();
  });

  it("fails (not unsupported) while the VAPID key is still loading", async () => {
    m.vapid = undefined;
    expect(await enable()).toBe("failed");
    expect(m.subscribe).not.toHaveBeenCalled();
  });

  it("fails when subscribing or saving throws", async () => {
    m.subscribe.mockRejectedValueOnce(new Error("push service down"));
    expect(await enable()).toBe("failed");
    m.setReminder.mockRejectedValueOnce(new Error("refused"));
    expect(await enable()).toBe("failed");
  });
});

describe("availability", () => {
  const availability = () =>
    renderHook(() => usePushReminders(SALE)).result.current.availability;

  it("follows the VAPID key query", () => {
    expect(availability()).toBe("ready");
    m.vapid = null;
    expect(availability()).toBe("unavailable");
    m.vapid = undefined;
    expect(availability()).toBe("loading");
  });
});

describe("without a sale", () => {
  it("cannot enable or disable", async () => {
    const { result } = renderHook(() => usePushReminders(undefined));
    expect(await result.current.enable()).toBe("failed");
    await result.current.disable();
    expect(m.setReminder).not.toHaveBeenCalled();
  });
});

describe("disable", () => {
  it("removes the reminder", async () => {
    const { result } = renderHook(() => usePushReminders(SALE));
    await result.current.disable();
    expect(m.setReminder).toHaveBeenCalledWith({ auctionId: SALE, on: false });
  });
});

describe("subscription refresh on mount", () => {
  it("re-saves the current subscription when signed in and allowed", async () => {
    m.permission = "granted";
    m.current.mockResolvedValue(sub);
    renderHook(() => usePushReminders(SALE));
    await waitFor(() => {
      expect(m.save).toHaveBeenCalledWith(sub);
    });
  });

  it("does nothing without a subscription, or when a save fails", async () => {
    m.permission = "granted";
    renderHook(() => usePushReminders(SALE));
    await waitFor(() => {
      expect(m.current).toHaveBeenCalled();
    });
    expect(m.save).not.toHaveBeenCalled();

    m.current.mockResolvedValue(sub);
    m.save.mockRejectedValue(new Error("offline"));
    renderHook(() => usePushReminders(SALE));
    await waitFor(() => {
      expect(m.save).toHaveBeenCalled();
    });
  });

  it("skips signed-out visitors, unsupported browsers and ungranted permission", () => {
    m.authed = false;
    m.permission = "granted";
    renderHook(() => usePushReminders(SALE));
    m.authed = true;
    m.supported = false;
    renderHook(() => usePushReminders(SALE));
    m.supported = true;
    m.permission = "default";
    renderHook(() => usePushReminders(SALE));
    expect(m.current).not.toHaveBeenCalled();
  });
});
