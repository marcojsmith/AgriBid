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
    cronJobs: {
      settleExpiredAuctions: "settleExpiredLots",
      cleanupAbandonedDrafts: "cleanupDrafts",
      cleanupPresenceRecords: "presenceCleanup",
      processErrorReports: "processErrorReportsAction",
      weeklyMockDataReset: "weeklyReset",
      sweepOrphanedUploads: "sweepOrphanedUploads",
      purgeLotViewers: "purgeLotViewers",
      refreshEngagementScores: "refreshEngagementScores",
      sendSaleReminders: "sendSaleReminders",
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
      "settleExpiredLots"
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
      "weekly mock data reset",
      { hours: 24 * 7 },
      "weeklyReset"
    );

    expect(crons.interval).toHaveBeenCalledWith(
      "sweep orphaned uploads",
      { hours: 24 },
      "sweepOrphanedUploads"
    );

    expect(crons.interval).toHaveBeenCalledWith(
      "purge lot viewers",
      { hours: 24 },
      "purgeLotViewers"
    );

    expect(crons.interval).toHaveBeenCalledWith(
      "refresh engagement scores",
      { minutes: 5 },
      "refreshEngagementScores"
    );

    expect(crons.interval).toHaveBeenCalledWith(
      "send sale reminders",
      { minutes: 1 },
      "sendSaleReminders",
      {}
    );
  });
});
