/// <reference types="vite/client" />

/**
 * Integration coverage (real in-memory Convex backend) for the per-sale
 * buyer-visible lot counter (`lots:<auctionId>`): every path that changes it,
 * the backfill, and the public reads that now show the exact count instead of
 * the capped "20+".
 */

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import { settleLot } from "./auctions/internal";
import { AUCTION_SUMMARY_LOT_CAP } from "./constants";
import {
  auctionLotCounterName,
  getAuctionLotCount,
  syncAuctionLotCount,
} from "./lib/lotCounters";
import { backfillAuctionLotCountsHandler } from "./migrations";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

const ADMIN = "user_admin";
const SELLER = "user_seller";

const createTestContext = () => convexTest(schema, modules);
type TestContext = ReturnType<typeof createTestContext>;

type LotStatus =
  "approved" | "pending_review" | "assigned" | "sold" | "unsold" | "rejected";

interface World {
  categoryId: Id<"equipmentCategories">;
  auctionA: Id<"auctions">;
  auctionB: Id<"auctions">;
}

/**
 * Seeds an admin, a seller, a category and two published sales.
 *
 * @param t - The convex-test context.
 * @returns The created category and sales.
 */
async function seedWorld(t: TestContext): Promise<World> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    for (const [userId, role] of [
      [ADMIN, "admin"],
      [SELLER, "seller"],
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
    const categoryId = await ctx.db.insert("equipmentCategories", {
      name: "Tractors",
      isActive: true,
    });
    const auction = (title: string) =>
      ctx.db.insert("auctions", {
        title,
        status: "published",
        startTime: now - 60_000,
        endTime: now + 600_000,
        createdBy: ADMIN,
        createdAt: now,
        updatedAt: now,
      });
    return {
      categoryId,
      auctionA: await auction("Sale A"),
      auctionB: await auction("Sale B"),
    };
  });
}

/**
 * Inserts a lot straight into the table (no counter is touched).
 *
 * @param t - The convex-test context.
 * @param world - Seeded fixtures.
 * @param overrides - Per-lot fields.
 * @param overrides.status - Lot status.
 * @param overrides.auctionId - Parent sale.
 * @param overrides.hidden - Whether flags hide the lot.
 * @returns The new lot id.
 */
async function insertLot(
  t: TestContext,
  world: World,
  overrides: {
    status?: LotStatus;
    auctionId?: Id<"auctions">;
    hidden?: boolean;
  } = {}
): Promise<Id<"lots">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("lots", {
      title: "Tractor",
      make: "John Deere",
      model: "8R",
      year: 2020,
      operatingHours: 10,
      location: "Pretoria",
      categoryId: world.categoryId,
      reservePrice: 100,
      startingPrice: 100,
      currentPrice: 100,
      minIncrement: 10,
      sellerId: SELLER,
      status: overrides.status ?? "approved",
      auctionId: overrides.auctionId,
      hiddenByFlags: overrides.hidden,
      images: { additional: [] },
      createdAt: Date.now(),
    })
  );
}

/**
 * Reads a sale's counter row straight from the database.
 *
 * @param t - The convex-test context.
 * @param auctionId - The sale.
 * @returns The stored count, or null when there is no counter row.
 */
const counterOf = (t: TestContext, auctionId: Id<"auctions">) =>
  t.run(async (ctx) => getAuctionLotCount(ctx, auctionId));

const asAdmin = (t: TestContext) => t.withIdentity({ subject: ADMIN });

/** Result of one backfill batch. */
interface BatchOutcome {
  processed: number;
  updated: number;
  isDone: boolean;
  continueCursor: string | null;
}

/**
 * Runs the backfill to completion, one sale per batch.
 *
 * @param t - The convex-test context.
 * @returns Total sales processed and counters changed.
 */
async function runBackfill(t: TestContext) {
  let cursor: string | null = null;
  let processed = 0;
  let updated = 0;
  for (let guard = 0; guard < 20; guard++) {
    const at: string | null = cursor;
    const batch: BatchOutcome = await t.run(
      async (ctx): Promise<BatchOutcome> =>
        backfillAuctionLotCountsHandler(ctx, { cursor: at })
    );
    processed += batch.processed;
    updated += batch.updated;
    if (batch.isDone) break;
    cursor = batch.continueCursor;
  }
  return { processed, updated };
}

