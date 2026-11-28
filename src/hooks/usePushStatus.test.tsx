import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Mocks {
  authed: boolean;
  vapid: string | null | undefined;
  hasServer: boolean | undefined;
  needsInstall: boolean;
  supported: boolean;
  permission: string;
  requestResult: "granted" | "denied" | "unsupported";
  save: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  current: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
}

const m = vi.hoisted((): Mocks => ({
  authed: true,
  vapid: "vapid-key",
  hasServer: true,
  needsInstall: false,
  supported: true,
  permission: "granted",
  requestResult: "granted",
  save: vi.fn(),
  remove: vi.fn(),
  subscribe: vi.fn(),
  current: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: m.authed }),
  useQuery: (ref: { name: string }, args: unknown) => {
    if (args === "skip") return undefined;
    return ref.name === "hasMySubscription" ? m.hasServer : m.vapid;
  },
  useMutation: (ref: { name: string }) =>
    ref.name === "saveSubscription" ? m.save : m.remove,
}));
vi.mock("convex/_generated/api", () => ({
  api: {
    push: {
      getVapidPublicKey: { name: "getVapidPublicKey" },
      hasMySubscription: { name: "hasMySubscription" },
      saveSubscription: { name: "saveSubscription" },
      removeSubscription: { name: "removeSubscription" },
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
  unsubscribeFromPush: m.unsubscribe,
}));
vi.mock("@/lib/reminders", () => ({
  requestReminderPermission: () => Promise.resolve(m.requestResult),
}));

import { usePushStatus } from "./usePushStatus";

const sub = { endpoint: "https://push/x", p256dh: "P", auth: "A" };

beforeEach(() => {
  vi.clearAllMocks();
  m.authed = true;
  m.vapid = "vapid-key";
  m.hasServer = true;
  m.needsInstall = false;
  m.supported = true;
  m.permission = "granted";
  m.requestResult = "granted";
  m.current.mockResolvedValue(sub);
  m.subscribe.mockResolvedValue(sub);
  m.save.mockResolvedValue(null);
  m.remove.mockResolvedValue(null);
  m.unsubscribe.mockResolvedValue(sub.endpoint);
  vi.stubGlobal("Notification", {
    get permission() {
      return m.permission;
    },
  });
});

describe("usePushStatus state", () => {
  it("is on with permission, a browser subscription and a saved one", async () => {
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("on");
    });
  });

  it("is loading until the browser subscription is read", () => {
    m.current.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => usePushStatus());
    expect(result.current.state).toBe("loading");
  });

  it("is loading while the server answers have not arrived", () => {
    m.hasServer = undefined;
    const { result } = renderHook(() => usePushStatus());
    expect(result.current.state).toBe("loading");
  });

  it("is off when permission is not granted yet or nothing is subscribed", async () => {
    m.permission = "default";
    m.current.mockResolvedValue(null);
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("off");
    });
  });

  it("is off when the server lost the subscription", async () => {
    m.hasServer = false;
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("off");
    });
  });

  it("is blocked when permission was denied", async () => {
    m.permission = "denied";
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("blocked");
    });
  });

  it("is install on an iPhone Safari tab", async () => {
    m.needsInstall = true;
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("install");
    });
  });

  it("is unsupported without push or without a server key", async () => {
    m.supported = false;
    const first = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(first.result.current.state).toBe("unsupported");
    });
    m.supported = true;
    m.vapid = null;
    const second = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(second.result.current.state).toBe("unsupported");
    });
  });

  it("re-reads the permission when the window regains focus", async () => {
    m.permission = "denied";
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("blocked");
    });
    m.permission = "granted";
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => {
      expect(result.current.state).toBe("on");
    });
  });
});

describe("turnOn", () => {
  beforeEach(() => {
    m.permission = "default";
    m.current.mockResolvedValue(null);
  });

  it("asks, subscribes and saves", async () => {
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("off");
    });
    m.permission = "granted";
    let outcome = "";
    await act(async () => {
      outcome = await result.current.turnOn();
    });
    expect(outcome).toBe("on");
    expect(m.subscribe).toHaveBeenCalledWith("vapid-key");
    expect(m.save).toHaveBeenCalledWith(sub);
    expect(result.current.state).toBe("on");
  });

  it("reports blocked when the visitor says no", async () => {
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("off");
    });
    m.requestResult = "denied";
    m.permission = "denied";
    let outcome = "";
    await act(async () => {
      outcome = await result.current.turnOn();
    });
    expect(outcome).toBe("blocked");
    expect(result.current.state).toBe("blocked");
    expect(m.save).not.toHaveBeenCalled();
  });

  it("reports install, unsupported and failed", async () => {
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("off");
    });
    m.needsInstall = true;
    let outcome = "";
    await act(async () => {
      outcome = await result.current.turnOn();
    });
    expect(outcome).toBe("install");
    m.needsInstall = false;
    m.requestResult = "unsupported";
    await act(async () => {
      outcome = await result.current.turnOn();
    });
    expect(outcome).toBe("unsupported");
    m.requestResult = "granted";
    m.subscribe.mockRejectedValue(new Error("no"));
    await act(async () => {
      outcome = await result.current.turnOn();
    });
    expect(outcome).toBe("failed");
    expect(result.current.busy).toBe(false);
  });

  it("reports failed while the server key is still loading", async () => {
    m.vapid = undefined;
    const { result } = renderHook(() => usePushStatus());
    let outcome = "";
    await act(async () => {
      outcome = await result.current.turnOn();
    });
    expect(outcome).toBe("failed");
  });
});

describe("turnOff", () => {
  it("drops the browser subscription and the saved one", async () => {
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("on");
    });
    await act(async () => {
      await result.current.turnOff();
    });
    expect(m.unsubscribe).toHaveBeenCalledOnce();
    expect(m.remove).toHaveBeenCalledWith({ endpoint: sub.endpoint });
    expect(result.current.state).toBe("off");
  });

  it("still ends off when there was no browser subscription", async () => {
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("on");
    });
    m.unsubscribe.mockResolvedValue(null);
    await act(async () => {
      await result.current.turnOff();
    });
    expect(m.remove).not.toHaveBeenCalled();
    expect(result.current.state).toBe("off");
  });
});

describe("usePushStatus freshness", () => {
  it("re-saves this phone's subscription when permission is granted", async () => {
    renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(m.save).toHaveBeenCalledWith(sub);
    });
  });

  it("does not re-save without permission", async () => {
    m.permission = "default";
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("off");
    });
    expect(m.save).not.toHaveBeenCalled();
  });

  it("ends off even when the server removal fails", async () => {
    m.remove.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => usePushStatus());
    await waitFor(() => {
      expect(result.current.state).toBe("on");
    });
    await act(async () => {
      await expect(result.current.turnOff()).rejects.toThrow("down");
    });
    expect(result.current.state).toBe("off");
    expect(result.current.busy).toBe(false);
  });
});
