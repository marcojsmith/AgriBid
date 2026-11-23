/// <reference types="vite/client" />

/**
 * Integration coverage for `migrations:backfillBidCounts`, the idempotent
 * rebuild of the per-lot valid-bid counters (`bids:<lotId>`).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import {
  BID_COUNT_BACKFILL_BATCH,
  BID_COUNT_PAGE_SIZE,
  BID_COUNT_READ_BUDGET,
} from "./migrations";
import { bidCounterName, getBidCount } from "./lib/lotCounters";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

const createTestContext = () => convexTest(schema, modules);
type TestContext = ReturnType<typeof createTestContext>;

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Inserts a lot.
 *
 * @param t - Test context
 * @returns The lot id
 */
async function insertLot(t: TestContext): Promise<Id<"lots">> {
  return await t.run((ctx) =>
    ctx.db.insert("lots", {
      title: "Lot",
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
    })
  );
}

/**
 * Inserts bids of the given statuses for a lot.
 *
 * @param t - Test context
 * @param lotId - The lot
 * @param statuses - One bid per status (`undefined` = legacy bid without status)
 */
async function insertBids(
  t: TestContext,
  lotId: Id<"lots">,
  statuses: ("valid" | "voided" | undefined)[]
): Promise<void> {
  await t.run(async (ctx) => {
    for (const status of statuses) {
      await ctx.db.insert("bids", {
        lotId,
        bidderId: "b",
        amount: 100,
        timestamp: Date.now(),
        status,
      });
    }
  });
}

/**
 * Reads a lot's counter row total (null when no row exists).
 *
 * @param t - Test context
 * @param lotId - The lot
 * @returns The total, or null
 */
async function counterTotal(
  t: TestContext,
  lotId: Id<"lots">
): Promise<number | null> {
  return await t.run(async (ctx) => {
    const row = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", bidCounterName(lotId)))
      .unique();
    return row?.total ?? null;
  });
}

describe("migrations:backfillBidCounts", () => {
  it("sets each lot's counter to its number of non-voided bids", async () => {
    const t = createTestContext();
    const a = await insertLot(t);
    const b = await insertLot(t);
    const c = await insertLot(t);
    await insertBids(t, a, ["valid", undefined, "voided", "valid"]);
    await insertBids(t, b, ["voided"]);

    const result = await t.mutation(internal.migrations.backfillBidCounts, {});

    expect(result).toEqual({
      processed: 3,
      updated: 1,
      bidsCounted: 3,
      isDone: true,
      continueCursor: null,
    });
    expect(await counterTotal(t, a)).toBe(3);
    // No valid bids and no counter row: left alone.
    expect(await counterTotal(t, b)).toBeNull();
    expect(await counterTotal(t, c)).toBeNull();
    expect(await t.run((ctx) => getBidCount(ctx, a))).toBe(3);
  });

  it("corrects drifted counters, including ones that must drop to zero", async () => {
    const t = createTestContext();
    const drifted = await insertLot(t);
    const stale = await insertLot(t);
    await insertBids(t, drifted, ["valid", "valid"]);
    await insertBids(t, stale, ["voided"]);
    await t.run(async (ctx) => {
      for (const [lotId, total] of [
        [drifted, 9],
        [stale, 4],
      ] as const) {
        await ctx.db.insert("counters", {
          name: bidCounterName(lotId),
          total,
          updatedAt: Date.now(),
        });
      }
    });

    const result = await t.mutation(internal.migrations.backfillBidCounts, {});

    expect(result.updated).toBe(2);
    expect(await counterTotal(t, drifted)).toBe(2);
    expect(await counterTotal(t, stale)).toBe(0);
  });

  it("is idempotent: a second run changes nothing", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    await insertBids(t, lotId, ["valid", "valid"]);

    await t.mutation(internal.migrations.backfillBidCounts, {});
    const second = await t.mutation(internal.migrations.backfillBidCounts, {});

    expect(second.updated).toBe(0);
    expect(second.bidsCounted).toBe(2);
    expect(await counterTotal(t, lotId)).toBe(2);
  });

  it("works through the table in bounded batches and reschedules itself", async () => {
    vi.useFakeTimers();
    const t = createTestContext();
    const lotIds: Id<"lots">[] = [];
    for (let i = 0; i < BID_COUNT_BACKFILL_BATCH + 2; i++) {
      const lotId = await insertLot(t);
      await insertBids(t, lotId, ["valid"]);
      lotIds.push(lotId);
    }

    const first = await t.mutation(internal.migrations.backfillBidCounts, {});
    expect(first.processed).toBe(BID_COUNT_BACKFILL_BATCH);
    expect(first.isDone).toBe(false);
    expect(first.continueCursor).not.toBeNull();

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    for (const lotId of lotIds) {
      expect(await counterTotal(t, lotId)).toBe(1);
    }
  });

  it("counts a lot with more bids than a page across bounded reschedules", async () => {
    vi.useFakeTimers();
    const t = createTestContext();
    const big = await insertLot(t);
    const small = await insertLot(t);
    const total = BID_COUNT_READ_BUDGET + BID_COUNT_PAGE_SIZE + 7;
    const statuses: ("valid" | "voided" | undefined)[] = Array.from(
      { length: total },
      (_, i) => (i % 10 === 0 ? "voided" : "valid")
    );
    const expectedValid = statuses.filter((s) => s !== "voided").length;
    await insertBids(t, big, statuses);
    await insertBids(t, small, ["valid", "valid"]);

    const first = await t.mutation(internal.migrations.backfillBidCounts, {});

    // The budget is spent mid-lot: nothing finished, a continuation is queued
    // and no counter has been written with a partial value yet.
    expect(first).toMatchObject({ processed: 0, updated: 0, isDone: false });
    expect(first.bidsCounted).toBeLessThanOrEqual(BID_COUNT_READ_BUDGET);
    expect(await counterTotal(t, big)).toBeNull();

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await counterTotal(t, big)).toBe(expectedValid);
    expect(await counterTotal(t, small)).toBe(2);

    const rerun = await t.mutation(internal.migrations.backfillBidCounts, {});
    expect(rerun.updated).toBe(0);
  });

  it("resumes at the carried lot index with a partial total", async () => {
    const t = createTestContext();
    const lotId = await insertLot(t);
    await insertBids(t, lotId, ["valid", "valid", "voided"]);
    const afterTimestamp = await t.run(async (ctx) => {
      const [first] = await ctx.db
        .query("bids")
        .withIndex("by_lot", (q) => q.eq("lotId", lotId))
        .take(1);
      return first.timestamp;
    });

    // Pretend the first bid (valid) was already read and counted: 41 + the
    // one remaining valid bid.
    const result = await t.mutation(internal.migrations.backfillBidCounts, {
      cursor: null,
      lotIndex: 0,
      afterTimestamp,
      skipAtTimestamp: 1,
      partialValid: 41,
    });

    expect(result.updated).toBe(1);
    expect(await counterTotal(t, lotId)).toBe(42);
  });

  it("accepts an explicit cursor", async () => {
    const t = createTestContext();
    await insertLot(t);
    const result = await t.mutation(internal.migrations.backfillBidCounts, {
      cursor: null,
    });
    expect(result.isDone).toBe(true);
  });
});
