import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  STORAGE_SWEEP_BATCH_SIZE,
  STORAGE_SWEEP_MIN_AGE_MS,
} from "./constants";
import schema from "./schema";
import { runOrphanSweep } from "./storageCleanup";

const modules = import.meta.glob("./**/*.*s");
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-03-20T00:00:00Z").getTime();

type Tester = ReturnType<typeof convexTest>;

const lotFields = (images: {
  additional?: string[];
  front?: string;
}): {
  title: string;
  make: string;
  model: string;
  year: number;
  operatingHours: number;
  location: string;
  reservePrice: number;
  startingPrice: number;
  currentPrice: number;
  minIncrement: number;
  sellerId: string;
  status: "draft";
  images: { additional?: string[]; front?: string };
} => ({
  title: "Lot",
  make: "m",
  model: "x",
  year: 2020,
  operatingHours: 1,
  location: "l",
  reservePrice: 1,
  startingPrice: 1,
  currentPrice: 1,
  minIncrement: 1,
  sellerId: "s",
  status: "draft",
  images,
});

/**
 * Stores a file with the given age.
 *
 * @param t - convex-test instance.
 * @param ageMs - Age in ms before NOW.
 * @returns The new storage ID.
 */
async function storeFile(t: Tester, ageMs: number): Promise<Id<"_storage">> {
  vi.setSystemTime(NOW - ageMs);
  const id = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
  vi.setSystemTime(NOW);
  return id;
}

async function exists(t: Tester, id: Id<"_storage">): Promise<boolean> {
  return await t.run(
    async (ctx) => (await ctx.db.system.get("_storage", id)) !== null
  );
}

describe("orphaned-upload sweep", () => {
  let t: Tester;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    t = convexTest(schema, modules);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const sweep = () =>
    t.action(internal.storageCleanup.sweepOrphanedUploads, {
      referencePageSize: 2,
    });

  it("deletes true orphans in the window and keeps referenced, young and out-of-window files", async () => {
    // Store oldest first: convex-test keeps creation times monotonic.
    const ancient = await storeFile(t, 30 * DAY);
    const orphan = await storeFile(t, 3 * DAY);
    const referenced = await storeFile(t, 3 * DAY);
    const young = await storeFile(t, STORAGE_SWEEP_MIN_AGE_MS / 2);
    await t.run((ctx) =>
      ctx.db.insert("lots", lotFields({ front: referenced }))
    );

    const result = await sweep();

    expect(result).toEqual({ scanned: 2, deleted: 1 });
    expect(await exists(t, orphan)).toBe(false);
    expect(await exists(t, referenced)).toBe(true);
    expect(await exists(t, young)).toBe(true);
    expect(await exists(t, ancient)).toBe(true);
  });

  it("keeps a file referenced only by a lot past the first page", async () => {
    const late = await storeFile(t, 3 * DAY);
    const conditionReport = await storeFile(t, 3 * DAY);
    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("lots", lotFields({}));
      }
      await ctx.db.insert("lots", {
        ...lotFields({ additional: [late] }),
        conditionReportUrl: conditionReport,
      });
    });

    const result = await sweep();

    expect(result.deleted).toBe(0);
    expect(await exists(t, late)).toBe(true);
    expect(await exists(t, conditionReport)).toBe(true);
  });

  it("keeps a KYC document referenced only by a profile past the first page", async () => {
    const kyc = await storeFile(t, 3 * DAY);
    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("profiles", {
          userId: `u${i.toString()}`,
          name: "n",
          role: "buyer",
          isVerified: false,
          createdAt: 1,
          updatedAt: 1,
        });
      }
      await ctx.db.insert("profiles", {
        userId: "last",
        name: "n",
        role: "buyer",
        isVerified: false,
        kycDocuments: [kyc],
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await sweep();

    expect(await exists(t, kyc)).toBe(true);
  });

  it("keeps a banner referenced only by an auction past the first page", async () => {
    const banner = await storeFile(t, 3 * DAY);
    await t.run(async (ctx) => {
      const base = {
        title: "a",
        startTime: 1,
        endTime: 2,
        status: "draft" as const,
        createdBy: "admin",
        createdAt: 1,
        updatedAt: 1,
      };
      for (let i = 0; i < 5; i++) await ctx.db.insert("auctions", base);
      await ctx.db.insert("auctions", { ...base, bannerImage: banner });
    });

    await sweep();

    expect(await exists(t, banner)).toBe(true);
  });

  it("works with the production page size when tables exceed it", async () => {
    const late = await storeFile(t, 3 * DAY);
    await t.run(async (ctx) => {
      for (let i = 0; i < 501; i++) {
        await ctx.db.insert("lots", lotFields({}));
      }
      await ctx.db.insert("lots", lotFields({ front: late }));
    });

    const result = await t.action(
      internal.storageCleanup.sweepOrphanedUploads,
      {}
    );

    expect(result.deleted).toBe(0);
    expect(await exists(t, late)).toBe(true);
  });

  it("deletes nothing when the scan cannot finish within the page limit", async () => {
    const orphan = await storeFile(t, 3 * DAY);
    await t.run(async (ctx) => {
      for (let i = 0; i < 6; i++) await ctx.db.insert("lots", lotFields({}));
    });

    await expect(
      t.action(internal.storageCleanup.sweepOrphanedUploads, {
        referencePageSize: 2,
        maxPagesPerTable: 2,
      })
    ).rejects.toThrow(/nothing deleted/);
    expect(await exists(t, orphan)).toBe(true);
  });

  it("deletes nothing when a page query fails partway through the scan", async () => {
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({ ids: [], continueCursor: "c", isDone: false })
      .mockRejectedValueOnce(new Error("boom"));
    const runMutation = vi.fn();

    await expect(runOrphanSweep({ runQuery, runMutation })).rejects.toThrow(
      "boom"
    );
    expect(runMutation).not.toHaveBeenCalled();
    // Candidates are never even listed after a failed scan.
    expect(runQuery).toHaveBeenCalledTimes(2);
  });

  it("delete mutation skips missing and too-young files", async () => {
    const old = await storeFile(t, 3 * DAY);
    const gone = await storeFile(t, 3 * DAY);
    const young = await storeFile(t, STORAGE_SWEEP_MIN_AGE_MS / 2);
    await t.run((ctx) => ctx.storage.delete(gone));

    const deleted = await t.mutation(
      internal.storageCleanup.deleteOrphanedFiles,
      {
        storageIds: [young, old, gone],
      }
    );

    expect(deleted).toBe(1);
    expect(await exists(t, young)).toBe(true);
    expect(await exists(t, old)).toBe(false);
  });

  it("caps candidates per run at the batch size", async () => {
    const ids = await t.run(async (ctx) => {
      vi.setSystemTime(NOW - 3 * DAY);
      const out: Id<"_storage">[] = [];
      for (let i = 0; i < STORAGE_SWEEP_BATCH_SIZE + 5; i++) {
        out.push(await ctx.storage.store(new Blob([String(i)])));
      }
      vi.setSystemTime(NOW);
      return out;
    });
    expect(ids.length).toBeGreaterThan(STORAGE_SWEEP_BATCH_SIZE);

    const candidates = await t.query(
      internal.storageCleanup.listSweepCandidates,
      {}
    );
    expect(candidates).toHaveLength(STORAGE_SWEEP_BATCH_SIZE);
  });
});
