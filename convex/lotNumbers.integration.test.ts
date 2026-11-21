/// <reference types="vite/client" />

/**
 * Integration coverage (real in-memory Convex backend) for WP3b: lot numbers,
 * province, seller response time and per-lot watcher counts, plus the two
 * backfill migrations.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import { LOT_NUMBER_BACKFILL_BATCH } from "./migrations";
import { adjustWatcherCount, getWatcherCount } from "./lib/lotCounters";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

const ADMIN = "user_admin";
const SELLER = "user_seller";
const BUYER_A = "user_buyer_a";
const BUYER_B = "user_buyer_b";

const createTestContext = () => convexTest(schema, modules);
type TestContext = ReturnType<typeof createTestContext>;

interface World {
  categoryId: Id<"equipmentCategories">;
  auctionA: Id<"auctions">;
  auctionB: Id<"auctions">;
}

/**
 * Seeds profiles for every actor, a category and two published auctions.
 *
 * @param t - The convex-test context.
 * @returns The created category and auctions.
 */
async function seedWorld(t: TestContext): Promise<World> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const users: { userId: string; role: "buyer" | "seller" | "admin" }[] = [
      { userId: ADMIN, role: "admin" },
      { userId: SELLER, role: "seller" },
      { userId: BUYER_A, role: "buyer" },
      { userId: BUYER_B, role: "buyer" },
    ];
    for (const user of users) {
      await ctx.db.insert("profiles", {
        userId: user.userId,
        name: user.userId,
        role: user.role,
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
 * Inserts a lot.
 *
 * @param t - The convex-test context.
 * @param world - Seeded fixtures.
 * @param overrides - Per-lot fields.
 * @param overrides.status - Lot status.
 * @param overrides.auctionId - Parent auction.
 * @param overrides.lotNumber - Existing lot number.
 * @param overrides.images - Front image URL list.
 * @param overrides.title - Lot title.
 * @returns The new lot id.
 */
async function insertLot(
  t: TestContext,
  world: World,
  overrides: {
    status?: "approved" | "assigned" | "sold" | "unsold";
    auctionId?: Id<"auctions">;
    lotNumber?: number;
    images?: string[];
    title?: string;
  } = {}
): Promise<Id<"lots">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("lots", {
      title: overrides.title ?? "Tractor",
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
      lotNumber: overrides.lotNumber,
      images: { front: overrides.images?.[0], additional: [] },
      createdAt: Date.now(),
    })
  );
}

/**
 * Reads a lot's number straight from the database.
 *
 * @param t - The convex-test context.
 * @param lotId - The lot.
 * @returns Its `lotNumber`.
 */
const lotNumberOf = async (t: TestContext, lotId: Id<"lots">) =>
  // `t.run` serialises results, turning `undefined` into `null`.
  (await t.run(async (ctx) => (await ctx.db.get("lots", lotId))?.lotNumber)) ??
  undefined;

const asAdmin = (t: TestContext) => t.withIdentity({ subject: ADMIN });

afterEach(() => {
  vi.useRealTimers();
});

describe("lot number assignment", () => {
  it("numbers lots 1..n per sale, never reuses numbers and clears on unassign", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const [l1, l2, l3, other] = await Promise.all([
      insertLot(t, world),
      insertLot(t, world),
      insertLot(t, world),
      insertLot(t, world),
    ]);

    await asAdmin(t).mutation(
      api.auctions.mutations.assignment.assignLotToAuction,
      {
        lotId: l1,
        auctionId: world.auctionA,
      }
    );
    await asAdmin(t).mutation(
      api.auctions.mutations.assignment.assignLotToAuction,
      {
        lotId: l2,
        auctionId: world.auctionA,
      }
    );
    await asAdmin(t).mutation(
      api.auctions.mutations.assignment.assignLotToAuction,
      {
        lotId: l3,
        auctionId: world.auctionA,
      }
    );
    // A different sale has its own sequence.
    await asAdmin(t).mutation(
      api.auctions.mutations.assignment.assignLotToAuction,
      {
        lotId: other,
        auctionId: world.auctionB,
      }
    );

    expect(await lotNumberOf(t, l1)).toBe(1);
    expect(await lotNumberOf(t, l2)).toBe(2);
    expect(await lotNumberOf(t, l3)).toBe(3);
    expect(await lotNumberOf(t, other)).toBe(1);

    // Unassigning clears the number and does not re-pack the rest.
    await asAdmin(t).mutation(api.auctions.mutations.assignment.unassignLot, {
      lotId: l2,
    });
    expect(await lotNumberOf(t, l2)).toBeUndefined();
    expect(await lotNumberOf(t, l3)).toBe(3);

    // The freed number is not handed out again; re-assigning gets a new one.
    await asAdmin(t).mutation(
      api.auctions.mutations.assignment.assignLotToAuction,
      {
        lotId: l2,
        auctionId: world.auctionA,
      }
    );
    expect(await lotNumberOf(t, l2)).toBe(4);
  });

  it("issues distinct numbers for concurrent assignments", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lots = await Promise.all(
      Array.from({ length: 5 }, () => insertLot(t, world))
    );

    await Promise.all(
      lots.map((lotId) =>
        asAdmin(t).mutation(
          api.auctions.mutations.assignment.assignLotToAuction,
          {
            lotId,
            auctionId: world.auctionA,
          }
        )
      )
    );

    const numbers = await Promise.all(lots.map((id) => lotNumberOf(t, id)));
    expect([...numbers].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("clears the lot number when an unsold lot leaves its sale at settlement", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lot = await insertLot(t, world);
    await asAdmin(t).mutation(
      api.auctions.mutations.assignment.assignLotToAuction,
      {
        lotId: lot,
        auctionId: world.auctionA,
      }
    );
    expect(await lotNumberOf(t, lot)).toBe(1);

    await t.run(async (ctx) => {
      const { settleLot } = await import("./auctions/internal");
      const doc = await ctx.db.get("lots", lot);
      if (!doc) throw new Error("missing lot");
      await settleLot(ctx, doc, Date.now());
    });

    const settled = await t.run(async (ctx) => ctx.db.get("lots", lot));
    expect(settled?.status).toBe("unsold");
    expect(settled?.auctionId).toBeUndefined();
    expect(settled?.lotNumber).toBeUndefined();
  });

  it("exposes lotNumber, province and watcherCount on the public lot query", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lot = await insertLot(t, world);
    await asAdmin(t).mutation(
      api.auctions.mutations.assignment.assignLotToAuction,
      {
        lotId: lot,
        auctionId: world.auctionA,
      }
    );
    await asAdmin(t).mutation(api.auctions.adminUpdateLot, {
      lotId: lot,
      updates: { province: "western_cape" },
    });
    await t
      .withIdentity({ subject: BUYER_A })
      .mutation(api.watchlist.toggleWatchlist, { lotId: lot });

    const detail = await t.query(api.auctions.getLotById, { lotId: lot });
    expect(detail?.lotNumber).toBe(1);
    expect(detail?.province).toBe("western_cape");
    expect(detail?.watcherCount).toBe(1);
  });
});