describe("per-sale visible lot counter", () => {
  it("counts up on assign and down on unassign, per sale", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const [l1, l2, other] = await Promise.all([
      insertLot(t, world, { status: "approved" }),
      insertLot(t, world, { status: "approved" }),
      insertLot(t, world, { status: "approved" }),
    ]);
    const assign = (lotId: Id<"lots">, auctionId: Id<"auctions">) =>
      asAdmin(t).mutation(
        api.auctions.mutations.assignment.assignLotToAuction,
        { lotId, auctionId }
      );

    await assign(l1, world.auctionA);
    await assign(l2, world.auctionA);
    await assign(other, world.auctionB);
    expect(await counterOf(t, world.auctionA)).toBe(2);
    expect(await counterOf(t, world.auctionB)).toBe(1);

    await asAdmin(t).mutation(api.auctions.mutations.assignment.unassignLot, {
      lotId: l1,
    });
    expect(await counterOf(t, world.auctionA)).toBe(1);
    expect(await counterOf(t, world.auctionB)).toBe(1);
  });

  it("keeps a sold lot counted and drops an unsold one that leaves the sale", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const sold = await insertLot(t, world, {
      status: "assigned",
      auctionId: world.auctionA,
    });
    const unsold = await insertLot(t, world, {
      status: "assigned",
      auctionId: world.auctionA,
    });
    await runBackfill(t);
    expect(await counterOf(t, world.auctionA)).toBe(2);

    // A real winning bid above the reserve settles the first lot as sold.
    await t.run(async (ctx) => {
      await ctx.db.insert("bids", {
        lotId: sold,
        bidderId: "user_buyer",
        amount: 500,
        timestamp: Date.now(),
        status: "valid",
      });
    });
    await t.run(async (ctx) => {
      const lot = await ctx.db.get("lots", sold);
      if (!lot) throw new Error("lot missing");
      expect(await settleLot(ctx, lot, Date.now())).toBe("sold");
    });
    expect(await counterOf(t, world.auctionA)).toBe(2);

    // No bids: unsold, returned to the pool with its sale cleared.
    await t.run(async (ctx) => {
      const lot = await ctx.db.get("lots", unsold);
      if (!lot) throw new Error("lot missing");
      expect(await settleLot(ctx, lot, Date.now())).toBe("unsold");
    });
    expect(await counterOf(t, world.auctionA)).toBe(1);
  });

  it("follows admin status edits, single and bulk, and recounts a missing counter", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const a = await insertLot(t, world, {
      status: "approved",
      auctionId: world.auctionA,
    });
    const b = await insertLot(t, world, {
      status: "approved",
      auctionId: world.auctionA,
    });
    // No counter row yet: the first change recounts from the table.
    expect(await counterOf(t, world.auctionA)).toBeNull();

    await asAdmin(t).mutation(api.auctions.adminUpdateLot, {
      lotId: a,
      updates: { status: "assigned" },
    });
    expect(await counterOf(t, world.auctionA)).toBe(1);

    await asAdmin(t).mutation(api.auctions.bulkUpdateLots, {
      lotIds: [a, b],
      updates: { status: "sold" },
    });
    expect(await counterOf(t, world.auctionA)).toBe(2);

    await asAdmin(t).mutation(api.auctions.bulkUpdateLots, {
      lotIds: [a, b],
      updates: { status: "rejected" },
    });
    expect(await counterOf(t, world.auctionA)).toBe(0);
  });

  it("moves a lot's count between sales and handles insert and delete", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    await runBackfill(t);

    await t.run(async (ctx) => {
      const inA = { status: "assigned", auctionId: world.auctionA } as const;
      const inB = { status: "assigned", auctionId: world.auctionB } as const;
      await syncAuctionLotCount(ctx, null, inA);
      await syncAuctionLotCount(ctx, null, inA);
      await syncAuctionLotCount(ctx, inA, inB);
      // A hidden lot never counts.
      await syncAuctionLotCount(ctx, null, { ...inA, hiddenByFlags: true });
      // Same sale, still counted: nothing changes.
      await syncAuctionLotCount(ctx, inA, { ...inA, status: "sold" });
      await syncAuctionLotCount(ctx, inB, null);
    });
    expect(await counterOf(t, world.auctionA)).toBe(1);
    expect(await counterOf(t, world.auctionB)).toBe(0);
  });

  it("never lets a counter go below zero", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    await runBackfill(t);
    await t.run(async (ctx) => {
      await syncAuctionLotCount(
        ctx,
        { status: "assigned", auctionId: world.auctionA },
        null
      );
    });
    expect(await counterOf(t, world.auctionA)).toBe(0);
  });
});

