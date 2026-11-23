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
  it("lists every job disabled by default for admins", async () => {
    const t = await setup();
    const jobs = await t
      .withIdentity({ subject: ADMIN })
      .query(api.cronJobs.getCronJobs, {});
    expect(jobs).toHaveLength(CRON_JOBS.length);
    expect(jobs.every((job) => !job.enabled)).toBe(true);
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
  });

  it("purgeLotViewers wrapper purges stale rows only once enabled", async () => {
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

    await t.mutation(internal.cronJobs.purgeLotViewers, {});
    expect(await count()).toBe(1);

    await t.mutation(internal.cronJobs.setAllCronJobsEnabled, {
      enabled: true,
    });
    expect(await t.mutation(internal.cronJobs.purgeLotViewers, {})).toEqual({
      deleted: 1,
      hasMore: false,
    });
    expect(await count()).toBe(0);
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
});
