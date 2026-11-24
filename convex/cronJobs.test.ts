/// <reference types="vite/client" />
import { describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import { CRON_JOBS, cronSettingKey } from "./cronRegistry";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const ADMIN = "user_admin";
const BUYER = "user_buyer";

/**
 * Builds a convex-test backend with an admin and a buyer profile.
 *
 * @returns The seeded test context
 */
async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [userId, role] of [
      [ADMIN, "admin"],
      [BUYER, "buyer"],
    ] as const) {
      await ctx.db.insert("profiles", {
        userId,
        name: userId,
        role,
        isVerified: true,
        kycStatus: "verified",
        createdAt: now,
        updatedAt: now,
      });
    }
  });
  return t;
}

describe("cronJobs", () => {
  it("lists every job at its registry default for admins", async () => {
    const t = await setup();
    const jobs = await t
      .withIdentity({ subject: ADMIN })
      .query(api.cronJobs.getCronJobs, {});
    expect(jobs).toHaveLength(CRON_JOBS.length);
    for (const job of CRON_JOBS) {
      expect(jobs.find((j) => j.key === job.key)?.enabled).toBe(
        job.defaultEnabled
      );
    }
  });

  it("enables only the lightweight engagement jobs by default", () => {
    expect(
      CRON_JOBS.filter((job) => job.defaultEnabled).map((job) => job.key)
    ).toEqual([
      "expire_consideration_lots",
      "purge_lot_viewers",
      "refresh_engagement_scores",
      "send_sale_reminders",
    ]);
  });

  it("rejects non-admins", async () => {
    const t = await setup();
    await expect(
      t.withIdentity({ subject: BUYER }).query(api.cronJobs.getCronJobs, {})
    ).rejects.toThrow();
    await expect(
      t
        .withIdentity({ subject: BUYER })
        .mutation(api.cronJobs.setCronJobEnabled, {
          key: "settle_expired_auctions",
          enabled: true,
        })
    ).rejects.toThrow();
  });

  it("toggles a job on and off", async () => {
    const t = await setup();
    const asAdmin = t.withIdentity({ subject: ADMIN });
    const key = "settle_expired_auctions";

    await asAdmin.mutation(api.cronJobs.setCronJobEnabled, {
      key,
      enabled: true,
    });
    let jobs = await asAdmin.query(api.cronJobs.getCronJobs, {});
    expect(jobs.find((j) => j.key === key)?.enabled).toBe(true);

    await asAdmin.mutation(api.cronJobs.setCronJobEnabled, {
      key,
      enabled: false,
    });
    jobs = await asAdmin.query(api.cronJobs.getCronJobs, {});
    expect(jobs.find((j) => j.key === key)?.enabled).toBe(false);

    const rows = await t.run((ctx) =>
      ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", cronSettingKey(key)))
        .collect()
    );
    expect(rows).toHaveLength(1);
  });

  it("rejects unknown job keys", async () => {
    const t = await setup();
    await expect(
      t
        .withIdentity({ subject: ADMIN })
        .mutation(api.cronJobs.setCronJobEnabled, {
          key: "nope",
          enabled: true,
        })
    ).rejects.toThrow("Unknown background job");
  });

  it("setAllCronJobsEnabled writes every job and is idempotent", async () => {
    const t = await setup();
    expect(
      await t.mutation(internal.cronJobs.setAllCronJobsEnabled, {
        enabled: true,
      })
    ).toBe(CRON_JOBS.length);
    await t.mutation(internal.cronJobs.setAllCronJobsEnabled, {
      enabled: false,
    });
    const rows = await t.run((ctx) => ctx.db.query("settings").collect());
    expect(rows).toHaveLength(CRON_JOBS.length);
    expect(rows.every((r) => r.value === false)).toBe(true);
  });

  it("isJobEnabled returns false for unknown keys and tracks settings", async () => {
    const t = await setup();
    expect(await t.query(internal.cronJobs.isJobEnabled, { key: "nope" })).toBe(
      false
    );
    await t.mutation(internal.cronJobs.setAllCronJobsEnabled, {
      enabled: true,
    });
    expect(
      await t.query(internal.cronJobs.isJobEnabled, {
        key: "process_error_reports",
      })
    ).toBe(true);
  });

  it("gated wrappers no-op while disabled", async () => {
    const t = await setup();
    await t.mutation(internal.cronJobs.setAllCronJobsEnabled, {
      enabled: false,
    });
    expect(
      await t.mutation(internal.cronJobs.settleExpiredAuctions, {})
    ).toEqual({ settled: 0, hasMore: false });
    expect(
      await t.mutation(internal.cronJobs.cleanupAbandonedDrafts, {})
    ).toEqual({ deleted: 0, errors: 0 });
    expect(await t.action(internal.cronJobs.sweepOrphanedUploads, {})).toEqual({
      scanned: 0,
      deleted: 0,
    });
    expect(
      await t.mutation(internal.cronJobs.cleanupPresenceRecords, {})
    ).toBeNull();
    expect(
      await t.mutation(internal.cronJobs.weeklyMockDataReset, {})
    ).toBeNull();
    expect(
      await t.action(internal.cronJobs.processErrorReports, {})
    ).toBeNull();
    expect(await t.mutation(internal.cronJobs.purgeLotViewers, {})).toEqual({
      deleted: 0,
      hasMore: false,
    });
    expect(
      await t.mutation(internal.cronJobs.refreshEngagementScores, {})
    ).toEqual({ auctions: 0, upserted: 0, removed: 0 });
  });

  it("refreshEngagementScores runs by default and can be switched off", async () => {
    const t = await setup();
    await t.run(async (ctx) => {
      const now = Date.now();
      const auctionId = await ctx.db.insert("auctions", {
        title: "Sale",
        startTime: now - 60_000,
        endTime: now + 60 * 60_000,
        status: "published",
        createdBy: "admin",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("lots", {
        title: "L",
        make: "m",
        model: "m",
        year: 2020,
        operatingHours: 1,
        location: "x",
        reservePrice: 1,
        startingPrice: 1,
        currentPrice: 1,
        minIncrement: 1,
        sellerId: "s",
        status: "assigned",
        auctionId,
        lotNumber: 1,
        images: [],
      });
    });
    const rows = () =>
      t.run(
        async (ctx) => (await ctx.db.query("engagementScores").collect()).length
      );

    // Default enabled: no setting row stored yet.
    expect(
      await t.mutation(internal.cronJobs.refreshEngagementScores, {})
    ).toEqual({ auctions: 1, upserted: 1, removed: 0 });
    expect(await rows()).toBe(1);

    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.cronJobs.setCronJobEnabled, {
        key: "refresh_engagement_scores",
        enabled: false,
      });
    expect(
      await t.mutation(internal.cronJobs.refreshEngagementScores, {})
    ).toEqual({ auctions: 0, upserted: 0, removed: 0 });
  });

  it("purgeLotViewers wrapper purges stale rows by default and not once disabled", async () => {
    const t = await setup();
    await t.run(async (ctx) => {
      const id = await ctx.db.insert("lots", {
        title: "L",
        make: "m",
        model: "m",
        year: 2020,
        operatingHours: 1,
        location: "x",
        reservePrice: 1,
        startingPrice: 1,
        currentPrice: 1,
        minIncrement: 1,
        sellerId: "s",
        status: "assigned",
        images: [],
      });
      await ctx.db.insert("lotViewers", {
        lotId: id,
        viewerKey: "k",
        lastViewedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      });
    });
    const count = () =>
      t.run(async (ctx) => (await ctx.db.query("lotViewers").collect()).length);

    // Explicitly disabled: nothing is purged.
    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.cronJobs.setCronJobEnabled, {
        key: "purge_lot_viewers",
        enabled: false,
      });
    await t.mutation(internal.cronJobs.purgeLotViewers, {});
    expect(await count()).toBe(1);

    // Re-enabled: purges.
    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.cronJobs.setCronJobEnabled, {
        key: "purge_lot_viewers",
        enabled: true,
      });
    expect(await t.mutation(internal.cronJobs.purgeLotViewers, {})).toEqual({
      deleted: 1,
      hasMore: false,
    });
    expect(await count()).toBe(0);
  });

  it("purgeLotViewers runs with no stored setting (default on)", async () => {
    const t = await setup();
    await t.run(async (ctx) => {
      const id = await ctx.db.insert("lots", {
        title: "L",
        make: "m",
        model: "m",
        year: 2020,
        operatingHours: 1,
        location: "x",
        reservePrice: 1,
        startingPrice: 1,
        currentPrice: 1,
        minIncrement: 1,
        sellerId: "s",
        status: "assigned",
        images: [],
      });
      await ctx.db.insert("lotViewers", {
        lotId: id,
        viewerKey: "k",
        lastViewedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      });
    });
    expect(await t.mutation(internal.cronJobs.purgeLotViewers, {})).toEqual({
      deleted: 1,
      hasMore: false,
    });
    expect(await t.run((ctx) => ctx.db.query("settings").collect())).toEqual(
      []
    );
  });

  it("purgeLotViewers reschedules itself while a backlog remains", async () => {
    const t = await setup();
    await t.mutation(internal.cronJobs.setAllCronJobsEnabled, {
      enabled: true,
    });
    await t.run(async (ctx) => {
      const id = await ctx.db.insert("lots", {
        title: "L",
        make: "m",
        model: "m",
        year: 2020,
        operatingHours: 1,
        location: "x",
        reservePrice: 1,
        startingPrice: 1,
        currentPrice: 1,
        minIncrement: 1,
        sellerId: "s",
        status: "assigned",
        images: [],
      });
      const old = Date.now() - 2 * 24 * 60 * 60 * 1000;
      for (let i = 0; i < 501; i++) {
        await ctx.db.insert("lotViewers", {
          lotId: id,
          viewerKey: `s:k${String(i)}`,
          lastViewedAt: old,
        });
      }
    });

    expect(await t.mutation(internal.cronJobs.purgeLotViewers, {})).toEqual({
      deleted: 500,
      hasMore: true,
    });
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(scheduled.map((job) => job.name)).toEqual([
      "cronJobs:purgeLotViewers",
    ]);
  });

  it("purgeLotViewers does not reschedule when the backlog is drained", async () => {
    const t = await setup();
    await t.mutation(internal.cronJobs.setAllCronJobsEnabled, {
      enabled: true,
    });
    await t.mutation(internal.cronJobs.purgeLotViewers, {});
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(scheduled).toEqual([]);
  });

  it("sweepOrphanedUploads deletes nothing while disabled and sweeps once enabled", async () => {
    vi.useFakeTimers();
    try {
      const old = Date.now() - 3 * 24 * 60 * 60 * 1000;
      vi.setSystemTime(old);
      // Build everything at the old time: convex-test keeps creation times
      // monotonic, so the file must not be created after "newer" rows.
      const t = await setup();
      const orphan = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
      vi.setSystemTime(old + 3 * 24 * 60 * 60 * 1000);
      const present = () =>
        t.run(
          async (ctx) => (await ctx.db.system.get("_storage", orphan)) !== null
        );

      await t.action(internal.cronJobs.sweepOrphanedUploads, {});
      expect(await present()).toBe(true);

      await t.mutation(internal.cronJobs.setAllCronJobsEnabled, {
        enabled: true,
      });
      await t.action(internal.cronJobs.sweepOrphanedUploads, {});
      expect(await present()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gated wrappers run their job once enabled", async () => {
    const t = await setup();
    await t.mutation(internal.cronJobs.setAllCronJobsEnabled, {
      enabled: true,
    });
    expect(
      await t.mutation(internal.cronJobs.settleExpiredAuctions, {})
    ).toEqual({ settled: 0, hasMore: false });
    expect(
      await t.mutation(internal.cronJobs.cleanupAbandonedDrafts, {})
    ).toEqual({ deleted: 0, errors: 0 });
    expect(
      await t.mutation(internal.cronJobs.cleanupPresenceRecords, {})
    ).toBeNull();
    expect(
      await t.action(internal.cronJobs.processErrorReports, {})
    ).toBeNull();
  });

  it("sendSaleReminders is a no-op while the job is off, and runs when on", async () => {
    const t = await setup();
    const asAdmin = t.withIdentity({ subject: ADMIN });
    await asAdmin.mutation(api.cronJobs.setCronJobEnabled, {
      key: "send_sale_reminders",
      enabled: false,
    });
    expect(await t.mutation(internal.cronJobs.sendSaleReminders, {})).toEqual({
      sent: 0,
      hasMore: false,
    });
    await asAdmin.mutation(api.cronJobs.setCronJobEnabled, {
      key: "send_sale_reminders",
      enabled: true,
    });
    // On, but the Push reminders platform setting is still off: nothing sent.
    expect(await t.mutation(internal.cronJobs.sendSaleReminders, {})).toEqual({
      sent: 0,
      hasMore: false,
    });
  });
});
