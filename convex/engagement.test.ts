/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import {
  ENGAGEMENT_CANDIDATE_CAP,
  LOT_ANON_VIEW_CAP_PER_HOUR,
  LOT_DATA_DELETE_BATCH,
  LOT_VIEWER_RETENTION_MS,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
} from "./constants";
import {
  anonViewCounterName,
  removeLotWatchData,
  viewCounterName,
  watcherCounterName,
} from "./lib/lotCounters";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

type TestContext = ReturnType<typeof makeContext>;

/**
 * Builds a convex-test backend.
 *
 * @returns The test context
 */
function makeContext() {
  return convexTest(schema, modules);
}

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Inserts a published auction.
 *
 * @param t - Test context
 * @param overrides - Field overrides
 * @param overrides.status - Auction status (default published)
 * @param overrides.startTime - Start time (default an hour ago)
 * @param overrides.endTime - End time (default a day from now)
 * @returns The auction id
 */
async function makeAuction(
  t: TestContext,
  overrides: {
    status?: "draft" | "published" | "closed";
    startTime?: number;
    endTime?: number;
  } = {}
): Promise<Id<"auctions">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("auctions", {
      title: "Sale",
      startTime: overrides.startTime ?? now - MS_PER_HOUR,
      endTime: overrides.endTime ?? now + MS_PER_DAY,
      status: overrides.status ?? "published",
      createdBy: "admin",
      createdAt: now,
      updatedAt: now,
    })
  );
}

/**
 * Inserts a lot.
 *
 * @param t - Test context
 * @param auctionId - Parent auction
 * @param lotNumber - Lot number
 * @param status - Lot status
 * @returns The lot id
 */
async function makeLot(
  t: TestContext,
  auctionId: Id<"auctions"> | undefined,
  lotNumber: number,
  status: "assigned" | "approved" | "draft" = "assigned"
): Promise<Id<"lots">> {
  return await t.run((ctx) =>
    ctx.db.insert("lots", {
      title: `Lot ${String(lotNumber)}`,
      make: "John Deere",
      model: "5075E",
      year: 2020,
      operatingHours: 100,
      location: "Bloemfontein",
      reservePrice: 1000,
      startingPrice: 500,
      currentPrice: 500,
      minIncrement: 50,
      sellerId: "seller",
      status,
      auctionId,
      lotNumber,
      images: [],
    })
  );
}

/**
 * Seeds engagement signals for a lot.
 *
 * @param t - Test context
 * @param lotId - The lot
 * @param signals - Watcher/view counter totals and bid statuses
 * @param signals.watchers - Watcher counter total
 * @param signals.views - View counter total
 * @param signals.bids - Bid statuses to insert
 */
async function seedSignals(
  t: TestContext,
  lotId: Id<"lots">,
  signals: {
    watchers?: number;
    views?: number;
    bids?: ("valid" | "voided" | undefined)[];
  }
): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now();
    if (signals.watchers !== undefined) {
      await ctx.db.insert("counters", {
        name: `watchers:${lotId}`,
        total: signals.watchers,
        updatedAt: now,
      });
    }
    if (signals.views !== undefined) {
      await ctx.db.insert("counters", {
        name: viewCounterName(lotId),
        total: signals.views,
        updatedAt: now,
      });
    }
    for (const status of signals.bids ?? []) {
      await ctx.db.insert("bids", {
        lotId,
        bidderId: "b",
        amount: 600,
        timestamp: now,
        status,
      });
    }
  });
}

/**
 * Reads a lot's view counter.
 *
 * @param t - Test context
 * @param lotId - The lot
 * @returns The total, 0 when absent
 */
async function viewTotal(t: TestContext, lotId: Id<"lots">): Promise<number> {
  return await t.run(async (ctx) => {
    const row = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", viewCounterName(lotId)))
      .unique();
    return row?.total ?? 0;
  });
}

const SESSION = "session_abcdef12";

