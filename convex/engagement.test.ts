/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import { handleNewBid } from "./auctions/proxy_bidding";
import { computeEngagementScore } from "./engagement";
import {
  ENGAGEMENT_CANDIDATE_CAP,
  ENGAGEMENT_REFRESH_AUCTION_CAP,
  LOT_ANON_VIEW_CAP_PER_HOUR,
  LOT_DATA_DELETE_BATCH,
  LOT_VIEWER_RETENTION_MS,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
} from "./constants";
import {
  anonViewCounterName,
  bidCounterName,
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
 * @param signals - Watcher/view/bid counter totals (upserted)
 * @param signals.watchers - Watcher counter total
 * @param signals.views - View counter total
 * @param signals.bids - Valid-bid counter total
 */
async function seedSignals(
  t: TestContext,
  lotId: Id<"lots">,
  signals: { watchers?: number; views?: number; bids?: number }
): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now();
    const entries: [string, number | undefined][] = [
      [watcherCounterName(lotId), signals.watchers],
      [viewCounterName(lotId), signals.views],
      [bidCounterName(lotId), signals.bids],
    ];
    for (const [name, total] of entries) {
      if (total === undefined) continue;
      const existing = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();
      if (existing) {
        await ctx.db.patch("counters", existing._id, { total, updatedAt: now });
      } else {
        await ctx.db.insert("counters", { name, total, updatedAt: now });
      }
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
    expect(LOT_ANON_VIEW_CAP_PER_HOUR).toBe(20);
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

describe("computeEngagementScore", () => {
  it("weighs bids x3 + watchers x2 + log2(1 + views)", () => {
    expect(computeEngagementScore({ bids: 0, watchers: 0, views: 0 })).toBe(0);
    expect(computeEngagementScore({ bids: 2, watchers: 3, views: 0 })).toBe(12);
    expect(computeEngagementScore({ bids: 1, watchers: 1, views: 7 })).toBe(8);
    // log2(1 + 10) = 3.459..., rounded to 3 decimals.
    expect(computeEngagementScore({ bids: 0, watchers: 0, views: 10 })).toBe(
      3.459
    );
  });

  it("grows views logarithmically", () => {
    const small = computeEngagementScore({ bids: 0, watchers: 0, views: 100 });
    const large = computeEngagementScore({
      bids: 0,
      watchers: 0,
      views: 10_000,
    });
    expect(large).toBeLessThan(small * 3);
    expect(computeEngagementScore({ bids: 1, watchers: 0, views: 0 })).toBe(3);
  });
});

/**
 * Reads every `engagementScores` row.
 *
 * @param t - Test context
 * @returns The rows
 */
function scoreRows(t: TestContext) {
  return t.run((ctx) => ctx.db.query("engagementScores").collect());
}

describe("refreshEngagementScores", () => {
  it("upserts a row per assigned lot of a live auction from counters only", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const a = await makeLot(t, auctionId, 1);
    const b = await makeLot(t, auctionId, 2);
    await seedSignals(t, a, { watchers: 1, views: 7 });
    await seedSignals(t, b, { watchers: 2, views: 3, bids: 2 });
    // Raw bid rows are never read: the counter is the source of truth.
    await t.run((ctx) =>
      ctx.db.insert("bids", {
        lotId: a,
        bidderId: "b",
        amount: 700,
        timestamp: Date.now(),
        status: "valid",
      })
    );

    expect(
      await t.mutation(internal.engagement.refreshEngagementScores, {})
    ).toEqual({ auctions: 1, upserted: 2, removed: 0 });

    const rows = await scoreRows(t);
    expect(rows).toHaveLength(2);
    const rowA = rows.find((r) => r.lotId === a);
    const rowB = rows.find((r) => r.lotId === b);
    expect(rowA).toMatchObject({
      auctionId,
      lotNumber: 1,
      bids: 0,
      watchers: 1,
      views: 7,
      score: 5,
    });
    expect(rowB).toMatchObject({
      lotNumber: 2,
      bids: 2,
      watchers: 2,
      views: 3,
      score: 12,
    });
  });

  it("is idempotent and patches only rows whose values changed", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const a = await makeLot(t, auctionId, 1);
    const b = await makeLot(t, auctionId, 2);
    await seedSignals(t, a, { views: 3 });
    await seedSignals(t, b, { watchers: 1 });
    await t.mutation(internal.engagement.refreshEngagementScores, {});
    const before = await scoreRows(t);

    expect(
      await t.mutation(internal.engagement.refreshEngagementScores, {})
    ).toEqual({ auctions: 1, upserted: 0, removed: 0 });
    expect(await scoreRows(t)).toEqual(before);

    await seedSignals(t, a, { views: 3, bids: 1 }); // adds a bids counter
    expect(
      await t.mutation(internal.engagement.refreshEngagementScores, {})
    ).toEqual({ auctions: 1, upserted: 1, removed: 0 });
    const rowA = (await scoreRows(t)).find((r) => r.lotId === a);
    expect(rowA).toMatchObject({ bids: 1, score: 5 });
    const rowB = (await scoreRows(t)).find((r) => r.lotId === b);
    expect(rowB).toEqual(before.find((r) => r.lotId === b));
  });

  it("moves a row when its lot is renumbered or reassigned", async () => {
    const t = makeContext();
    const first = await makeAuction(t);
    const second = await makeAuction(t);
    const lot = await makeLot(t, first, 1);
    await t.mutation(internal.engagement.refreshEngagementScores, {});

    await t.run((ctx) =>
      ctx.db.patch("lots", lot, { auctionId: second, lotNumber: 4 })
    );
    await t.mutation(internal.engagement.refreshEngagementScores, {});

    const rows = await scoreRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ auctionId: second, lotNumber: 4 });
  });

  it("deletes rows of lots that are no longer assigned or are hidden", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const kept = await makeLot(t, auctionId, 1);
    const unassigned = await makeLot(t, auctionId, 2);
    const hidden = await makeLot(t, auctionId, 3);
    await t.mutation(internal.engagement.refreshEngagementScores, {});
    expect(await scoreRows(t)).toHaveLength(3);

    await t.run(async (ctx) => {
      await ctx.db.patch("lots", unassigned, {
        status: "approved",
        auctionId: undefined,
        lotNumber: undefined,
      });
      await ctx.db.patch("lots", hidden, { hiddenByFlags: true });
    });
    expect(
      await t.mutation(internal.engagement.refreshEngagementScores, {})
    ).toEqual({ auctions: 1, upserted: 0, removed: 2 });
    expect((await scoreRows(t)).map((r) => r.lotId)).toEqual([kept]);
  });

  it("only refreshes live published auctions", async () => {
    const t = makeContext();
    const now = Date.now();
    const live = await makeAuction(t);
    const upcoming = await makeAuction(t, { startTime: now + MS_PER_HOUR });
    const draft = await makeAuction(t, { status: "draft" });
    const closed = await makeAuction(t, {
      status: "closed",
      endTime: now - MS_PER_HOUR,
    });
    for (const id of [live, upcoming, draft, closed]) await makeLot(t, id, 1);

    expect(
      await t.mutation(internal.engagement.refreshEngagementScores, {})
    ).toEqual({ auctions: 1, upserted: 1, removed: 0 });
    expect((await scoreRows(t)).map((r) => r.auctionId)).toEqual([live]);
  });

  it("is bounded: soonest-ending auctions first, capped lots per auction", async () => {
    const t = makeContext();
    const now = Date.now();
    const auctionIds: Id<"auctions">[] = [];
    for (let i = 0; i < ENGAGEMENT_REFRESH_AUCTION_CAP + 1; i++) {
      auctionIds.push(
        await makeAuction(t, { endTime: now + (i + 1) * MS_PER_DAY })
      );
    }
    for (const id of auctionIds) await makeLot(t, id, 1);
    // The soonest auction holds more lots than the per-auction cap.
    await t.run(async (ctx) => {
      for (let i = 2; i <= ENGAGEMENT_CANDIDATE_CAP + 5; i++) {
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
          auctionId: auctionIds[0],
          lotNumber: i,
          images: [],
        });
      }
    });

    const result = await t.mutation(
      internal.engagement.refreshEngagementScores,
      {}
    );
    expect(result.auctions).toBe(ENGAGEMENT_REFRESH_AUCTION_CAP);
    const rows = await scoreRows(t);
    expect(rows.filter((r) => r.auctionId === auctionIds[0])).toHaveLength(
      ENGAGEMENT_CANDIDATE_CAP
    );
    expect(rows.map((r) => r.auctionId)).not.toContain(
      auctionIds[ENGAGEMENT_REFRESH_AUCTION_CAP]
    );
  });

  it("does nothing when there is no live auction", async () => {
    const t = makeContext();
    expect(
      await t.mutation(internal.engagement.refreshEngagementScores, {})
    ).toEqual({ auctions: 0, upserted: 0, removed: 0 });
  });

  it("sweeps rows whose auction is closed, a draft or gone", async () => {
    const t = makeContext();
    const now = Date.now();
    const live = await makeAuction(t);
    const closed = await makeAuction(t, {
      status: "closed",
      endTime: now - MS_PER_HOUR,
    });
    const draft = await makeAuction(t, { status: "draft" });
    const gone = await makeAuction(t);
    await makeLot(t, live, 1);
    const staleLot = await makeLot(t, closed, 1, "draft");
    await t.run(async (ctx) => {
      for (const auctionId of [closed, closed, draft, gone]) {
        await ctx.db.insert("engagementScores", {
          lotId: staleLot,
          auctionId,
          bids: 1,
          watchers: 0,
          views: 0,
          score: 3,
          updatedAt: now,
        });
      }
      await ctx.db.delete("auctions", gone);
    });

    expect(
      await t.mutation(internal.engagement.refreshEngagementScores, {})
    ).toEqual({ auctions: 1, upserted: 1, removed: 4 });

    expect((await scoreRows(t)).map((r) => r.auctionId)).toEqual([live]);
  });
});

