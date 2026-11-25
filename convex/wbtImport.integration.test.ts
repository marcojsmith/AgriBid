/// <reference types="vite/client" />

/**
 * Integration coverage (real in-memory Convex backend) for the
 * webuytractors.shop demo import, the weekly re-time and the multi-sale
 * featured lot.
 */

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { MS_PER_DAY } from "./constants";
import { buildLotInput, type RawLot } from "./lib/wbtImport";

const modules = import.meta.glob("./**/*.*s");

const createTestContext = () => convexTest(schema, modules);
type TestContext = ReturnType<typeof createTestContext>;

/**
 * Builds a raw lot for `buildLotInput`.
 * @param overrides - Fields to override
 * @returns A raw lot
 */
function raw(overrides: Partial<RawLot> = {}): RawLot {
  return {
    lotNumber: 1,
    title: "Massey Ferguson 290",
    make: "Massey Ferguson",
    model: "290",
    year: null,
    hours: null,
    category: null,
    town: "Pretoria",
    province: null,
    price: 100000,
    openingBid: 100000,
    description: null,
    photos: ["https://x.test/a.jpg"],
    sourceUrl: "https://auctions.webuytractors.shop/ui/auctions/1",
    bidwranglerItemId: 1,
    reserveSet: true,
    ...overrides,
  };
}

/**
 * Stores a tiny file so lots can hold real storage ids.
 * @param t - Test context
 * @returns The storage id
 */
async function storePhoto(t: TestContext): Promise<string> {
  return await t.run(async (ctx) => ctx.storage.store(new Blob(["x"])));
}

/**
 * Creates the seller and one sale of the given role.
 * @param t - Test context
 * @param role - Timeline role
 * @param seedId - Sale key
 * @param closedOrder - Closed order
 * @returns The auction id
 */
async function makeSale(
  t: TestContext,
  role: "live" | "upcoming" | "closed",
  seedId: string,
  closedOrder = 0
): Promise<Id<"auctions">> {
  await t.mutation(internal.wbtImport.ensureSeller, {});
  return await t.mutation(internal.wbtImport.upsertSale, {
    seedId,
    role,
    closedOrder,
    title: `Sale ${seedId}`,
    description: "d",
  });
}

