import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import {
  trackAction,
  getBreadcrumbs,
  clearBreadcrumbs,
  trackNavigation,
  trackInteraction,
  trackMutation,
} from "./activity-tracker";

describe("Activity Tracker", () => {
  beforeEach(() => {
    clearBreadcrumbs();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should track a simple action", () => {
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    trackAction("custom", "Test action");

    const breadcrumbs = getBreadcrumbs();
    expect(breadcrumbs).toHaveLength(1);
    expect(breadcrumbs[0]).toMatchObject({
      type: "custom",
      description: "Test action",
      timestamp: new Date("2024-01-01T12:00:00Z").getTime(),
    });
  });

  it("should respect the 20 breadcrumb limit", () => {
    for (let i = 0; i < 25; i++) {
      trackAction("custom", `Action ${i}`);
    }

    const breadcrumbs = getBreadcrumbs();
    expect(breadcrumbs).toHaveLength(20);
    expect(breadcrumbs[0].description).toBe("Action 5");
    expect(breadcrumbs[19].description).toBe("Action 24");
  });

  it("should clear breadcrumbs", () => {
    trackAction("custom", "Test action");
    expect(getBreadcrumbs()).toHaveLength(1);

    clearBreadcrumbs();
    expect(getBreadcrumbs()).toHaveLength(0);
  });

  it("should track navigation", () => {
    trackNavigation("/home");
    expect(getBreadcrumbs()[0]).toMatchObject({
      type: "navigation",
      description: "Navigated to /home",
    });
  });

  it("should track interaction", () => {
    trackInteraction("Clicked button", { btnId: "btn-1" });
    expect(getBreadcrumbs()[0]).toMatchObject({
      type: "interaction",
      description: "Clicked button",
      metadata: { btnId: "btn-1" },
    });
  });

  it("should track mutation", () => {
    trackMutation("Updated user", { userId: "user-1" });
    expect(getBreadcrumbs()[0]).toMatchObject({
      type: "mutation",
      description: "Updated user",
      metadata: { userId: "user-1" },
    });
  });
});
