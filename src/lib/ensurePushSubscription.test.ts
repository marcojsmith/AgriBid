import { beforeEach, describe, expect, it, vi } from "vitest";

const subscribe = vi.hoisted(() => vi.fn());
vi.mock("@/lib/push", () => ({ subscribeToPush: subscribe }));

import { ensurePushSubscription } from "./ensurePushSubscription";

describe("ensurePushSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes with the key and saves the result", async () => {
    const keys = { endpoint: "https://x", p256dh: "p", auth: "a" };
    subscribe.mockResolvedValue(keys);
    const save = vi.fn().mockResolvedValue(null);
    await ensurePushSubscription("vapid", save);
    expect(subscribe).toHaveBeenCalledWith("vapid");
    expect(save).toHaveBeenCalledWith(keys);
  });

  it("does not save when subscribing fails", async () => {
    subscribe.mockRejectedValue(new Error("no"));
    const save = vi.fn();
    await expect(ensurePushSubscription("vapid", save)).rejects.toThrow("no");
    expect(save).not.toHaveBeenCalled();
  });
});