describe("lot number backfill", () => {
  it("numbers un-numbered lots by creation order, skips numbered ones and is idempotent", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const a1 = await insertLot(t, world, {
      status: "assigned",
      auctionId: world.auctionA,
    });
    const a2 = await insertLot(t, world, {
      status: "sold",
      auctionId: world.auctionA,
    });
    const a3 = await insertLot(t, world, {
      status: "unsold",
      auctionId: world.auctionA,
    });
    const b1 = await insertLot(t, world, {
      status: "assigned",
      auctionId: world.auctionB,
    });
    const pool = await insertLot(t, world, { status: "approved" });
    const numbered = await insertLot(t, world, {
      status: "assigned",
      auctionId: world.auctionB,
      lotNumber: 7,
    });

    const first = await t.mutation(internal.migrations.backfillLotNumbers, {});
    expect(first.isDone).toBe(true);
    expect(first.updated).toBe(4);

    expect(await lotNumberOf(t, a1)).toBe(1);
    expect(await lotNumberOf(t, a2)).toBe(2);
    expect(await lotNumberOf(t, a3)).toBe(3);
    expect(await lotNumberOf(t, b1)).toBeDefined();
    expect(await lotNumberOf(t, numbered)).toBe(7);
    expect(await lotNumberOf(t, pool)).toBeUndefined();

    // Sale B keeps unique numbers and its counter sits above the existing 7.
    const bNumbers = [b1, numbered].map((id) => lotNumberOf(t, id));
    expect(new Set(await Promise.all(bNumbers)).size).toBe(2);
    const next = await insertLot(t, world);
    await asAdmin(t).mutation(
      api.auctions.mutations.assignment.assignLotToAuction,
      {
        lotId: next,
        auctionId: world.auctionB,
      }
    );
    expect(await lotNumberOf(t, next)).toBeGreaterThan(7);

    const snapshot = await Promise.all(
      [a1, a2, a3, b1, numbered].map((id) => lotNumberOf(t, id))
    );
    const second = await t.mutation(internal.migrations.backfillLotNumbers, {});
    expect(second.updated).toBe(0);
    expect(
      await Promise.all(
        [a1, a2, a3, b1, numbered].map((id) => lotNumberOf(t, id))
      )
    ).toEqual(snapshot);
  });

  it("batches large tables and reschedules itself until done", async () => {
    vi.useFakeTimers();
    const t = createTestContext();
    const world = await seedWorld(t);
    const total = LOT_NUMBER_BACKFILL_BATCH * 2 + 5;
    await t.run(async (ctx) => {
      for (let i = 0; i < total; i++) {
        await ctx.db.insert("lots", {
          title: `Lot ${String(i)}`,
          make: "M",
          model: "X",
          year: 2020,
          operatingHours: 1,
          location: "L",
          reservePrice: 1,
          startingPrice: 1,
          currentPrice: 1,
          minIncrement: 1,
          sellerId: SELLER,
          status: "assigned",
          auctionId: world.auctionA,
          images: { additional: [] },
        });
      }
    });

    const first = await t.mutation(internal.migrations.backfillLotNumbers, {});
    expect(first.isDone).toBe(false);
    expect(first.processed).toBe(LOT_NUMBER_BACKFILL_BATCH);
    expect(first.continueCursor).not.toBeNull();

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const numbers = await t.run(async (ctx) =>
      (await ctx.db.query("lots").collect()).map((lot) => lot.lotNumber)
    );
    expect(numbers.every((n) => typeof n === "number")).toBe(true);
    expect(new Set(numbers).size).toBe(total);
    expect(Math.max(...(numbers as number[]))).toBe(total);
  });
});

