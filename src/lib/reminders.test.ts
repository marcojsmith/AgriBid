import { afterEach, describe, expect, it, vi } from "vitest";

import { requestReminderPermission } from "./reminders";

function stubNotification(
  permission: NotificationPermission,
  answer: NotificationPermission = "granted"
) {
  const requestPermission = vi.fn().mockResolvedValue(answer);
  vi.stubGlobal("Notification", { permission, requestPermission });
  return requestPermission;
}

describe("requestReminderPermission", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is unsupported without the Notification API", async () => {
    vi.stubGlobal("Notification", undefined);
    expect(await requestReminderPermission()).toBe("unsupported");
  });

  it("does not ask again when already decided", async () => {
    const ask = stubNotification("granted");
    expect(await requestReminderPermission()).toBe("granted");
    stubNotification("denied");
    expect(await requestReminderPermission()).toBe("denied");
    expect(ask).not.toHaveBeenCalled();
  });

  it("asks the browser and maps the answer", async () => {
    stubNotification("default", "granted");
    expect(await requestReminderPermission()).toBe("granted");
    stubNotification("default", "denied");
    expect(await requestReminderPermission()).toBe("denied");
    stubNotification("default", "default");
    expect(await requestReminderPermission()).toBe("denied");
  });
});
