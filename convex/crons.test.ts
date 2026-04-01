import { describe, it, expect, vi } from "vitest";

vi.mock("convex/server", () => ({
  cronJobs: vi.fn(() => ({
    interval: vi.fn(),
    daily: vi.fn(),
    weekly: vi.fn(),
    monthly: vi.fn(),
  })),
}));

vi.mock("./_generated/api", () => ({
  internal: {
    auctions: {
      settleExpiredAuctions: "settleExpiredAuctions",
      cleanupDrafts: "cleanupDrafts",
    },
    presence: {
      cleanup: "presenceCleanup",
    },
    errors: {
      processErrorReportsAction: "processErrorReportsAction",
    },
    watchlistNotifications: {
      notifyWatchlistEndingSoon: "notifyWatchlistEndingSoon",
      cleanupOldNotificationLogs: "cleanupOldNotificationLogs",
    },
  },
}));

describe("Crons Coverage", () => {
  it("should register all cron jobs", async () => {
    // We need to import crons to trigger the registration
    const cronsModule = await import("./crons");
    const crons = cronsModule.default;

    expect(crons.interval).toHaveBeenCalledWith(
      "settle expired auctions",
      { minutes: 1 },
      "settleExpiredAuctions"
    );

    expect(crons.daily).toHaveBeenCalledWith(
      "cleanup abandoned drafts",
      { hourUTC: 0, minuteUTC: 0 },
      "cleanupDrafts"
    );

    expect(crons.interval).toHaveBeenCalledWith(
      "cleanup presence records",
      { minutes: 15 },
      "presenceCleanup"
    );

    expect(crons.daily).toHaveBeenCalledWith(
      "process error reports",
      { hourUTC: 2, minuteUTC: 0 },
      "processErrorReportsAction"
    );

    expect(crons.interval).toHaveBeenCalledWith(
      "notify watchlist ending soon",
      { minutes: 15 },
      "notifyWatchlistEndingSoon"
    );

    expect(crons.interval).toHaveBeenCalledWith(
      "cleanup notification logs",
      { hours: 24 },
      "cleanupOldNotificationLogs"
    );
  });
});