describe("lot province", () => {
  it("lets an admin set a province and rejects unknown values", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lot = await insertLot(t, world);

    await asAdmin(t).mutation(api.auctions.adminUpdateLot, {
      lotId: lot,
      updates: { province: "gauteng" },
    });
    const stored = await t.run(async (ctx) => ctx.db.get("lots", lot));
    expect(stored?.province).toBe("gauteng");

    await expect(
      asAdmin(t).mutation(api.auctions.adminUpdateLot, {
        lotId: lot,
        updates: { province: "narnia" as never },
      })
    ).rejects.toThrow();
  });

  it("rejects province changes from non-admins", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lot = await insertLot(t, world);

    await expect(
      t
        .withIdentity({ subject: BUYER_A })
        .mutation(api.auctions.adminUpdateLot, {
          lotId: lot,
          updates: { province: "gauteng" },
        })
    ).rejects.toThrow();
  });
});

describe("seller response time", () => {
  it("rejects non-admins", async () => {
    const t = createTestContext();
    await seedWorld(t);

    await expect(
      t
        .withIdentity({ subject: SELLER })
        .mutation(api.admin.setSellerResponseTime, {
          userId: SELLER,
          responseTime: "within_day",
        })
    ).rejects.toThrow();
  });

  it("lets an admin set and clear it, writes audit entries and surfaces it publicly", async () => {
    const t = createTestContext();
    await seedWorld(t);

    await asAdmin(t).mutation(api.admin.setSellerResponseTime, {
      userId: SELLER,
      responseTime: "within_day",
    });
    const info = await t.query(api.auctions.getSellerInfo, {
      sellerId: SELLER,
    });
    expect(info?.sellerResponseTime).toBe("within_day");

    await asAdmin(t).mutation(api.admin.setSellerResponseTime, {
      userId: SELLER,
      responseTime: null,
    });
    const cleared = await t.query(api.auctions.getSellerInfo, {
      sellerId: SELLER,
    });
    expect(cleared?.sellerResponseTime).toBeUndefined();

    const logs = await t.run(async (ctx) =>
      ctx.db
        .query("auditLogs")
        .collect()
        .then((rows) =>
          rows.filter((row) => row.action === "SET_SELLER_RESPONSE_TIME")
        )
    );
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      adminId: ADMIN,
      targetId: SELLER,
      targetType: "profile",
    });
    expect(JSON.parse(logs[0].details ?? "{}")).toEqual({
      from: null,
      to: "within_day",
    });
  });

  it("rejects unknown values and unknown profiles", async () => {
    const t = createTestContext();
    await seedWorld(t);

    await expect(
      asAdmin(t).mutation(api.admin.setSellerResponseTime, {
        userId: SELLER,
        responseTime: "instantly" as never,
      })
    ).rejects.toThrow();
    await expect(
      asAdmin(t).mutation(api.admin.setSellerResponseTime, {
        userId: "nobody",
        responseTime: "within_day",
      })
    ).rejects.toThrow("Profile not found");
  });
});