describe("recordLotView", () => {
  it("counts an anonymous view and dedupes within 30 minutes", async () => {
    vi.useFakeTimers();
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);

    expect(
      await t.mutation(api.engagement.recordLotView, {
        lotId,
        sessionId: SESSION,
      })
    ).toEqual({ counted: true });
    expect(
      await t.mutation(api.engagement.recordLotView, {
        lotId,
        sessionId: SESSION,
      })
    ).toEqual({ counted: false });
    expect(await viewTotal(t, lotId)).toBe(1);

    vi.advanceTimersByTime(31 * MS_PER_MINUTE);
    expect(
      await t.mutation(api.engagement.recordLotView, {
        lotId,
        sessionId: SESSION,
      })
    ).toEqual({ counted: true });
    expect(await viewTotal(t, lotId)).toBe(2);
    const rows = await t.run((ctx) => ctx.db.query("lotViewers").collect());
    expect(rows).toHaveLength(1);
  });

  it("counts different viewers separately and uses the user id when signed in", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);

    await t.mutation(api.engagement.recordLotView, {
      lotId,
      sessionId: SESSION,
    });
    // Signed in: sessionId is not required and is ignored.
    expect(
      await t
        .withIdentity({ subject: "user_1" })
        .mutation(api.engagement.recordLotView, { lotId })
    ).toEqual({ counted: true });
    expect(await viewTotal(t, lotId)).toBe(2);
    const keys = (
      await t.run((ctx) => ctx.db.query("lotViewers").collect())
    ).map((r) => r.viewerKey);
    expect(keys.sort()).toEqual([`s:${SESSION}`, "u:user_1"].sort());
  });

  it("never lets an anonymous session id collide with a user id", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    // A signed-out client picks a session id equal to a real user's id.
    const userId = "user_12345678";

    expect(
      await t.mutation(api.engagement.recordLotView, {
        lotId,
        sessionId: userId,
      })
    ).toEqual({ counted: true });
    expect(
      await t
        .withIdentity({ subject: userId })
        .mutation(api.engagement.recordLotView, { lotId })
    ).toEqual({ counted: true });
    expect(await viewTotal(t, lotId)).toBe(2);
    const keys = (
      await t.run((ctx) => ctx.db.query("lotViewers").collect())
    ).map((r) => r.viewerKey);
    expect(keys.sort()).toEqual([`s:${userId}`, `u:${userId}`]);
  });

  it("caps anonymous counted views per lot per hour, resetting each hour", async () => {
    vi.useFakeTimers();
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    const bucket = Math.floor(Date.now() / MS_PER_HOUR);
    // Budget almost used up: one anonymous view left this hour.
    await t.run((ctx) =>
      ctx.db.insert("counters", {
        name: anonViewCounterName(lotId),
        total: LOT_ANON_VIEW_CAP_PER_HOUR - 1,
        active: bucket,
        updatedAt: Date.now(),
      })
    );
    const anon = (sessionId: string) =>
      t.mutation(api.engagement.recordLotView, { lotId, sessionId });

    expect(await anon("anon_session_1")).toEqual({ counted: true });
    expect(await anon("anon_session_2")).toEqual({ counted: false });
    // Signed-in viewers are not subject to the anonymous cap.
    expect(
      await t
        .withIdentity({ subject: "user_9" })
        .mutation(api.engagement.recordLotView, { lotId })
    ).toEqual({ counted: true });
    expect(await viewTotal(t, lotId)).toBe(2);

    // A new hour opens a fresh budget (same single counter row, reused).
    vi.advanceTimersByTime(MS_PER_HOUR);
    expect(await anon("anon_session_2")).toEqual({ counted: true });
    const rows = await t.run((ctx) =>
      ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", anonViewCounterName(lotId)))
        .collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ total: 1, active: bucket + 1 });
  });

  it("starts the anonymous budget on the first anonymous view", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    await t.mutation(api.engagement.recordLotView, {
      lotId,
      sessionId: SESSION,
    });
    const row = await t.run((ctx) =>
      ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", anonViewCounterName(lotId)))
        .unique()
    );
    expect(row?.total).toBe(1);
  });

  it("rejects missing or invalid session ids when signed out", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);

    for (const sessionId of [
      undefined,
      "short",
      "bad id with spaces!",
      "x".repeat(65),
    ]) {
      await expect(
        t.mutation(api.engagement.recordLotView, { lotId, sessionId })
      ).rejects.toThrow("Invalid session id");
    }
    expect(await viewTotal(t, lotId)).toBe(0);
  });

  it("does not count lots that are not assigned or do not exist", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const approved = await makeLot(t, auctionId, 1, "approved");
    const draft = await makeLot(t, undefined, 2, "draft");
    const gone = await makeLot(t, auctionId, 3);
    await t.run((ctx) => ctx.db.delete("lots", gone));

    for (const lotId of [approved, draft, gone]) {
      expect(
        await t.mutation(api.engagement.recordLotView, {
          lotId,
          sessionId: SESSION,
        })
      ).toEqual({ counted: false });
    }
    expect(await t.run((ctx) => ctx.db.query("lotViewers").collect())).toEqual(
      []
    );
  });

  it("rate limits a viewer to 60 counted views per hour", async () => {
    vi.useFakeTimers();
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotIds: Id<"lots">[] = [];
    for (let i = 1; i <= 61; i++) {
      lotIds.push(await makeLot(t, auctionId, i));
    }

    for (let i = 0; i < 60; i++) {
      const result = await t.mutation(api.engagement.recordLotView, {
        lotId: lotIds[i],
        sessionId: SESSION,
      });
      expect(result.counted).toBe(true);
    }
    expect(
      await t.mutation(api.engagement.recordLotView, {
        lotId: lotIds[60],
        sessionId: SESSION,
      })
    ).toEqual({ counted: false });
    expect(await viewTotal(t, lotIds[60])).toBe(0);

    // Another viewer is unaffected.
    expect(
      await t.mutation(api.engagement.recordLotView, {
        lotId: lotIds[60],
        sessionId: "another_session_1",
      })
    ).toEqual({ counted: true });

    // After the hour passes the limit lifts.
    vi.advanceTimersByTime(MS_PER_HOUR + MS_PER_MINUTE);
    expect(
      await t.mutation(api.engagement.recordLotView, {
        lotId: lotIds[60],
        sessionId: SESSION,
      })
    ).toEqual({ counted: true });
  });
});