describe("closing an auction deletes its engagement scores", () => {
  /**
   * Seeds a published, ended auction with one score row.
   *
   * @param t - Test context
   * @returns The auction id and a second, still-live auction id
   */
  async function seedEndedAuction(t: TestContext) {
    const now = Date.now();
    const ended = await makeAuction(t, {
      startTime: now - 2 * MS_PER_DAY,
      endTime: now - MS_PER_HOUR,
    });
    const live = await makeAuction(t);
    const lot = await makeLot(t, ended, 1, "draft");
    const liveLot = await makeLot(t, live, 1);
    await t.run(async (ctx) => {
      for (const [auctionId, lotId] of [
        [ended, lot],
        [live, liveLot],
      ] as const) {
        await ctx.db.insert("engagementScores", {
          lotId,
          auctionId,
          bids: 1,
          watchers: 0,
          views: 0,
          score: 3,
          updatedAt: now,
        });
      }
    });
    return { ended, live };
  }

  it("when the settlement cron closes the container", async () => {
    const t = makeContext();
    const { ended, live } = await seedEndedAuction(t);

    await t.mutation(internal.auctions.settleExpiredLots, {});

    const auction = await t.run((ctx) => ctx.db.get("auctions", ended));
    expect(auction?.status).toBe("closed");
    expect((await scoreRows(t)).map((r) => r.auctionId)).toEqual([live]);
  });

  it("when an admin closes the container", async () => {
    const t = makeContext();
    const { ended, live } = await seedEndedAuction(t);
    const now = Date.now();
    await t.run((ctx) =>
      ctx.db.insert("profiles", {
        userId: "admin_user",
        name: "Admin",
        email: "admin@example.com",
        role: "admin",
        isVerified: true,
        kycStatus: "verified",
        createdAt: now,
        updatedAt: now,
      })
    );

    await t
      .withIdentity({ subject: "admin_user" })
      .mutation(api.auctions.mutations.adminCrud.closeAuctionContainer, {
        auctionId: ended,
      });

    expect((await scoreRows(t)).map((r) => r.auctionId)).toEqual([live]);
  });
});