describe("profile queries with a response time set", () => {
  it("still returns the seller's own profile and the KYC profile", async () => {
    const t = createTestContext();
    await seedWorld(t);
    await asAdmin(t).mutation(api.admin.setSellerResponseTime, {
      userId: SELLER,
      responseTime: "slower",
    });

    const mine = await t
      .withIdentity({ subject: SELLER })
      .query(api.users.getMyProfile, {});
    expect(mine?.profile?.sellerResponseTime).toBe("slower");

    const listed = await asAdmin(t).query(api.users.listAllProfiles, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(
      listed.page.find((p) => p.userId === SELLER)?.sellerResponseTime
    ).toBe("slower");

    // The admin KYC fetch spreads the whole profile through ProfileValidator.
    const forKyc = await asAdmin(t).mutation(api.users.getProfileForKYC, {
      userId: SELLER,
    });
    expect(forKyc?.sellerResponseTime).toBe("slower");
  });
});

describe("submitting a draft for review", () => {
  it("requires a province", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotId = await t.run(async (ctx) =>
      ctx.db.insert("lots", {
        title: "Draft tractor",
        make: "M",
        model: "X",
        year: 2020,
        operatingHours: 1,
        location: "Pretoria",
        categoryId: world.categoryId,
        description: "A description",
        reservePrice: 100,
        startingPrice: 100,
        currentPrice: 100,
        minIncrement: 10,
        sellerId: SELLER,
        status: "draft",
        images: { front: "https://img.test/a.jpg", additional: [] },
        createdAt: Date.now(),
      })
    );
    const seller = t.withIdentity({ subject: SELLER });

    await expect(
      seller.mutation(api.lots.mutations.lifecycle.submitLotForReview, {
        lotId,
      })
    ).rejects.toThrow("Province is required");

    await t.run(async (ctx) =>
      ctx.db.patch("lots", lotId, { province: "gauteng" })
    );
    const result = await seller.mutation(
      api.lots.mutations.lifecycle.submitLotForReview,
      { lotId }
    );
    expect(result.success).toBe(true);
  });
});