describe("purgeLotViewers", () => {
  it("deletes only rows older than 24h", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("lotViewers", {
        lotId,
        viewerKey: "old",
        lastViewedAt: now - LOT_VIEWER_RETENTION_MS - MS_PER_MINUTE,
      });
      await ctx.db.insert("lotViewers", {
        lotId,
        viewerKey: "fresh",
        lastViewedAt: now - MS_PER_HOUR,
      });
    });
    expect(await t.mutation(internal.engagement.purgeLotViewers, {})).toEqual({
      deleted: 1,
      hasMore: false,
    });
    const rows = await t.run((ctx) => ctx.db.query("lotViewers").collect());
    expect(rows.map((r) => r.viewerKey)).toEqual(["fresh"]);
  });

  it("works in bounded batches of 500 and reports hasMore", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    await t.run(async (ctx) => {
      const old = Date.now() - 2 * MS_PER_DAY;
      for (let i = 0; i < 501; i++) {
        await ctx.db.insert("lotViewers", {
          lotId,
          viewerKey: `k${String(i)}`,
          lastViewedAt: old,
        });
      }
    });
    expect(await t.mutation(internal.engagement.purgeLotViewers, {})).toEqual({
      deleted: 500,
      hasMore: true,
    });
    expect(await t.mutation(internal.engagement.purgeLotViewers, {})).toEqual({
      deleted: 1,
      hasMore: false,
    });
  });
});

