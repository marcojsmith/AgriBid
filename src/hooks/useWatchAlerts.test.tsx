import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WATCHING_MESSAGE, WATCHING_SAVED_MESSAGE } from "@/lib/auctionRules";

interface HookMocks {
  authed: boolean;
  settings: { watchAlertsEnabled: boolean } | undefined;
  vapid: string | null | undefined;
  hasSubscription: boolean;
  prefs: Record<string, unknown> | null;
  supported: boolean;
  needsInstall: boolean;
  permission: string;
  requestResult: "granted" | "denied" | "unsupported";
  ensure: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  showToast: ReturnType<typeof vi.fn>;
  toastError: ReturnType<typeof vi.fn>;
}

const m = vi.hoisted((): HookMocks => ({
  authed: true,
  settings: { watchAlertsEnabled: true },
  vapid: "vapid-key",
  hasSubscription: false,
  prefs: null,
  supported: true,
  needsInstall: false,
  permission: "default",
  requestResult: "granted",
  ensure: vi.fn(),
  save: vi.fn(),
  showToast: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: m.authed }),
  useQuery: (ref: { name: string }, args: unknown) => {
    if (args === "skip") return undefined;
    if (ref.name === "getPlatformSettings") return m.settings;
    if (ref.name === "hasMySubscription") return m.hasSubscription;
    if (ref.name === "getMyPreferences") return m.prefs;
    return m.vapid;
  },
  useMutation: () => m.save,
}));
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      platformSettings: {
        getPlatformSettings: { name: "getPlatformSettings" },
      },
    },
    userPreferences: { getMyPreferences: { name: "getMyPreferences" } },
    push: {
      getVapidPublicKey: { name: "getVapidPublicKey" },
      hasMySubscription: { name: "hasMySubscription" },
      saveSubscription: { name: "saveSubscription" },
    },
  },
}));
vi.mock("@/lib/homeScreen", () => ({
  browserNeedsHomeScreenInstall: () => m.needsInstall,
}));
vi.mock("@/lib/push", () => ({ pushSupported: () => m.supported }));
vi.mock("@/lib/ensurePushSubscription", () => ({
  ensurePushSubscription: m.ensure,
}));
vi.mock("@/lib/reminders", () => ({
  requestReminderPermission: () => Promise.resolve(m.requestResult),
}));
vi.mock("@/components/ds/showToast", () => ({ showToast: m.showToast }));
vi.mock("sonner", () => ({ toast: { error: m.toastError } }));

import { useWatchAlerts } from "./useWatchAlerts";