describe("watcher counts", () => {
  it("tracks watch and unwatch per lot", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lot = await insertLot(t, world);
    const buyerA = t.withIdentity({ subject: BUYER_A });
    const buyerB = t.withIdentity({ subject: BUYER_B });
    const count = () => t.run(async (ctx) => getWatcherCount(ctx, lot));

    expect(await count()).toBe(0);
    expect(
      await buyerA.mutation(api.watchlist.toggleWatchlist, { lotId: lot })
    ).toBe(true);
    expect(
      await buyerB.mutation(api.watchlist.toggleWatchlist, { lotId: lot })
    ).toBe(true);
    expect(await count()).toBe(2);

    expect(
      await buyerA.mutation(api.watchlist.toggleWatchlist, { lotId: lot })
    ).toBe(false);
    expect(await count()).toBe(1);

    // Toggling again re-watches rather than double-counting.
    expect(
      await buyerA.mutation(api.watchlist.toggleWatchlist, { lotId: lot })
    ).toBe(true);
    expect(await count()).toBe(2);
  });

  it("never goes below zero", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lot = await insertLot(t, world);

    await t.run(async (ctx) => {
      await adjustWatcherCount(ctx, lot, -1);
      await adjustWatcherCount(ctx, lot, -1);
    });
    expect(await t.run(async (ctx) => getWatcherCount(ctx, lot))).toBe(0);

    await t.run(async (ctx) => {
      await adjustWatcherCount(ctx, lot, 1);
      await adjustWatcherCount(ctx, lot, -1);
      await adjustWatcherCount(ctx, lot, -1);
    });
    expect(await t.run(async (ctx) => getWatcherCount(ctx, lot))).toBe(0);
  });

  it("rejects watching a lot that does not exist", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lot = await insertLot(t, world);
    await t.run(async (ctx) => ctx.db.delete("lots", lot));

    await expect(
      t
        .withIdentity({ subject: BUYER_A })
        .mutation(api.watchlist.toggleWatchlist, { lotId: lot })
    ).rejects.toThrow("Lot not found");
  });

  it("rebuilds counters from watchlist rows, idempotently", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    const lotA = await insertLot(t, world);
    const lotB = await insertLot(t, world);
    const lotC = await insertLot(t, world);

    await t.run(async (ctx) => {
      for (const userId of [BUYER_A, BUYER_B, "user_c"]) {
        await ctx.db.insert("watchlist", { userId, lotId: lotA });
      }
      await ctx.db.insert("watchlist", { userId: BUYER_A, lotId: lotB });
      const now = Date.now();
      // Stale counters: wrong total on A, a counter for a lot nobody watches.
      await ctx.db.insert("counters", {
        name: `watchers:${lotA}`,
        total: 9,
        updatedAt: now,
      });
      await ctx.db.insert("counters", {
        name: `watchers:${lotC}`,
        total: 4,
        updatedAt: now,
      });
    });

    const first = await t.mutation(
      internal.migrations.backfillWatcherCounts,
      {}
    );
    expect(first.isDone).toBe(true);

    const read = (lotId: Id<"lots">) =>
      t.run(async (ctx) => getWatcherCount(ctx, lotId));
    expect(await read(lotA)).toBe(3);
    expect(await read(lotB)).toBe(1);
    expect(await read(lotC)).toBe(0);

    const second = await t.mutation(
      internal.migrations.backfillWatcherCounts,
      {}
    );
    expect(second.updated).toBe(0);
    expect(await read(lotA)).toBe(3);
  });
});

describe("event summary lead-photo ordering", () => {
  it("orders lots by lotNumber, falling back to creation order", async () => {
    const t = createTestContext();
    const world = await seedWorld(t);
    // Creation order: unnumbered, #2, #1. Expected photo order: #1, #2, unnumbered.
    await insertLot(t, world, {
      status: "assigned",
      auctionId: world.auctionA,
      images: ["https://img.test/unnumbered.jpg"],
    });
    await insertLot(t, world, {
      status: "assigned",
      auctionId: world.auctionA,
      lotNumber: 2,
      images: ["https://img.test/two.jpg"],
    });
    await insertLot(t, world, {
      status: "assigned",
      auctionId: world.auctionA,
      lotNumber: 1,
      images: ["https://img.test/one.jpg"],
    });

    const result = await t.query(api.auctions.getPublishedAuctions, {
      paginationOpts: { numItems: 10, cursor: null },
      status: "active",
    });
    const sale = result.page.find((a) => a._id === world.auctionA);
    expect(sale?.leadImageUrls).toEqual([
      "https://img.test/one.jpg",
      "https://img.test/two.jpg",
      "https://img.test/unnumbered.jpg",
    ]);
  });
});