describe("removeLotWatchData", () => {
  it("also removes the lot's view counter and viewer rows", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    const otherId = await makeLot(t, auctionId, 2);
    await t.mutation(api.engagement.recordLotView, {
      lotId,
      sessionId: SESSION,
    });
    await t.mutation(api.engagement.recordLotView, {
      lotId: otherId,
      sessionId: SESSION,
    });

    await t.run((ctx) => removeLotWatchData(ctx, lotId));

    expect(await viewTotal(t, lotId)).toBe(0);
    expect(await viewTotal(t, otherId)).toBe(1);
    const rows = await t.run((ctx) => ctx.db.query("lotViewers").collect());
    expect(rows.map((r) => r.lotId)).toEqual([otherId]);
  });

  it("removes the anonymous-view budget counter with the lot", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    await t.mutation(api.engagement.recordLotView, {
      lotId,
      sessionId: SESSION,
    });

    await t.run((ctx) => removeLotWatchData(ctx, lotId));

    const names = (
      await t.run((ctx) => ctx.db.query("counters").collect())
    ).map((c) => c.name);
    expect(names).toEqual([]);
  });

  it("deletes one bounded batch per call and continues via the scheduler", async () => {
    vi.useFakeTimers();
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    const total = LOT_DATA_DELETE_BATCH + 1;
    await t.run(async (ctx) => {
      for (let i = 0; i < total; i++) {
        await ctx.db.insert("watchlist", { userId: `u${String(i)}`, lotId });
        await ctx.db.insert("lotViewers", {
          lotId,
          viewerKey: `u:v${String(i)}`,
          lastViewedAt: Date.now(),
        });
      }
      await ctx.db.insert("counters", {
        name: watcherCounterName(lotId),
        total,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("counters", {
        name: viewCounterName(lotId),
        total,
        updatedAt: Date.now(),
      });
    });

    await t.run((ctx) => removeLotWatchData(ctx, lotId));

    // First call: one batch each, counters kept, continuation scheduled.
    const after = await t.run(async (ctx) => ({
      watch: (await ctx.db.query("watchlist").collect()).length,
      viewers: (await ctx.db.query("lotViewers").collect()).length,
      counters: (await ctx.db.query("counters").collect()).length,
      scheduled: (await ctx.db.system.query("_scheduled_functions").collect())
        .length,
    }));
    expect(after).toEqual({ watch: 1, viewers: 1, counters: 2, scheduled: 1 });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const done = await t.run(async (ctx) => ({
      watch: (await ctx.db.query("watchlist").collect()).length,
      viewers: (await ctx.db.query("lotViewers").collect()).length,
      counters: (await ctx.db.query("counters").collect()).length,
    }));
    expect(done).toEqual({ watch: 0, viewers: 0, counters: 0 });
  });

  it("does not schedule a continuation when everything fits one batch", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    await t.run((ctx) => removeLotWatchData(ctx, lotId));
    expect(
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      )
    ).toEqual([]);
  });
});