describe("getMostEngagedLots", () => {
  /**
   * Runs the engagement refresh so the query has rows to read.
   *
   * @param t - Test context
   */
  async function refresh(t: TestContext): Promise<void> {
    await t.mutation(internal.engagement.refreshEngagementScores, {});
  }

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

  it("returns [] before the first refresh (empty table)", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lot = await makeLot(t, auctionId, 1);
    await seedSignals(t, lot, { views: 50, watchers: 3 });
    expect(
      await t.query(api.engagement.getMostEngagedLots, { auctionId })
    ).toEqual([]);
    expect(await t.query(api.engagement.getMostEngagedLots, {})).toEqual([]);
  });

  it("returns [] when the auction has no assigned lots", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    await makeLot(t, auctionId, 1, "approved");
    await refresh(t);
    expect(
      await t.query(api.engagement.getMostEngagedLots, { auctionId })
    ).toEqual([]);
  });

  it("ranks by bids*3 + watchers*2 + log2(1+views)", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const a = await makeLot(t, auctionId, 1);
    const b = await makeLot(t, auctionId, 2);
    const c = await makeLot(t, auctionId, 3);
    await seedSignals(t, a, { watchers: 1, views: 1 }); // 2 + 1 = 3
    await seedSignals(t, b, { watchers: 2, views: 3, bids: 2 }); // 6 + 4 + 2 = 12
    await seedSignals(t, c, { views: 15 }); // log2(16) = 4
    await refresh(t);

    const result = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
      limit: 3,
    });
    expect(result.map((r) => r.lot._id)).toEqual([b, c, a]);
    expect(result[0]).toMatchObject({
      watchers: 2,
      bids: 2,
      views: 3,
      score: 12,
    });
    expect(result[1].score).toBe(4);
    expect(result[2].score).toBe(3);
    expect(result[0].lot.title).toBe("Lot 2");
  });

  it("weighs a valid bid above a watcher above views", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const bidLot = await makeLot(t, auctionId, 3);
    const watchLot = await makeLot(t, auctionId, 2);
    const viewLot = await makeLot(t, auctionId, 1);
    await seedSignals(t, bidLot, { bids: 1 }); // 3
    await seedSignals(t, watchLot, { watchers: 1 }); // 2
    await seedSignals(t, viewLot, { views: 3 }); // 2 (log2 4), ties watcher
    await refresh(t);
    const result = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
      limit: 3,
    });
    expect(result.map((r) => r.lot._id)).toEqual([bidLot, viewLot, watchLot]);
  });

  it("breaks ties by lower lot number, then id, including at the cut-off", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const high = await makeLot(t, auctionId, 9);
    const low = await makeLot(t, auctionId, 2);
    const mid = await makeLot(t, auctionId, 5);
    await seedSignals(t, high, { views: 7 });
    await seedSignals(t, low, { views: 7 });
    await seedSignals(t, mid, { views: 7 });
    await refresh(t);

    const top3 = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
      limit: 3,
    });
    expect(top3.map((r) => r.lot._id)).toEqual([low, mid, high]);
    // The cut-off lands inside a group of equal scores.
    const top2 = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
      limit: 2,
    });
    expect(top2.map((r) => r.lot._id)).toEqual([low, mid]);
    const top1 = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
    });
    expect(top1.map((r) => r.lot._id)).toEqual([low]);
  });

  it("defaults to 1 result and clamps the limit to 1..3", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    for (let i = 1; i <= 5; i++) await makeLot(t, auctionId, i);
    await refresh(t);

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
    await refresh(t);

    const result = await t.query(api.engagement.getMostEngagedLots, {});
    expect(result.map((r) => r.lot._id)).toEqual([soonerLot]);
  });

  it("only scores the first ENGAGEMENT_CANDIDATE_CAP lots", async () => {
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
    await refresh(t);
    const result = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
      limit: 3,
    });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.lot._id)).not.toContain(
      lotIds[ENGAGEMENT_CANDIDATE_CAP]
    );
  });

  it("serves the stored scores: new views do not change the ranking until a refresh", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const a = await makeLot(t, auctionId, 1);
    const b = await makeLot(t, auctionId, 2);
    await seedSignals(t, a, { watchers: 1 });
    await refresh(t);

    await t.run((ctx) =>
      ctx.db.insert("counters", {
        name: viewCounterName(b),
        total: 10_000,
        updatedAt: Date.now(),
      })
    );
    const stale = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
      limit: 2,
    });
    expect(stale.map((r) => r.lot._id)).toEqual([a, b]);

    await refresh(t);
    const fresh = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
      limit: 2,
    });
    expect(fresh.map((r) => r.lot._id)).toEqual([b, a]);
  });

  it("skips lots that left the sale or were hidden since the last refresh", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const gone = await makeLot(t, auctionId, 1);
    const hidden = await makeLot(t, auctionId, 2);
    const ok = await makeLot(t, auctionId, 3);
    await seedSignals(t, gone, { bids: 3 });
    await seedSignals(t, hidden, { bids: 2 });
    await seedSignals(t, ok, { bids: 1 });
    await refresh(t);

    await t.run(async (ctx) => {
      await ctx.db.patch("lots", gone, { status: "sold" });
      await ctx.db.patch("lots", hidden, { hiddenByFlags: true });
    });
    const result = await t.query(api.engagement.getMostEngagedLots, {
      auctionId,
      limit: 3,
    });
    expect(result.map((r) => r.lot._id)).toEqual([ok]);
  });
});