describe("backfillAuctionLotCounts", () => {
  it("counts assigned, sold and unsold lots, skips hidden and other states, and is idempotent", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const inA = (status: LotStatus, hidden?: boolean) =>
      insertLot(t, world, { status, auctionId: world.auctionA, hidden });
    await Promise.all([
      inA("assigned"),
      inA("assigned"),
      inA("sold"),
      inA("unsold"),
      inA("assigned", true),
      inA("approved"),
      inA("rejected"),
      insertLot(t, world, { status: "assigned", auctionId: world.auctionB }),
      insertLot(t, world, { status: "approved" }),
    ]);

    const first = await runBackfill(t);
    expect(first).toEqual({ processed: 2, updated: 2 });
    expect(await counterOf(t, world.auctionA)).toBe(4);
    expect(await counterOf(t, world.auctionB)).toBe(1);

    const second = await runBackfill(t);
    expect(second).toEqual({ processed: 2, updated: 0 });
  });

  it("repairs a drifted counter", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    await insertLot(t, world, {
      status: "assigned",
      auctionId: world.auctionA,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("counters", {
        name: auctionLotCounterName(world.auctionA),
        total: 40,
        active: 0,
        pending: 0,
        verified: 0,
        open: 0,
        resolved: 0,
        draft: 0,
        salesVolume: 0,
        soldCount: 0,
        buyerTotal: 0,
        sellerTotal: 0,
        updatedAt: Date.now(),
      });
    });
    await runBackfill(t);
    expect(await counterOf(t, world.auctionA)).toBe(1);
  });
});

describe("exact lot counts in the public reads", () => {
  it("shows the exact count past the summary cap once the counter exists", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const total = AUCTION_SUMMARY_LOT_CAP + 62; // 82, as on the live sale
    await Promise.all(
      Array.from({ length: total }, () =>
        insertLot(t, world, { status: "assigned", auctionId: world.auctionA })
      )
    );
    const listing = () =>
      t.query(api.auctions.getPublishedAuctions, {
        paginationOpts: { numItems: 10, cursor: null },
        status: "active",
      });
    const sale = async () =>
      (await listing()).page.find((a) => a._id === world.auctionA);

    // Before the backfill the capped read is the fallback.
    expect(await sale()).toMatchObject({
      lotCount: AUCTION_SUMMARY_LOT_CAP,
      lotCountCapped: true,
    });

    await runBackfill(t);
    expect(await sale()).toMatchObject({
      lotCount: total,
      lotCountCapped: false,
    });

    const facets = await t.query(api.auctions.getEventFacets, {
      auctionId: world.auctionA,
    });
    expect(facets).toMatchObject({ total, capped: false });
  });

  it("does not expose a draft sale's lot count through the public facets", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const draft = await t.run(async (ctx) =>
      ctx.db.insert("auctions", {
        title: "Draft sale",
        status: "draft",
        startTime: Date.now() + 60_000,
        endTime: Date.now() + 600_000,
        createdBy: ADMIN,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );
    await insertLot(t, world, { status: "assigned", auctionId: draft });
    await runBackfill(t);
    expect(await counterOf(t, draft)).toBe(1);

    const facets = await t.query(api.auctions.getEventFacets, {
      auctionId: draft,
    });
    expect(facets).toMatchObject({ total: 0 });
  });
});