describe("getMostEngagedLots", () => {
  it("returns [] when there is no live auction", async () => {
    const t = makeContext();
    expect(await t.query(api.engagement.getMostEngagedLots, {})).toEqual([]);
    await makeAuction(t, { startTime: Date.now() + MS_PER_HOUR });
    await makeAuction(t, { status: "draft" });
    expect(await t.query(api.engagement.getMostEngagedLots, {})).toEqual([]);
  });

  it("returns [] for draft, closed or missing explicit auctions", async () => {
    const t = makeContext();
    const draft = await makeAuction(t, { status: "draft" });
    const closed = await makeAuction(t, { status: "closed" });
    const missing = await makeAuction(t);
    await makeLot(t, draft, 1);
    await t.run((ctx) => ctx.db.delete("auctions", missing));
    for (const auctionId of [draft, closed, missing]) {
      expect(
        await t.query(api.engagement.getMostEngagedLots, { auctionId })
      ).toEqual([]);
    }
  });

  it("returns [] when the auction has no assigned lots", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    await makeLot(t, auctionId, 1, "approved");
    expect(
      await t.query(api.engagement.getMostEngagedLots, { auctionId })
    ).toEqual([]);
  });

  it("ranks by watchers + valid bids + views and ignores voided bids", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const a = await makeLot(t, auctionId, 1);
    const b = await makeLot(t, auctionId, 2);
    const c = await makeLot(t, auctionId, 3);
    await seedSignals(t, a, { watchers: 1, views: 1 }); // 2
    await seedSignals(t, b, {
      watchers: 2,
      views: 3,
      bids: ["valid", undefined, "voided", "voided"],
    }); // 2 + 3 + 2 = 7
    await seedSignals(t, c, { views: 4, bids: ["voided"] }); // 4

    const result = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
      limit: 3,
    });
    expect(result.map((r) => r.lot._id)).toEqual([b, c, a]);
    expect(result[0]).toMatchObject({
      watchers: 2,
      bids: 2,
      views: 3,
      score: 7,
    });
    expect(result[0].lot.title).toBe("Lot 2");
  });

  it("breaks ties by lower lot number", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const high = await makeLot(t, auctionId, 9);
    const low = await makeLot(t, auctionId, 2);
    await seedSignals(t, high, { views: 5 });
    await seedSignals(t, low, { views: 5 });
    const result = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
      limit: 2,
    });
    expect(result.map((r) => r.lot._id)).toEqual([low, high]);
  });

  it("defaults to 1 result and clamps the limit to 1..3", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    for (let i = 1; i <= 5; i++) await makeLot(t, auctionId, i);

    const len = async (limit?: number) =>
      (await t.query(api.engagement.getMostEngagedLots, { auctionId, limit }))
        .length;
    expect(await len()).toBe(1);
    expect(await len(0)).toBe(1);
    expect(await len(-4)).toBe(1);
    expect(await len(2)).toBe(2);
    expect(await len(10)).toBe(3);
    expect(await len(Number.NaN)).toBe(1);
  });

  it("without auctionId picks the live auction that ends soonest", async () => {
    const t = makeContext();
    const now = Date.now();
    const later = await makeAuction(t, { endTime: now + 3 * MS_PER_DAY });
    const sooner = await makeAuction(t, { endTime: now + MS_PER_DAY });
    await makeAuction(t, {
      startTime: now + MS_PER_HOUR,
      endTime: now + MS_PER_HOUR * 2,
    }); // not started
    await makeLot(t, later, 1);
    const soonerLot = await makeLot(t, sooner, 1);

    const result = await t.query(api.engagement.getMostEngagedLots, {});
    expect(result.map((r) => r.lot._id)).toEqual([soonerLot]);
  });

  it("only considers the first ENGAGEMENT_CANDIDATE_CAP lots", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotIds: Id<"lots">[] = [];
    await t.run(async (ctx) => {
      for (let i = 1; i <= ENGAGEMENT_CANDIDATE_CAP + 1; i++) {
        lotIds.push(
          await ctx.db.insert("lots", {
            title: `Lot ${String(i)}`,
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
            lotNumber: i,
            images: [],
          })
        );
      }
    });
    // The 101st lot (outside the cap) is by far the most engaged.
    await seedSignals(t, lotIds[ENGAGEMENT_CANDIDATE_CAP], { views: 1000 });
    const result = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
      limit: 3,
    });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.lot._id)).not.toContain(
      lotIds[ENGAGEMENT_CANDIDATE_CAP]
    );
  });

  it("caps counted bids at 200", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    await t.run(async (ctx) => {
      for (let i = 0; i < 210; i++) {
        await ctx.db.insert("bids", {
          lotId,
          bidderId: "b",
          amount: 600 + i,
          timestamp: Date.now(),
          status: "valid",
        });
      }
    });
    const [top] = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
    });
    expect(top.bids).toBe(200);
  });
});