describe("valid-bid counter", () => {
  const ADMIN = "admin_1";

  /**
   * Places two bidders' bids on a lot with a proxy so three valid bids exist.
   *
   * @param t - Test context
   * @param lotId - The lot
   */
  async function placeBids(t: TestContext, lotId: Id<"lots">): Promise<void> {
    await t.run(async (ctx) => {
      // A standing proxy only counts while its owner may bid.
      const now = Date.now();
      await ctx.db.insert("profiles", {
        userId: "bidder_a",
        role: "buyer",
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("registrationDeposits", {
        userId: "bidder_a",
        reference: "AB-22222",
        status: "received",
        amount: 5000,
        createdAt: now,
        updatedAt: now,
      });
      await handleNewBid(ctx, lotId, "bidder_a", 500, 1000);
      await handleNewBid(ctx, lotId, "bidder_b", 600);
    });
  }

  /**
   * Reads a lot's `bids:` counter total.
   *
   * @param t - Test context
   * @param lotId - The lot
   * @returns The total, 0 when absent
   */
  async function bidTotal(t: TestContext, lotId: Id<"lots">): Promise<number> {
    return await t.run(async (ctx) => {
      const row = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", bidCounterName(lotId)))
        .unique();
      return row?.total ?? 0;
    });
  }

  it("counts manual and proxy auto bids as they are inserted", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    await placeBids(t, lotId);

    const bids = await t.run((ctx) => ctx.db.query("bids").collect());
    expect(bids).toHaveLength(3); // A 500, B 600, A auto 650
    expect(await bidTotal(t, lotId)).toBe(3);
  });

  it("decrements when an admin voids a bid and not on a repeat void", async () => {
    const t = makeContext();
    await t.run((ctx) =>
      ctx.db.insert("profiles", {
        userId: ADMIN,
        role: "admin",
        isVerified: true,
        kycStatus: "verified",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    await placeBids(t, lotId);
    const [first] = await t.run((ctx) => ctx.db.query("bids").collect());
    const admin = t.withIdentity({ subject: ADMIN });

    await admin.mutation(api.admin.mutations.voidBid, {
      bidId: first._id,
      reason: "test",
    });
    expect(await bidTotal(t, lotId)).toBe(2);
    await admin.mutation(api.admin.mutations.voidBid, {
      bidId: first._id,
      reason: "again",
    });
    expect(await bidTotal(t, lotId)).toBe(2);
  });

  it("is removed with the lot's other watch data", async () => {
    const t = makeContext();
    const auctionId = await makeAuction(t);
    const lotId = await makeLot(t, auctionId, 1);
    const otherId = await makeLot(t, auctionId, 2);
    await seedSignals(t, lotId, { bids: 2, watchers: 1 });
    await seedSignals(t, otherId, { bids: 1 });
    await t.mutation(internal.engagement.refreshEngagementScores, {});
    expect(await scoreRows(t)).toHaveLength(2);

    await t.run((ctx) => removeLotWatchData(ctx, lotId));

    expect(await bidTotal(t, lotId)).toBe(0);
    expect(await bidTotal(t, otherId)).toBe(1);
    expect((await scoreRows(t)).map((r) => r.lotId)).toEqual([otherId]);
  });
});