describe("useWatchAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.authed = true;
    m.settings = { watchAlertsEnabled: true };
    m.vapid = "vapid-key";
    m.hasSubscription = false;
    m.prefs = null;
    localStorage.clear();
    m.supported = true;
    m.needsInstall = false;
    m.permission = "default";
    m.requestResult = "granted";
    m.ensure.mockResolvedValue(undefined);
    vi.stubGlobal("Notification", {
      get permission() {
        return m.permission;
      },
    });
  });

  it("gives the saved copy while the admin setting is off or still loading", async () => {
    m.settings = { watchAlertsEnabled: false };
    const off = renderHook(() => useWatchAlerts());
    expect(await off.result.current.afterWatch()).toBe(WATCHING_SAVED_MESSAGE);
    m.settings = undefined;
    const loading = renderHook(() => useWatchAlerts());
    expect(await loading.result.current.afterWatch()).toBe(
      WATCHING_SAVED_MESSAGE
    );
    expect(off.result.current.promptProps.open).toBe(false);
  });

  it("promises alerts when this user already has a subscription", async () => {
    m.hasSubscription = true;
    const { result } = renderHook(() => useWatchAlerts());
    expect(await result.current.afterWatch()).toBe(WATCHING_MESSAGE);
    expect(m.ensure).not.toHaveBeenCalled();
  });

  it("stays quiet where push is unsupported, iOS needs the install, or no key", async () => {
    m.supported = false;
    const a = renderHook(() => useWatchAlerts());
    expect(await a.result.current.afterWatch()).toBe(WATCHING_SAVED_MESSAGE);
    m.supported = true;
    m.needsInstall = true;
    const b = renderHook(() => useWatchAlerts());
    expect(await b.result.current.afterWatch()).toBe(WATCHING_SAVED_MESSAGE);
    m.needsInstall = false;
    m.vapid = null;
    const c = renderHook(() => useWatchAlerts());
    expect(await c.result.current.afterWatch()).toBe(WATCHING_SAVED_MESSAGE);
    expect(a.result.current.promptProps.open).toBe(false);
    expect(b.result.current.promptProps.open).toBe(false);
    expect(c.result.current.promptProps.open).toBe(false);
  });

  it("silently saves the subscription when permission is already granted", async () => {
    m.permission = "granted";
    const { result } = renderHook(() => useWatchAlerts());
    expect(await result.current.afterWatch()).toBe(WATCHING_MESSAGE);
    expect(m.ensure).toHaveBeenCalledWith("vapid-key", m.save);
    expect(result.current.promptProps.open).toBe(false);
  });

  it("falls back to the saved copy when saving the subscription fails", async () => {
    m.permission = "granted";
    m.ensure.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useWatchAlerts());
    expect(await result.current.afterWatch()).toBe(WATCHING_SAVED_MESSAGE);
  });

  it("does nothing more when permission was denied", async () => {
    m.permission = "denied";
    const { result } = renderHook(() => useWatchAlerts());
    expect(await result.current.afterWatch()).toBe(WATCHING_SAVED_MESSAGE);
    expect(result.current.promptProps.open).toBe(false);
  });

  it("opens the prompt when permission is still default", async () => {
    const { result } = renderHook(() => useWatchAlerts());
    let message = "";
    await act(async () => {
      message = await result.current.afterWatch();
    });
    expect(message).toBe(WATCHING_SAVED_MESSAGE);
    expect(result.current.promptProps).toMatchObject({
      open: true,
      description: "Get an alert 1 hour before close and if you're outbid?",
      allowLabel: "Allow alerts",
    });
    act(() => {
      result.current.promptProps.onOpenChange(false);
    });
    expect(result.current.promptProps.open).toBe(false);
  });

  it("remembers Not now for 30 days and then asks again", async () => {
    const first = renderHook(() => useWatchAlerts());
    await act(async () => {
      await first.result.current.afterWatch();
    });
    expect(first.result.current.promptProps.open).toBe(true);
    act(() => {
      first.result.current.promptProps.onOpenChange(false);
    });
    expect(
      localStorage.getItem("agribid.watchAlertsPromptDismissedAt")
    ).not.toBe(null);

    const again = renderHook(() => useWatchAlerts());
    await act(async () => {
      expect(await again.result.current.afterWatch()).toBe(
        WATCHING_SAVED_MESSAGE
      );
    });
    expect(again.result.current.promptProps.open).toBe(false);

    localStorage.setItem(
      "agribid.watchAlertsPromptDismissedAt",
      String(Date.now() - 31 * 24 * 3_600_000)
    );
    const later = renderHook(() => useWatchAlerts());
    await act(async () => {
      await later.result.current.afterWatch();
    });
    expect(later.result.current.promptProps.open).toBe(true);
  });

  it("still asks when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useWatchAlerts());
    await act(async () => {
      await result.current.afterWatch();
    });
    expect(result.current.promptProps.open).toBe(true);
    act(() => {
      result.current.promptProps.onOpenChange(false);
    });
    expect(result.current.promptProps.open).toBe(false);
    vi.restoreAllMocks();
  });

  it("keeps the saved copy when the user switched both alerts off", async () => {
    m.hasSubscription = true;
    m.prefs = {
      notificationsBidOutbid: false,
      notificationsWatchlistEnding: "disabled",
    };
    const off = renderHook(() => useWatchAlerts());
    expect(await off.result.current.afterWatch()).toBe(WATCHING_SAVED_MESSAGE);

    // Either one still on keeps the promise.
    m.prefs = {
      notificationsBidOutbid: false,
      notificationsWatchlistEnding: "1h",
    };
    const closing = renderHook(() => useWatchAlerts());
    expect(await closing.result.current.afterWatch()).toBe(WATCHING_MESSAGE);
    m.prefs = {
      notificationsBidOutbid: true,
      notificationsWatchlistEnding: "24h",
    };
    const outbid = renderHook(() => useWatchAlerts());
    expect(await outbid.result.current.afterWatch()).toBe(WATCHING_MESSAGE);
  });

  it("keeps the saved copy when the Watched lots switch is off", async () => {
    m.hasSubscription = true;
    m.prefs = { notificationsWatchedLots: false };
    const { result } = renderHook(() => useWatchAlerts());
    expect(await result.current.afterWatch()).toBe(WATCHING_SAVED_MESSAGE);
  });

  it("does not promise after Allow when both alerts are off", async () => {
    m.prefs = {
      notificationsBidOutbid: false,
      notificationsWatchlistEnding: "disabled",
    };
    const { result } = renderHook(() => useWatchAlerts());
    act(() => {
      result.current.promptProps.onAllow();
    });
    await waitFor(() => {
      expect(m.showToast).toHaveBeenCalledWith(WATCHING_SAVED_MESSAGE);
    });
  });

  it("subscribes and confirms after Allow", async () => {
    const { result } = renderHook(() => useWatchAlerts());
    await act(async () => {
      await result.current.afterWatch();
    });
    act(() => {
      result.current.promptProps.onAllow();
    });
    await waitFor(() => {
      expect(m.showToast).toHaveBeenCalledWith(WATCHING_MESSAGE);
    });
    expect(result.current.promptProps.open).toBe(false);
    expect(m.ensure).toHaveBeenCalledWith("vapid-key", m.save);
  });

  it("stays on the saved copy when the browser permission is denied", async () => {
    m.requestResult = "denied";
    const { result } = renderHook(() => useWatchAlerts());
    act(() => {
      result.current.promptProps.onAllow();
    });
    await waitFor(() => {
      expect(m.ensure).not.toHaveBeenCalled();
    });
    expect(m.showToast).not.toHaveBeenCalled();
    expect(m.toastError).not.toHaveBeenCalled();
  });

  it("tells the user when subscribing fails after Allow", async () => {
    m.ensure.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useWatchAlerts());
    act(() => {
      result.current.promptProps.onAllow();
    });
    await waitFor(() => {
      expect(m.toastError).toHaveBeenCalledWith(
        "Couldn't turn on alerts. Try again."
      );
    });
  });

  it("fails Allow when the server key is not available", async () => {
    m.vapid = undefined;
    const { result } = renderHook(() => useWatchAlerts());
    act(() => {
      result.current.promptProps.onAllow();
    });
    await waitFor(() => {
      expect(m.toastError).toHaveBeenCalled();
    });
    expect(m.ensure).not.toHaveBeenCalled();
  });

  it("skips the subscription query when signed out", async () => {
    m.authed = false;
    m.hasSubscription = true;
    const { result } = renderHook(() => useWatchAlerts());
    // Signed out the query is skipped (reads as no subscription), so the
    // permission flow runs instead of promising alerts.
    await act(async () => {
      expect(await result.current.afterWatch()).toBe(WATCHING_SAVED_MESSAGE);
    });
  });
});