describe("wbtImport", () => {
  it("creates the seller once, with VAT defaults and no contact details", async () => {
    const t = createTestContext();
    await t.mutation(internal.wbtImport.ensureSeller, {});
    await t.mutation(internal.wbtImport.ensureSeller, {});
    const sellers = await t.run((ctx) =>
      ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", "wbt-seller"))
        .collect()
    );
    expect(sellers).toHaveLength(1);
    expect(sellers[0]).toMatchObject({
      name: "We Buy Tractors",
      sellerType: "farming_business",
      vatRegistered: true,
    });
    expect(sellers[0].email).toBeUndefined();
    expect(sellers[0].phoneNumber).toBeUndefined();
  });

  it("fills missing VAT fields on an existing seller without overwriting", async () => {
    const t = createTestContext();
    await t.run((ctx) =>
      ctx.db.insert("profiles", {
        userId: "wbt-seller",
        role: "seller",
        isVerified: true,
        vatRegistered: false,
        createdAt: 1,
        updatedAt: 1,
      })
    );
    await t.mutation(internal.wbtImport.ensureSeller, {});
    const seller = await t.run((ctx) =>
      ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", "wbt-seller"))
        .unique()
    );
    expect(seller).toMatchObject({
      vatRegistered: false,
      sellerType: "farming_business",
    });
  });

  it("upserts a sale on its key and places it on the timeline", async () => {
    const t = createTestContext();
    const live = await makeSale(t, "live", "wbt:auction:1");
    const again = await makeSale(t, "live", "wbt:auction:1");
    expect(again).toBe(live);
    const sale = await t.run((ctx) => ctx.db.get("auctions", live));
    expect(sale?.status).toBe("published");
    expect(sale?.endTime).toBeGreaterThan(Date.now());
    expect(sale?.defaultBuyerPremiumPct).toBe(0.12);
    const closed = await makeSale(t, "closed", "wbt:auction:2", 1);
    expect((await t.run((ctx) => ctx.db.get("auctions", closed)))?.status).toBe(
      "closed"
    );
    await expect(
      t.mutation(internal.wbtImport.upsertSale, {
        seedId: "other:1",
        role: "live",
        closedOrder: 0,
        title: "x",
        description: "x",
      })
    ).rejects.toThrow(/prefix/);
  });

  it("imports lots idempotently with the auction premium snapshot", async () => {
    const t = createTestContext();
    const sale = await makeSale(t, "live", "wbt:auction:1");
    const photo = await storePhoto(t);
    const lots = [
      buildLotInput(raw(), { role: "live", seedId: "wbt:auction:1" }, 0, 2, 4, [
        photo,
      ]),
      buildLotInput(
        raw({ bidwranglerItemId: 2, lotNumber: 9, title: "Ford 5000" }),
        { role: "live", seedId: "wbt:auction:1" },
        1,
        2,
        9,
        [photo]
      ),
    ];
    const first = await t.mutation(internal.wbtImport.upsertLots, {
      auctionId: sale,
      lots,
    });
    expect(first).toEqual({ created: 2, updated: 0 });
    const second = await t.mutation(internal.wbtImport.upsertLots, {
      auctionId: sale,
      lots: lots.map((lot) => ({ ...lot, photos: [] })),
    });
    expect(second).toEqual({ created: 0, updated: 2 });

    const stored = await t.run((ctx) => ctx.db.query("lots").collect());
    expect(stored).toHaveLength(2);
    for (const lot of stored) {
      expect(lot).toMatchObject({
        sellerId: "wbt-seller",
        resolvedBuyerPremiumPct: 0.12,
        premiumSource: "auction",
        commissionSource: "auction",
        sellerVatRegistered: true,
        sellerType: "farming_business",
        status: "assigned",
        year: 0,
      });
      // Empty photos on a re-run keep what is stored.
      expect(lot.images).toMatchObject({ front: photo });
    }
    const counter = await t.run((ctx) =>
      ctx.db
        .query("counters")
        .filter((q) => q.eq(q.field("name"), `lotNumber:${sale}`))
        .unique()
    );
    expect(counter?.total).toBe(9);

    const listed = await t.query(internal.wbtImport.listImportedLots, {});
    expect(listed).toEqual(
      expect.arrayContaining([{ seedId: "wbt:lot:1", photoCount: 1 }])
    );
  });

  it("re-import keeps the price, status and bids of a lot a real person bid on", async () => {
    const t = createTestContext();
    const sale = await makeSale(t, "live", "wbt:auction:1");
    const photo = await storePhoto(t);
    const lots = [
      buildLotInput(raw(), { role: "live", seedId: "wbt:auction:1" }, 0, 1, 1, [
        photo,
      ]),
    ];
    await t.mutation(internal.wbtImport.upsertLots, { auctionId: sale, lots });
    const [lot] = await t.run((ctx) => ctx.db.query("lots").collect());
    await t.run(async (ctx) => {
      await ctx.db.insert("bids", {
        lotId: lot._id,
        bidderId: "user_real",
        amount: 77000,
        timestamp: Date.now(),
        status: "valid",
      });
      await ctx.db.insert("bids", {
        lotId: lot._id,
        bidderId: "mock-buyer-1",
        amount: 1000,
        timestamp: Date.now(),
        status: "valid",
      });
      await ctx.db.patch("lots", lot._id, { currentPrice: 77000 });
    });
    await t.mutation(internal.wbtImport.upsertLots, {
      auctionId: sale,
      lots: lots.map((l) => ({ ...l, title: "Renamed", photos: [] })),
    });
    const after = await t.run((ctx) => ctx.db.get("lots", lot._id));
    expect(after).toMatchObject({ title: "Renamed", currentPrice: 77000 });
    const bids = await t.run((ctx) => ctx.db.query("bids").collect());
    expect(bids).toHaveLength(2);
  });

  it("re-import replaces demo bids with the one winning bid on a sold lot", async () => {
    const t = createTestContext();
    const sale = await makeSale(t, "closed", "wbt:auction:2", 1);
    const closed = { role: "closed" as const, seedId: "wbt:auction:2" };
    const lots = [
      buildLotInput(
        raw({
          lotStatus: "sold",
          price: 50000,
          openingBid: 40000,
          bidCount: 3,
        }),
        closed,
        0,
        1,
        1,
        []
      ),
    ];
    await t.mutation(internal.wbtImport.upsertLots, { auctionId: sale, lots });
    await t.mutation(internal.wbtImport.upsertLots, { auctionId: sale, lots });
    const bids = await t.run((ctx) => ctx.db.query("bids").collect());
    expect(bids).toHaveLength(1);
    expect(bids[0].amount).toBe(50000);
  });

  it("records closed outcomes from real prices with one winning bid", async () => {
    const t = createTestContext();
    const sale = await makeSale(t, "closed", "wbt:auction:2", 1);
    const closed = { role: "closed" as const, seedId: "wbt:auction:2" };
    const lots = [
      buildLotInput(
        raw({
          bidwranglerItemId: 10,
          lotStatus: "sold",
          price: 265000,
          openingBid: 220000,
          bidCount: 4,
        }),
        closed,
        0,
        2,
        1,
        []
      ),
      buildLotInput(
        raw({
          bidwranglerItemId: 11,
          lotNumber: 2,
          lotStatus: "no_sale",
          price: 30000,
          openingBid: 30000,
          highestBid: 60000,
          bidCount: 11,
        }),
        closed,
        1,
        2,
        2,
        []
      ),
    ];
    await t.mutation(internal.wbtImport.upsertLots, { auctionId: sale, lots });
    await t.mutation(internal.wbtImport.upsertLots, { auctionId: sale, lots });

    const stored = await t.run((ctx) => ctx.db.query("lots").collect());
    const sold = stored.find((l) => l.seedId === "wbt:lot:10");
    const unsold = stored.find((l) => l.seedId === "wbt:lot:11");
    expect(sold).toMatchObject({ status: "sold", currentPrice: 265000 });
    expect(typeof sold?.winnerId).toBe("string");
    expect(unsold).toMatchObject({ status: "unsold", currentPrice: 60000 });
    expect(unsold?.winnerId).toBeUndefined();

    const bids = await t.run((ctx) => ctx.db.query("bids").collect());
    expect(bids).toHaveLength(1);
    expect(bids[0]).toMatchObject({ lotId: sold?._id, amount: 265000 });

    const soldCounter = await t.run((ctx) =>
      ctx.db
        .query("counters")
        .filter((q) => q.eq(q.field("name"), `bids:${String(sold?._id)}`))
        .unique()
    );
    expect(soldCounter?.total).toBe(4);
  });

  it("rejects bad input", async () => {
    const t = createTestContext();
    const sale = await makeSale(t, "live", "wbt:auction:1");
    const base = buildLotInput(
      raw(),
      { role: "live", seedId: "wbt:auction:1" },
      0,
      1,
      1,
      []
    );
    await expect(
      t.mutation(internal.wbtImport.upsertLots, {
        auctionId: sale,
        lots: Array.from({ length: 21 }, (_, i) => ({
          ...base,
          seedId: `wbt:lot:x${i.toString()}`,
        })),
      })
    ).rejects.toThrow(/At most/);
    await expect(
      t.mutation(internal.wbtImport.upsertLots, {
        auctionId: sale,
        lots: [{ ...base, seedId: "nope:1" }],
      })
    ).rejects.toThrow(/prefix/);
    await expect(
      t.mutation(internal.wbtImport.upsertLots, {
        auctionId: sale,
        lots: [{ ...base, category: "Spaceships" }],
      })
    ).rejects.toThrow(/Unknown category/);
    const plain = await t.run((ctx) =>
      ctx.db.insert("auctions", {
        title: "Plain",
        startTime: 1,
        endTime: 2,
        status: "draft",
        createdBy: "x",
        createdAt: 1,
        updatedAt: 1,
      })
    );
    await expect(
      t.mutation(internal.wbtImport.upsertLots, {
        auctionId: plain,
        lots: [base],
      })
    ).rejects.toThrow(/Not an imported sale/);
  });

  it("requires the seller before importing lots", async () => {
    const t = createTestContext();
    const sale = await t.run((ctx) =>
      ctx.db.insert("auctions", {
        title: "S",
        seedId: "wbt:auction:9",
        startTime: 1,
        endTime: 2,
        status: "draft",
        createdBy: "x",
        createdAt: 1,
        updatedAt: 1,
      })
    );
    await expect(
      t.mutation(internal.wbtImport.upsertLots, {
        auctionId: sale,
        lots: [
          buildLotInput(
            raw(),
            { role: "live", seedId: "wbt:auction:9" },
            0,
            1,
            1,
            []
          ),
        ],
      })
    ).rejects.toThrow(/ensureSeller/);
  });

  it("recalculates dashboard counters from the tables on finalize", async () => {
    const t = createTestContext();
    const sale = await makeSale(t, "closed", "wbt:auction:2", 1);
    await t.mutation(internal.wbtImport.upsertLots, {
      auctionId: sale,
      lots: [
        buildLotInput(
          raw({
            lotStatus: "sold",
            price: 50000,
            openingBid: 40000,
            bidCount: 1,
          }),
          { role: "closed", seedId: "wbt:auction:2" },
          0,
          1,
          1,
          []
        ),
      ],
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("supportTickets", {
        userId: "u",
        subject: "s",
        message: "m",
        priority: "low",
        status: "open",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("supportTickets", {
        userId: "u",
        subject: "s2",
        message: "m",
        priority: "low",
        status: "resolved",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("profiles", {
        userId: "p",
        role: "buyer",
        isVerified: false,
        kycStatus: "pending",
        createdAt: 1,
        updatedAt: 1,
      });
    });
    await t.mutation(internal.wbtImport.finalizeImport, {});
    const counters = await t.run((ctx) => ctx.db.query("counters").collect());
    const total = (
      name: string,
      field: "total" | "open" | "pending" | "soldCount"
    ) => counters.find((c) => c.name === name)?.[field];
    expect(total("lots", "total")).toBe(1);
    expect(total("lots", "soldCount")).toBe(1);
    expect(total("bids", "total")).toBe(1);
    expect(total("support", "open")).toBe(1);
    expect(total("profiles", "pending")).toBe(1);
  });

  it("mints an upload url and finalizes counters", async () => {
    const t = createTestContext();
    const url = await t.mutation(internal.wbtImport.generateUploadUrl, {});
    expect(typeof url).toBe("string");
    await expect(
      t.mutation(internal.wbtImport.finalizeImport, {})
    ).resolves.toBeNull();
  });
});

describe("retireOldDemo", () => {
  /**
   * Seeds an old demo lot and sale, a user lot, and an imported lot.
   * @param t - Test context
   * @returns The ids
   */
  async function seedOld(t: TestContext) {
    return await t.run(async (ctx) => {
      const base = {
        make: "m",
        model: "m",
        year: 2000,
        operatingHours: 1,
        location: "US",
        reservePrice: 1,
        startingPrice: 1,
        currentPrice: 1,
        minIncrement: 1,
        sellerId: "s",
        status: "assigned" as const,
        images: { additional: [] },
      };
      const old = await ctx.db.insert("lots", {
        ...base,
        title: "Old US lot",
        seedId: "jd-s780",
      });
      const user = await ctx.db.insert("lots", { ...base, title: "User lot" });
      const imported = await ctx.db.insert("lots", {
        ...base,
        title: "Imported",
        seedId: "wbt:lot:1",
      });
      await ctx.db.insert("bids", {
        lotId: old,
        bidderId: "mock-buyer-1",
        amount: 1,
        timestamp: 1,
      });
      await ctx.db.insert("proxy_bids", {
        lotId: old,
        bidderId: "mock-buyer-1",
        maxBid: 5,
        updatedAt: 1,
      });
      await ctx.db.insert("lotFlags", {
        lotId: old,
        reporterId: "r",
        reason: "other",
        status: "pending",
        createdAt: 1,
      });
      const feeId = await ctx.db.insert("platformFees", {
        name: "f",
        feeType: "percentage",
        value: 0.1,
        appliesTo: "buyer",
        isActive: false,
        visibleToBuyer: true,
        visibleToSeller: true,
        sortOrder: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("lotFees", {
        lotId: old,
        feeId,
        feeName: "f",
        appliedTo: "buyer",
        feeType: "percentage",
        rate: 0.1,
        salePrice: 1,
        calculatedAmount: 0.1,
        createdAt: 1,
      });
      const oldSale = await ctx.db.insert("auctions", {
        title: "Telehandler Closeout",
        startTime: 1,
        endTime: 2,
        status: "closed",
        createdBy: "x",
        createdAt: 1,
        updatedAt: 1,
      });
      const userSale = await ctx.db.insert("auctions", {
        title: "My own sale",
        startTime: 1,
        endTime: 2,
        status: "draft",
        createdBy: "x",
        createdAt: 1,
        updatedAt: 1,
      });
      return { old, user, imported, oldSale, userSale };
    });
  }

  it("lists but does not delete by default", async () => {
    const t = createTestContext();
    const ids = await seedOld(t);
    const report = await t.mutation(internal.wbtImport.retireOldDemo, {});
    expect(report.applied).toBe(false);
    expect(report.rows.map((r) => r.id).sort()).toEqual(
      [ids.old, ids.oldSale].sort()
    );
    expect(await t.run((ctx) => ctx.db.get("lots", ids.old))).not.toBeNull();
  });

  it("keeps an old demo lot a real buyer has a payment on (and its sale)", async () => {
    const t = createTestContext();
    const ids = await seedOld(t);
    await t.run(async (ctx) => {
      await ctx.db.patch("lots", ids.old, {
        auctionId: ids.oldSale,
        status: "sold",
        winnerId: "real-buyer",
      });
      await ctx.db.insert("lotPayments", {
        lotId: ids.old,
        buyerId: "real-buyer",
        sellerId: "s",
        reference: "AB-KEPT1",
        bid: 1,
        premium: 0,
        vat: 0,
        total: 1,
        depositCredit: 0,
        amountDue: 1,
        vatKind: "vat",
        status: "awaiting",
        payBy: 2,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const dry = await t.mutation(internal.wbtImport.retireOldDemo, {});
    const report = await t.mutation(internal.wbtImport.retireOldDemo, {
      apply: true,
    });

    expect(dry.keptWithPayment).toBe(1);
    expect(report.keptWithPayment).toBe(1);
    expect(report.rows).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get("lots", ids.old))).not.toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("lotPayments").collect())
    ).toHaveLength(1);
    expect(
      await t.run((ctx) => ctx.db.get("auctions", ids.oldSale))
    ).not.toBeNull();
  });

  it("keeps an old demo lot a real buyer has a payment on (and its sale)", async () => {
    const t = createTestContext();
    const ids = await seedOld(t);
    await t.run(async (ctx) => {
      await ctx.db.patch("lots", ids.old, {
        auctionId: ids.oldSale,
        status: "sold",
        winnerId: "real-buyer",
      });
      await ctx.db.insert("lotPayments", {
        lotId: ids.old,
        buyerId: "real-buyer",
        sellerId: "s",
        reference: "AB-KEPT1",
        bid: 1,
        premium: 0,
        vat: 0,
        total: 1,
        depositCredit: 0,
        amountDue: 1,
        vatKind: "vat",
        status: "awaiting",
        payBy: 2,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const dry = await t.mutation(internal.wbtImport.retireOldDemo, {});
    const report = await t.mutation(internal.wbtImport.retireOldDemo, {
      apply: true,
    });

    expect(dry.keptWithPayment).toBe(1);
    expect(report.keptWithPayment).toBe(1);
    expect(report.rows).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get("lots", ids.old))).not.toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("lotPayments").collect())
    ).toHaveLength(1);
    expect(
      await t.run((ctx) => ctx.db.get("auctions", ids.oldSale))
    ).not.toBeNull();
  });

  it("leaves an old-titled sale alone while it still holds another lot", async () => {
    const t = createTestContext();
    const ids = await seedOld(t);
    await t.run((ctx) =>
      ctx.db.patch("lots", ids.user, { auctionId: ids.oldSale })
    );
    const report = await t.mutation(internal.wbtImport.retireOldDemo, {
      apply: true,
    });
    expect(report.rows.map((r) => r.id)).toEqual([ids.old]);
    expect(
      await t.run((ctx) => ctx.db.get("auctions", ids.oldSale))
    ).not.toBeNull();
  });

  it("deletes only old demo rows when applied", async () => {
    const t = createTestContext();
    const ids = await seedOld(t);
    const report = await t.mutation(internal.wbtImport.retireOldDemo, {
      apply: true,
    });
    expect(report.applied).toBe(true);
    expect(await t.run((ctx) => ctx.db.get("lots", ids.old))).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.get("auctions", ids.oldSale))
    ).toBeNull();
    expect(await t.run((ctx) => ctx.db.get("lots", ids.user))).not.toBeNull();
    expect(
      await t.run((ctx) => ctx.db.get("lots", ids.imported))
    ).not.toBeNull();
    expect(
      await t.run((ctx) => ctx.db.get("auctions", ids.userSale))
    ).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.query("bids").collect())).toHaveLength(
      0
    );
    expect(
      await t.run((ctx) => ctx.db.query("lotFees").collect())
    ).toHaveLength(0);
  });
});

describe("wbtDemo", () => {
  /**
   * Imports `count` live lots with real photos.
   * @param t - Test context
   * @param count - How many lots
   * @returns The sale id
   */
  async function importLive(t: TestContext, count: number) {
    const sale = await makeSale(t, "live", "wbt:auction:1");
    const photo = await storePhoto(t);
    const lots = Array.from({ length: count }, (_, i) =>
      buildLotInput(
        raw({
          bidwranglerItemId: 100 + i,
          lotNumber: i + 1,
          title: `Tractor ${i.toString()}`,
        }),
        { role: "live", seedId: "wbt:auction:1" },
        i,
        count,
        i + 1,
        [photo, photo, photo, photo]
      )
    );
    for (let i = 0; i < lots.length; i += 20) {
      await t.mutation(internal.wbtImport.upsertLots, {
        auctionId: sale,
        lots: lots.slice(i, i + 20),
      });
    }
    return sale;
  }

  it("only decorates good machines: 4+ photos and no non-runner or spares", async () => {
    const t = createTestContext();
    const sale = await makeSale(t, "live", "wbt:auction:1");
    const photo = await storePhoto(t);
    const four = [photo, photo, photo, photo];
    const specs: [string, string[]][] = [
      ["John Deere 6130", four],
      ["Tractor Loader - NON RUNNER", four],
      ["Case 580 for spares", four],
      ["Ford 5000 (two photos)", [photo, photo]],
    ];
    const lots = specs.map(([title, photos], i) =>
      buildLotInput(
        raw({ bidwranglerItemId: 300 + i, lotNumber: i + 1, title }),
        { role: "live", seedId: "wbt:auction:1" },
        i,
        specs.length,
        i + 1,
        photos
      )
    );
    await t.mutation(internal.wbtImport.upsertLots, { auctionId: sale, lots });
    const decorated = await t.mutation(internal.wbtDemo.seedLiveDemo, {
      auctionId: sale,
    });
    expect(decorated).toBe(1);
    const bids = await t.run((ctx) => ctx.db.query("bids").collect());
    const biddedTitles = await Promise.all(
      [...new Set(bids.map((b) => b.lotId))].map(
        async (id) => (await t.run((ctx) => ctx.db.get("lots", id)))?.title
      )
    );
    expect(biddedTitles).toEqual(["John Deere 6130"]);
  });

  it("decorates a few live lots with demo bids and watchers, then resets them", async () => {
    const t = createTestContext();
    const sale = await importLive(t, 30);
    const decorated = await t.mutation(internal.wbtDemo.seedLiveDemo, {
      auctionId: sale,
    });
    expect(decorated).toBe(12);
    // Running again decorates nothing new (lots already have bids).
    expect(
      await t.mutation(internal.wbtDemo.seedLiveDemo, { auctionId: sale })
    ).toBe(0);

    const bids = await t.run((ctx) => ctx.db.query("bids").collect());
    expect(bids.length).toBeGreaterThanOrEqual(24);
    expect(bids.every((b) => b.bidderId.startsWith("mock-"))).toBe(true);

    // A real bid on one lot: the reset must leave that lot alone.
    const bidLot = bids[0].lotId;
    await t.run(async (ctx) => {
      await ctx.db.insert("bids", {
        lotId: bidLot,
        bidderId: "user_real",
        amount: 999999,
        timestamp: Date.now(),
        status: "valid",
      });
      await ctx.db.patch("lots", bidLot, { currentPrice: 999999 });
    });

    await t.run(async (ctx) => {
      for (const lot of await ctx.db.query("lots").collect()) {
        await ctx.db.patch("lots", lot._id, { closingSoonNotifiedAt: 1 });
      }
    });
    const end = Date.now() + 6 * MS_PER_DAY;

    await t.mutation(internal.wbtDemo.retimeBatch, {
      auctionId: sale,

      role: "live",

      startTime: Date.now() - 2 * MS_PER_DAY,
      endTime: end,
      status: "published",
      afterLotNumber: 0,
    });
    const after = await t.run((ctx) => ctx.db.query("bids").collect());
    expect(after.filter((b) => b.bidderId.startsWith("mock-"))).toHaveLength(0);
    expect(after.filter((b) => b.bidderId === "user_real")).toHaveLength(1);
    const lots = await t.run((ctx) => ctx.db.query("lots").collect());
    for (const lot of lots) {
      if (lot._id === bidLot) expect(lot.currentPrice).toBe(999999);
      else expect(lot.currentPrice).toBe(lot.startingPrice);
    }
    const watchers = await t.run((ctx) => ctx.db.query("watchlist").collect());
    expect(watchers).toHaveLength(0);
    const auction = await t.run((ctx) => ctx.db.get("auctions", sale));
    expect(auction?.endTime).toBe(end);
    // Re-timed open lots get their closing-soon alert again.
    expect(
      lots
        .filter((lot) => lot._id !== bidLot)
        .every((lot) => lot.closingSoonNotifiedAt === undefined)
    ).toBe(true);
  });

  it("reverts lots settled while the sale was past due and keeps real watchers", async () => {
    const t = createTestContext();
    const sale = await importLive(t, 3);
    const lots = await t.run((ctx) => ctx.db.query("lots").collect());
    await t.run(async (ctx) => {
      await ctx.db.patch("lots", lots[0]._id, {
        status: "unsold",
        settledAt: 5,
        currentPrice: 12345,
      });
      await ctx.db.insert("watchlist", {
        userId: "user_real",
        lotId: lots[0]._id,
      });
      await ctx.db.insert("watchlist", {
        userId: "mock-buyer-1",
        lotId: lots[0]._id,
      });
    });
    await t.mutation(internal.wbtDemo.retimeBatch, {
      auctionId: sale,
      role: "upcoming",
      startTime: Date.now() + MS_PER_DAY,
      endTime: Date.now() + 5 * MS_PER_DAY,
      status: "published",
      afterLotNumber: 0,
    });
    const reset = await t.run((ctx) => ctx.db.get("lots", lots[0]._id));
    expect(reset).toMatchObject({ status: "assigned" });
    expect(reset?.currentPrice).toBe(reset?.startingPrice);
    expect(reset?.settledAt).toBeUndefined();
    const watch = await t.run((ctx) => ctx.db.query("watchlist").collect());
    expect(watch.map((w) => w.userId)).toEqual(["user_real"]);
  });

  it("reopens a lot under consideration whose only bids were demo bids", async () => {
    const t = createTestContext();
    const sale = await importLive(t, 2);
    const lots = await t.run((ctx) => ctx.db.query("lots").collect());
    const target = lots[0];
    await t.run(async (ctx) => {
      await ctx.db.insert("counters", {
        name: "lots",
        total: 2,
        active: 1,
        soldCount: 0,
        salesVolume: 0,
        updatedAt: 1,
      });
      await ctx.db.insert("bids", {
        lotId: target._id,
        bidderId: "mock-buyer-1",
        amount: 60000,
        timestamp: 1,
        status: "valid",
      });
      await ctx.db.patch("lots", target._id, {
        status: "under_consideration",
        winnerId: "mock-buyer-1",
        currentPrice: 60000,
        settledAt: 5,
        considerationDeadline: Date.now() + MS_PER_DAY,
      });
    });

    await t.mutation(internal.wbtDemo.retimeBatch, {
      auctionId: sale,
      role: "upcoming",
      startTime: Date.now() + MS_PER_DAY,
      endTime: Date.now() + 5 * MS_PER_DAY,
      status: "published",
      afterLotNumber: 0,
    });

    const reset = await t.run((ctx) => ctx.db.get("lots", target._id));
    expect(reset?.status).toBe("assigned");
    expect(reset?.winnerId).toBeUndefined();
    expect(reset?.currentPrice).toBe(reset?.startingPrice);
    expect(reset?.considerationDeadline).toBeUndefined();
    const counter = await t.run((ctx) =>
      ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", "lots"))
        .unique()
    );
    // Entering consideration released the slot; reopening takes it back.
    expect(counter?.active).toBe(2);
  });

  it("keeps a lot under consideration pointed at the best real bid after the reset", async () => {
    const t = createTestContext();
    const sale = await importLive(t, 1);
    const [lot] = await t.run((ctx) => ctx.db.query("lots").collect());
    const deadline = Date.now() + MS_PER_DAY;
    await t.run(async (ctx) => {
      await ctx.db.insert("bids", {
        lotId: lot._id,
        bidderId: "user_real",
        amount: 50000,
        timestamp: 1,
        status: "valid",
      });
      await ctx.db.insert("bids", {
        lotId: lot._id,
        bidderId: "mock-buyer-1",
        amount: 60000,
        timestamp: 2,
        status: "valid",
      });
      await ctx.db.patch("lots", lot._id, {
        status: "under_consideration",
        winnerId: "mock-buyer-1",
        currentPrice: 60000,
        settledAt: 5,
        considerationDeadline: deadline,
      });
    });

    await t.mutation(internal.wbtDemo.retimeBatch, {
      auctionId: sale,
      role: "upcoming",
      startTime: Date.now() + MS_PER_DAY,
      endTime: Date.now() + 5 * MS_PER_DAY,
      status: "published",
      afterLotNumber: 0,
    });

    const after = await t.run((ctx) => ctx.db.get("lots", lot._id));
    expect(after?.status).toBe("under_consideration");
    expect(after?.winnerId).toBe("user_real");
    expect(after?.currentPrice).toBe(50000);
    expect(after?.considerationDeadline).toBe(deadline);
  });

  it("shifts a closed lot's consideration deadline with its settle time", async () => {
    const t = createTestContext();
    const sale = await makeSale(t, "closed", "wbt:auction:3", 1);
    const closed = { role: "closed" as const, seedId: "wbt:auction:3" };
    await t.mutation(internal.wbtImport.upsertLots, {
      auctionId: sale,
      lots: [
        buildLotInput(
          raw({ bidwranglerItemId: 400, lotNumber: 1, lotStatus: "sold" }),
          closed,
          0,
          1,
          1,
          []
        ),
      ],
    });
    const [lot] = await t.run((ctx) => ctx.db.query("lots").collect());
    const deadline = Date.now() + MS_PER_DAY;
    await t.run(async (ctx) => {
      await ctx.db.patch("lots", lot._id, {
        status: "under_consideration",
        settledAt: 1000,
        considerationDeadline: deadline,
      });
    });
    const sold = await t.run((ctx) => ctx.db.get("auctions", sale));
    const newEnd = (sold?.endTime ?? 0) - 7 * MS_PER_DAY;

    await t.mutation(internal.wbtDemo.retimeBatch, {
      auctionId: sale,
      role: "closed",
      startTime: newEnd - 4 * MS_PER_DAY,
      endTime: newEnd,
      status: "closed",
      afterLotNumber: 0,
    });

    const after = await t.run((ctx) => ctx.db.get("lots", lot._id));
    expect(after?.status).toBe("under_consideration");
    expect(after?.considerationDeadline).toBe(deadline - 7 * MS_PER_DAY);
    expect(after?.settledAt).toBe(1000 - 7 * MS_PER_DAY);
  });

  it("shifts closed sales without touching outcomes and chains batches", async () => {
    const t = createTestContext();
    const sale = await makeSale(t, "closed", "wbt:auction:2", 1);
    const closed = { role: "closed" as const, seedId: "wbt:auction:2" };
    const lots = Array.from({ length: 3 }, (_, i) =>
      buildLotInput(
        raw({
          bidwranglerItemId: 200 + i,
          lotNumber: i + 1,
          lotStatus: "sold",
          price: 50000,
          openingBid: 40000,
          bidCount: 2,
        }),
        closed,
        i,
        3,
        i + 1,
        []
      )
    );
    await t.mutation(internal.wbtImport.upsertLots, { auctionId: sale, lots });
    const before = await t.run((ctx) => ctx.db.query("lots").collect());
    const beforeAuction = await t.run((ctx) => ctx.db.get("auctions", sale));
    const newEnd = (beforeAuction?.endTime ?? 0) - 28 * MS_PER_DAY;
    await t.mutation(internal.wbtDemo.retimeBatch, {
      auctionId: sale,
      role: "closed",
      startTime: newEnd - 4 * MS_PER_DAY,
      endTime: newEnd,
      status: "closed",
      afterLotNumber: 0,
    });
    const after = await t.run((ctx) => ctx.db.query("lots").collect());
    for (const lot of after) {
      const old = before.find((l) => l._id === lot._id);
      expect(lot.status).toBe("sold");
      expect(lot.currentPrice).toBe(50000);
      expect((lot.settledAt ?? 0) - (old?.settledAt ?? 0)).toBe(
        -28 * MS_PER_DAY
      );
    }
    const bids = await t.run((ctx) => ctx.db.query("bids").collect());
    expect(bids).toHaveLength(3);
    // Not an imported sale: ignored.
    const plain = await t.run((ctx) =>
      ctx.db.insert("auctions", {
        title: "Plain",
        startTime: 1,
        endTime: 2,
        status: "draft",
        createdBy: "x",
        createdAt: 1,
        updatedAt: 1,
      })
    );
    await expect(
      t.mutation(internal.wbtDemo.retimeBatch, {
        auctionId: plain,
        role: "live",
        startTime: 1,
        endTime: 5,
        status: "published",
        afterLotNumber: 0,
      })
    ).resolves.toBeNull();
    await expect(
      t.mutation(internal.wbtDemo.seedLiveDemo, { auctionId: plain })
    ).resolves.toBe(0);
  });

  it("chains to the next batch when a sale has more than one batch of lots", async () => {
    const t = createTestContext();
    const sale = await importLive(t, 105);
    await t.mutation(internal.wbtDemo.retimeBatch, {
      auctionId: sale,
      role: "upcoming",
      startTime: Date.now() + MS_PER_DAY,
      endTime: Date.now() + 5 * MS_PER_DAY,
      status: "published",
      afterLotNumber: 0,
    });
    // The first batch moves the sale itself straight away, so the settle
    // cron never sees a past-due sale with freshly reset lots.
    const auction = await t.run((ctx) => ctx.db.get("auctions", sale));
    expect(auction?.startTime).toBeGreaterThan(Date.now());
    await t.mutation(internal.wbtDemo.retimeBatch, {
      auctionId: sale,
      role: "upcoming",
      startTime: Date.now() + MS_PER_DAY,
      endTime: Date.now() + 5 * MS_PER_DAY,
      status: "published",
      afterLotNumber: 100,
      delta: 0,
    });
    const done = await t.run((ctx) => ctx.db.get("auctions", sale));
    expect(done?.startTime).toBeGreaterThan(Date.now());
  });
});

describe("getMostEngagedLotAcrossSales", () => {
  it("returns the highest-scoring open lot across sales, or null", async () => {
    const t = createTestContext();
    expect(
      await t.query(api.engagement.getMostEngagedLotAcrossSales, {
        auctionIds: [],
      })
    ).toBeNull();

    const photo = await storePhoto(t);
    const saleA = await makeSale(t, "live", "wbt:auction:1");
    const saleB = await makeSale(t, "live", "wbt:auction:3");
    for (const [sale, id, number] of [
      [saleA, 1, 1],
      [saleB, 2, 1],
    ] as const) {
      await t.mutation(internal.wbtImport.upsertLots, {
        auctionId: sale,
        lots: [
          buildLotInput(
            raw({
              bidwranglerItemId: id,
              lotNumber: number,
              title: `Lot ${id.toString()}`,
            }),
            { role: "live", seedId: "wbt:auction:1" },
            0,
            1,
            number,
            [photo]
          ),
        ],
      });
    }
    const lots = await t.run((ctx) => ctx.db.query("lots").collect());
    const hidden = lots.find((l) => l.seedId === "wbt:lot:1");
    const top = lots.find((l) => l.seedId === "wbt:lot:2");
    if (!hidden || !top) throw new Error("lots missing");
    await t.run(async (ctx) => {
      await ctx.db.insert("engagementScores", {
        lotId: hidden._id,
        auctionId: saleA,
        bids: 9,
        watchers: 9,
        views: 9,
        score: 50,
        updatedAt: 1,
      });
      await ctx.db.insert("engagementScores", {
        lotId: top._id,
        auctionId: saleB,
        bids: 2,
        watchers: 2,
        views: 2,
        score: 30,
        updatedAt: 1,
      });
      // The best-scoring lot is hidden by moderation: the next one wins.
      await ctx.db.patch("lots", hidden._id, { hiddenByFlags: true });
    });
    const result = await t.query(api.engagement.getMostEngagedLotAcrossSales, {
      auctionIds: [saleA, saleB],
    });
    expect(result?.lot._id).toBe(top._id);
    expect(result?.score).toBe(30);

    await t.run((ctx) =>
      ctx.db.patch("lots", top._id, { hiddenByFlags: true })
    );
    expect(
      await t.query(api.engagement.getMostEngagedLotAcrossSales, {
        auctionIds: [saleA, saleB],
      })
    ).toBeNull();
  });
});
