import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { runSeed, weeklyReset, clearAuctions, clearAllData } from "./seed";
import * as auth from "./lib/auth";
import { issueNextLotNumber } from "./lib/lotCounters";
import * as adminUtils from "./admin_utils";
import type { MutationCtx } from "./_generated/server";

vi.mock("./_generated/server", () => ({
  query: vi.fn((q: unknown) => q),
  mutation: vi.fn((m: unknown) => m),
  internalMutation: vi.fn((m: unknown) => m),
}));

vi.mock("./lib/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getCallerRole: vi.fn(),
}));

vi.mock("./admin_utils", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  logAudit: vi.fn(),
}));

type MockRow = { _id: string } & Record<string, unknown>;

interface MockIndexFilter {
  eq: (field: string, value: unknown) => MockIndexFilter;
  gte: (field: string, value: string) => MockIndexFilter;
  lt: (field: string, value: string) => MockIndexFilter;
}

interface MockQueryFilter {
  field: (name: string) => { __mockField: string };
  eq: (left: unknown, right: unknown) => void;
}

/**
 * Creates a lightweight in-memory Convex-style database mock that supports the
 * query builder surface used by `performSeed`/`weeklyReset` (withIndex,
 * filter, first, unique, collect, take) plus insert/patch/delete/get, with
 * real field matching so index lookups behave like the real thing.
 *
 * @returns The mock database handle with `db` (context-shaped) and `rows`
 * (direct table access for assertions).
 */
function createMockDb() {
  let nextId = 0;
  const tables = new Map<string, MockRow[]>();

  const rowsOf = (table: string): MockRow[] => {
    const existing = tables.get(table);
    if (existing) return existing;
    const created: MockRow[] = [];
    tables.set(table, created);
    return created;
  };

  const makeBuilder = (table: string) => {
    let constraints: [string, unknown][] = [];
    let ranges: ((row: MockRow) => boolean)[] = [];
    const matches = (row: MockRow) =>
      constraints.every(
        ([field, value]) => Reflect.get(row, field) === value
      ) && ranges.every((inRange) => inRange(row));

    const builder = {
      withIndex: vi.fn(
        (_indexName: string, cb?: (q: MockIndexFilter) => void) => {
          constraints = [];
          ranges = [];
          if (cb) {
            const filter: MockIndexFilter = {
              gte: (field: string, value: string) => {
                ranges.push((row) => String(Reflect.get(row, field)) >= value);
                return filter;
              },
              lt: (field: string, value: string) => {
                ranges.push((row) => String(Reflect.get(row, field)) < value);
                return filter;
              },
              eq: (field: string, value: unknown) => {
                constraints.push([field, value]);
                return filter;
              },
            };
            cb(filter);
          }
          return builder;
        }
      ),
      filter: vi.fn((cb: (q: MockQueryFilter) => unknown) => {
        cb({
          field: (name: string) => ({ __mockField: name }),
          eq: (left: unknown, right: unknown) => {
            const fieldName =
              typeof left === "object" && left !== null && "__mockField" in left
                ? (left as { __mockField: string }).__mockField
                : String(left);
            constraints.push([fieldName, right]);
          },
        });
        return builder;
      }),
      first: vi.fn(() => rowsOf(table).find(matches) ?? null),
      unique: vi.fn(() => rowsOf(table).find(matches) ?? null),
      collect: vi.fn(() => rowsOf(table).filter(matches)),
      take: vi.fn((n: number) => rowsOf(table).filter(matches).slice(0, n)),
    };
    return builder;
  };

  const db = {
    query: vi.fn((table: string) => makeBuilder(table)),
    insert: vi.fn((table: string, doc: Record<string, unknown>) => {
      nextId += 1;
      const _id = `mock-${table}-${nextId.toString()}`;
      rowsOf(table).push({ ...doc, _id });
      return _id;
    }),
    patch: vi.fn(
      (table: string, id: string, patch: Record<string, unknown>) => {
        const row = rowsOf(table).find((r) => r._id === id);
        if (row) Object.assign(row, patch);
      }
    ),
    delete: vi.fn((table: string, id: string) => {
      const rows = rowsOf(table);
      const index = rows.findIndex((r) => r._id === id);
      if (index !== -1) rows.splice(index, 1);
    }),
    get: vi.fn((table: string, id: string) => {
      return rowsOf(table).find((r) => r._id === id) ?? null;
    }),
  };

  return {
    db,
    rows: (table: string): MockRow[] => rowsOf(table),
  };
}

type MockDb = ReturnType<typeof createMockDb>;
interface MockCtx {
  db: MockDb["db"];
  storage: {
    delete: ReturnType<typeof vi.fn>;
  };
}

/**
 * Extracts the raw handler from a Convex function wrapper so tests can invoke
 * it with a mock context (the registered-function type hides `.handler`).
 *
 * @param fn - The registered Convex mutation to unwrap.
 * @returns The underlying handler function.
 */
function handlerOf(
  fn: unknown
): (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown> {
  return (
    fn as {
      handler: (
        ctx: MutationCtx,
        args: Record<string, unknown>
      ) => Promise<unknown>;
    }
  ).handler;
}

describe("Seed Coverage", () => {
  let mockDb: MockDb;
  let mockCtx: MockCtx;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {
      // Intentional no-op: suppress seed script logging during tests
    });
    vi.spyOn(console, "warn").mockImplementation(() => {
      // Intentional no-op: suppress safeDelete failure warnings during tests
    });
    mockDb = createMockDb();
    mockCtx = { db: mockDb.db, storage: { delete: vi.fn() } };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Pre-populates profiles an operator would have before a seed/reset.
   * @returns The inserted document ids for later assertions.
   */
  function seedExistingProfiles() {
    const adminId = mockDb.db.insert("profiles", {
      userId: "clerk-admin-user",
      email: "admin@agribid.com",
      name: "Showcase Admin",
      role: "admin",
      isVerified: true,
      kycStatus: "verified",
      createdAt: 1000,
      updatedAt: 1000,
    });
    const buyerId = mockDb.db.insert("profiles", {
      userId: "clerk-real-buyer",
      email: "real-buyer@example.com",
      name: "Real Buyer",
      role: "buyer",
      isVerified: true,
      kycStatus: "verified",
      kycDocuments: ["kyc-blob-1", "kyc-blob-2"],
      createdAt: 2000,
      updatedAt: 2000,
    });
    const sellerId = mockDb.db.insert("profiles", {
      userId: "clerk-mock-seller",
      email: "mock-seller@farm.com",
      name: "Farm Seller",
      role: "seller",
      isVerified: true,
      kycStatus: "verified",
      createdAt: 3000,
      updatedAt: 3000,
    });
    return { adminId, buyerId, sellerId };
  }

  /** Inserts engagement score rows and lot-scoped counters of a deleted lot. */
  function insertStaleEngagementData(): void {
    mockDb.db.insert("engagementScores", {
      lotId: "gone",
      auctionId: "gone-auction",
      bids: 1,
      watchers: 1,
      views: 1,
      score: 5,
      updatedAt: 1,
    });
    for (const name of [
      "bids:gone",
      "views:gone",
      "anonviews:gone",
      "watchers:gone",
    ]) {
      mockDb.db.insert("counters", { name, total: 4 });
    }
  }

  /** Asserts the data from `insertStaleEngagementData` was removed. */
  function expectStaleEngagementDataGone(): void {
    expect(mockDb.rows("engagementScores")).toEqual([]);
    const names = mockDb.rows("counters").map((c) => c.name);
    for (const name of [
      "bids:gone",
      "views:gone",
      "anonviews:gone",
      "watchers:gone",
    ]) {
      expect(names).not.toContain(name);
    }
  }

  function snapshotCounts(): Record<string, number> {
    const tables = [
      "auctions",
      "lots",
      "bids",
      "proxy_bids",
      "profiles",
      "reviews",
      "conversations",
      "messages",
      "notifications",
      "supportTickets",
      "userActivity",
      "lotFees",
      "platformFees",
      "counters",
    ];
    return Object.fromEntries(
      tables.map((table) => [table, mockDb.rows(table).length])
    );
  }

  describe("runSeed", () => {
    it("still throws when the Clerk-synced mock seller profile is missing", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

      await expect(
        handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {})
      ).rejects.toThrow("Mock seller profile not found");

      expect(mockDb.rows("lots").length).toBe(0);
    });

    it("seeds the full showcase via the Clerk-synced mock seller", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      const { adminId } = seedExistingProfiles();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      expect(mockDb.rows("auctions").length).toBe(7);
      expect(mockDb.rows("lots").length).toBe(29);
      expect(mockDb.rows("bids").length).toBeGreaterThan(0);
      expect(mockDb.rows("reviews").length).toBe(3);
      expect(mockDb.rows("platformFees").length).toBe(2);
      expect(mockDb.rows("lotFees").length).toBe(6);

      // The Clerk-synced profiles are reused, and no synthetic mock seller
      // stand-in is created when the real profile exists.
      const profiles = mockDb.rows("profiles");
      expect(profiles.some((p) => p._id === adminId)).toBe(true);
      expect(profiles.some((p) => p.userId === "clerk-mock-seller")).toBe(true);
      expect(profiles.some((p) => p.userId === "mock-seller")).toBe(false);

      // Synthetic buyers and extra sellers were inserted directly.
      expect(profiles.some((p) => p.userId === "mock-buyer-1")).toBe(true);
      expect(profiles.some((p) => p.userId === "mock-seller-2")).toBe(true);
      expect(profiles.some((p) => p.userId === "mock-seller-3")).toBe(true);
    });

    it("seeds only the default VAT rate, never overwrites it, and never writes business.* keys", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();
      mockDb.db.insert("settings", {
        key: "vat_rate_pct",
        value: 10,
        updatedAt: 1,
      });

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});
      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const settings = mockDb.rows("settings");
      const valueOf = (key: string) =>
        settings.find((s) => s.key === key)?.value;
      // An existing admin-set rate is kept, and nothing is duplicated.
      expect(valueOf("vat_rate_pct")).toBe(10);
      expect(settings.filter((s) => s.key === "vat_rate_pct")).toHaveLength(1);
      // Company details are real data an admin enters: no seed path invents them.
      expect(
        settings.filter((s) => String(s.key).startsWith("business."))
      ).toEqual([]);
    });

    it("weeklyReset leaves every business.* key absent and seeds the default VAT rate", async () => {
      seedExistingProfiles();

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      const settings = mockDb.rows("settings");
      expect(
        settings.filter((s) => String(s.key).startsWith("business."))
      ).toEqual([]);
      expect(settings.find((s) => s.key === "vat_rate_pct")?.value).toBe(15);
    });

    it("weeklyReset (production showcase) never invents finance contact details", async () => {
      seedExistingProfiles();

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      const settings = mockDb.rows("settings");
      expect(
        settings.filter((s) => String(s.key).startsWith("finance_contact_"))
      ).toEqual([]);
      // Built-in defaults are still seeded, identical to the app fallbacks.
      expect(settings.find((s) => s.key === "buyer_premium_pct")?.value).toBe(
        12
      );
      expect(settings.find((s) => s.key === "min_photos_per_lot")?.value).toBe(
        8
      );
    });

    it("seeds real webuytractors lots with specs and angle captions, T6070 as lot 3", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const lots = mockDb.rows("lots");
      const sale = mockDb
        .rows("auctions")
        .find((a) => a.title === "Year-End Tractor Sale");
      const live = lots.filter((l) => l.auctionId === sale?._id);
      expect(live).toHaveLength(12);

      const t6070 = live.find((l) => l.lotNumber === 3);
      expect(t6070).toMatchObject({
        title: "New Holland T6070",
        year: 2016,
        operatingHours: 4850,
        location: "Malmesbury, Western Cape",
        province: "western_cape",
        drive: "4wd",
        powerKw: 104,
        resolvedBuyerPremiumPct: 0.12,
      });
      // Only one real photo exists for the T6070: captioned, not padded.
      expect(Object.values(t6070?.imageAngles as object)).toEqual(["front"]);

      const mf455 = live.find((l) => l.seedId === "mf-455-xtra-4x4");
      const angles = mf455?.imageAngles as Record<string, string>;
      expect(Object.values(angles)).toEqual([
        "front",
        "rear",
        "left_side",
        "right_side",
        "cab_interior",
        "hour_meter",
        "engine_bay",
        "tyres",
      ]);

      for (const lot of live) {
        const images = lot.images as {
          front: string;
          engine?: string;
          cabin?: string;
          additional: string[];
        };
        const refs = [
          images.front,
          images.engine,
          images.cabin,
          ...images.additional,
        ].filter((ref): ref is string => ref !== undefined);
        expect(refs.every((ref) => ref.startsWith("https://"))).toBe(true);
        // Every caption keys one of the lot's own photos.
        expect(
          Object.keys(lot.imageAngles as object).every((key) =>
            refs.includes(key)
          )
        ).toBe(true);
        expect(typeof lot.powerKw).toBe("number");
        expect(typeof lot.serialNumber).toBe("string");
      }
    });

    it("seeds a VAT mix: private farmer, farming business and dealers", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const profiles = mockDb.rows("profiles");
      const byUser = (userId: string) =>
        profiles.find((p) => p.userId === userId);
      expect(byUser("mock-seller-4")).toMatchObject({
        sellerType: "private_farmer",
        vatRegistered: false,
      });
      expect(byUser("clerk-mock-seller")).toMatchObject({
        sellerType: "farming_business",
        vatRegistered: true,
      });
      expect(byUser("mock-seller-2")).toMatchObject({
        sellerType: "dealer",
        vatRegistered: true,
      });
    });

    it("keeps a seller type already set on the Clerk-synced seller", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      const { sellerId } = seedExistingProfiles();
      mockDb.db.patch("profiles", sellerId, {
        sellerType: "private_farmer",
        vatRegistered: false,
      });

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      expect(
        mockDb.rows("profiles").find((p) => p._id === sellerId)
      ).toMatchObject({ sellerType: "private_farmer", vatRegistered: false });
    });

    it("seeds platform settings and the DEMO finance contact without overwriting admin values", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();
      mockDb.db.insert("settings", {
        key: "finance_contact_name",
        value: "Real Person",
        updatedAt: 1,
      });
      mockDb.db.insert("settings", {
        key: "buyer_premium_pct",
        value: 9,
        updatedAt: 1,
      });

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});
      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const settings = mockDb.rows("settings");
      const row = (key: string) => settings.find((s) => s.key === key);
      expect(row("finance_contact_name")?.value).toBe("Real Person");
      expect(row("finance_contact_company")?.value).toBe("com-fin");
      expect(row("finance_contact_phone")?.value).toBe("083 277 0178");
      expect(String(row("finance_contact_company")?.description)).toContain(
        "DEMO"
      );
      expect(row("buyer_premium_pct")?.value).toBe(9);
      expect(row("deposit_enabled")?.value).toBe(true);
      expect(row("deposit_amount")?.value).toBe(5000);
      expect(row("deposit_refund_days")?.value).toBe(3);
      expect(row("seller_commission_pct")?.value).toBe(8);
      expect(row("seller_listing_fee")?.value).toBe(0);
      expect(row("seller_payout_days")?.value).toBe(7);
      expect(row("min_photos_per_lot")?.value).toBe(8);
      expect(new Set(settings.map((s) => s.key)).size).toBe(settings.length);
    });

    it("does not duplicate synthetic records when run twice without clearing", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});
      const firstSnapshot = snapshotCounts();
      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      expect(snapshotCounts()).toEqual(firstSnapshot);
    });

    it("never reuses or overwrites lot numbers when re-seeding next to real assignments", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();
      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const auctionId = mockDb
        .rows("lots")
        .map((l) => l.auctionId)
        .find((id): id is string => typeof id === "string");
      if (!auctionId) throw new Error("expected a seeded sale");

      // A real lot is assigned to the seeded sale between two seed runs.
      const realNumber = await issueNextLotNumber(
        mockCtx as unknown as MutationCtx,
        auctionId as never
      );
      await mockCtx.db.insert("lots", {
        title: "Real lot",
        status: "assigned",
        auctionId,
        lotNumber: realNumber,
      });
      const seededBefore = mockDb
        .rows("lots")
        .filter((l) => l.auctionId === auctionId && l.seedId !== undefined)
        .map((l) => [l.seedId, l.lotNumber]);

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const inSale = mockDb
        .rows("lots")
        .filter((l) => l.auctionId === auctionId);
      const numbers = inSale.map((l) => l.lotNumber);
      expect(new Set(numbers).size).toBe(numbers.length);
      expect(inSale.find((l) => l.title === "Real lot")?.lotNumber).toBe(
        realNumber
      );
      expect(
        inSale
          .filter((l) => l.seedId !== undefined)
          .map((l) => [l.seedId, l.lotNumber])
      ).toEqual(seededBefore);
    });

    it("clears every table and reseeds when clear is requested", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();
      mockDb.db.insert("auctions", {
        title: "Stale Auction",
        status: "published",
        bannerImage: "stale-banner",
      });
      mockDb.db.insert("lots", {
        title: "Stale Lot",
        status: "assigned",
        images: { additional: ["stale-image"] },
        conditionReportUrl: "stale-report",
        coldStartVideo: "stale-video",
      });
      mockDb.db.insert("lotViewers", {
        lotId: "stale-lot",
        viewerKey: "s:stale-session",
        lastViewedAt: 1,
      });
      insertStaleEngagementData();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {
        clear: true,
      });

      // Storage blobs referenced by the cleared rows are swept first.
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("stale-banner");
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("stale-report");
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("stale-video");
      expect(mockDb.rows("lotViewers")).toEqual([]);
      expect(mockDb.rows("engagementScores")).toEqual([]);

      // Tables listed for clearing end up repopulated by the seed itself.
      expect(mockDb.rows("equipmentCategories").length).toBeGreaterThan(0);
      expect(mockDb.rows("auctions").length).toBe(7);
      expect(mockDb.rows("lots").length).toBe(29);
    });

    it("seeds platform percentage fees as fractions within the fee validator range", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const fees = mockDb.rows("platformFees");
      const valueOf = (appliesTo: string) =>
        fees.find((f) => f.appliesTo === appliesTo)?.value;
      expect(valueOf("buyer")).toBe(0.12);
      expect(valueOf("seller")).toBe(0.05);
      for (const fee of fees) {
        expect(fee.value).toBeGreaterThan(0);
        expect(fee.value).toBeLessThanOrEqual(1);
      }
    });

    it("keeps the seeded buyer premium to one 12% rule: inactive fee row, auction-sourced lot snapshots", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const buyerRow = mockDb
        .rows("platformFees")
        .find((f) => f.appliesTo === "buyer");
      expect(buyerRow?.isActive).toBe(false);

      const saleLots = mockDb.rows("lots").filter((l) => l.auctionId);
      expect(saleLots.length).toBeGreaterThan(0);
      for (const lot of saleLots) {
        expect(lot.resolvedBuyerPremiumPct).toBe(0.12);
        expect(lot.premiumSource).toBe("auction");
      }
    });

    it("keeps the seeded seller commission to one 5% rule: inactive fee row, auction-sourced lot snapshots", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const sellerRow = mockDb
        .rows("platformFees")
        .find((f) => f.appliesTo === "seller");
      expect(sellerRow?.isActive).toBe(false);

      const saleLots = mockDb.rows("lots").filter((l) => l.auctionId);
      expect(saleLots.length).toBeGreaterThan(0);
      for (const lot of saleLots) {
        expect(lot.resolvedSellerCommissionPct).toBe(0.05);
        expect(lot.commissionSource).toBe("auction");
      }
    });

    it("snapshots each seeded lot's seller VAT status and type", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const profiles = mockDb.rows("profiles");
      const saleLots = mockDb.rows("lots").filter((l) => l.auctionId);
      for (const lot of saleLots) {
        const seller = profiles.find((p) => p.userId === lot.sellerId);
        expect(lot.sellerVatRegistered).toBe(seller?.vatRegistered);
        expect(lot.sellerType).toBe(seller?.sellerType);
      }
      expect(
        saleLots.some((l) => l.sellerVatRegistered === false && l.sellerType)
      ).toBe(true);
    });

    it("seeds lotFees at the real amount, rounded as settlement does", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const lots = mockDb.rows("lots");
      const ledger = mockDb.rows("lotFees");
      expect(ledger.length).toBeGreaterThan(0);
      for (const row of ledger) {
        const lot = lots.find((l) => l._id === row.lotId);
        const salePrice = lot?.currentPrice as number;
        expect(row.salePrice).toBe(salePrice);
        expect(row.calculatedAmount).toBe(
          Math.round(salePrice * (row.rate as number) * 100) / 100
        );
        // A 12% buyer premium on a sale in the hundreds of thousands of rand
        // is thousands, never the 100x-too-small value seeded previously.
        if (row.appliedTo === "buyer") {
          expect(row.calculatedAmount).toBeCloseTo(salePrice * 0.12, 2);
        }
      }
    });

    it("backfills only the missing VAT field on the primary seller and extra sellers", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      const { sellerId } = seedExistingProfiles();
      mockDb.db.patch("profiles", sellerId, {
        sellerType: "private",
      });
      mockDb.db.insert("profiles", {
        userId: "mock-seller-2",
        email: "mock-seller-2@farm.com",
        name: "Seller Two",
        role: "seller",
        vatRegistered: false,
        createdAt: 1,
        updatedAt: 1,
      });

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const profiles = mockDb.rows("profiles");
      const primary = profiles.find((p) => p._id === sellerId);
      // Admin-set seller type is kept; only the unset VAT flag is filled.
      expect(primary?.sellerType).toBe("private");
      expect(primary?.vatRegistered).toBe(true);
      const second = profiles.find((p) => p.userId === "mock-seller-2");
      // The existing VAT flag is kept; only the unset seller type is filled.
      expect(second?.vatRegistered).toBe(false);
      expect(second?.sellerType).toBeDefined();
    });

    it("promotes synced profiles that have the wrong role", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockDb.db.insert("profiles", {
        userId: "clerk-mock-seller",
        email: "mock-seller@farm.com",
        name: "Farm Seller",
        role: "buyer",
        isVerified: false,
        createdAt: 1,
        updatedAt: 1,
      });
      mockDb.db.insert("profiles", {
        userId: "clerk-admin-user",
        email: "admin@agribid.com",
        name: "Showcase Admin",
        role: "seller",
        isVerified: false,
        createdAt: 1,
        updatedAt: 1,
      });

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const seller = mockDb
        .rows("profiles")
        .find((p) => p.email === "mock-seller@farm.com");
      const admin = mockDb
        .rows("profiles")
        .find((p) => p.email === "admin@agribid.com");
      expect(seller?.role).toBe("seller");
      expect(seller?.isVerified).toBe(true);
      expect(admin?.role).toBe("admin");
      expect(admin?.isVerified).toBe(true);
    });
  });

  describe("weeklyReset", () => {
    it("deletes non-admin profiles but preserves admin profiles", async () => {
      const { adminId } = seedExistingProfiles();

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      const profiles = mockDb.rows("profiles");
      expect(profiles.some((p) => p._id === adminId)).toBe(true);
      expect(profiles.some((p) => p.userId === "clerk-real-buyer")).toBe(false);
      expect(profiles.some((p) => p.userId === "clerk-mock-seller")).toBe(
        false
      );

      // A synthetic mock seller replaces the deleted Clerk-synced one so
      // performSeed's lookup keeps succeeding across weekly resets.
      expect(
        profiles.some(
          (p) =>
            p.userId === "mock-seller" && p.email === "mock-seller@farm.com"
        )
      ).toBe(true);
    });

    it("clears lot viewer dedupe rows and per-lot view counters", async () => {
      seedExistingProfiles();
      mockDb.db.insert("lotViewers", {
        lotId: "gone",
        viewerKey: "u:someone",
        lastViewedAt: 1,
      });

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      expect(mockDb.rows("lotViewers")).toEqual([]);
    });

    it("clears stale engagement scores and every lot-scoped counter", async () => {
      seedExistingProfiles();
      insertStaleEngagementData();

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      expectStaleEngagementDataGone();
    });

    it("sweeps KYC document blobs when deleting non-admin profiles", async () => {
      seedExistingProfiles();

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      // The buyer's KYC document blobs are removed from storage before the
      // profile rows are deleted so they don't orphan.
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("kyc-blob-1");
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("kyc-blob-2");
    });

    it("repopulates the database after clearing all mock data", async () => {
      seedExistingProfiles();

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      expect(mockDb.rows("auctions").length).toBe(7);
      expect(mockDb.rows("lots").length).toBe(29);
      expect(mockDb.rows("bids").length).toBeGreaterThan(0);
      expect(mockDb.rows("proxy_bids").length).toBe(2);
      expect(mockDb.rows("reviews").length).toBe(3);
      expect(mockDb.rows("lotFees").length).toBe(6);
      expect(mockDb.rows("platformFees").length).toBe(2);
      expect(mockDb.rows("watchlist").length).toBe(11);
      expect(mockDb.rows("conversations").length).toBe(3);
      expect(mockDb.rows("messages").length).toBeGreaterThanOrEqual(9);
      expect(mockDb.rows("notifications").length).toBe(4);
      expect(mockDb.rows("supportTickets").length).toBe(3);
      expect(mockDb.rows("userActivity").length).toBeGreaterThan(0);
      expect(mockDb.rows("lotFlags").length).toBe(1);
      expect(mockDb.rows("profileFlags").length).toBe(1);
      expect(mockDb.rows("counters").length).toBeGreaterThan(0);

      const soldLots = mockDb.rows("lots").filter((l) => l.status === "sold");
      expect(soldLots.length).toBe(3);
      expect(
        soldLots.every(
          (l) =>
            typeof l.winnerId === "string" && typeof l.settledAt === "number"
        )
      ).toBe(true);

      const syntheticSellers = mockDb
        .rows("profiles")
        .filter(
          (p) => p.userId === "mock-seller-2" || p.userId === "mock-seller-3"
        );
      expect(syntheticSellers.length).toBe(2);
    });

    it("does not throw for an unauthenticated context and never consults the destructive-access guard", async () => {
      seedExistingProfiles();

      await expect(
        handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {})
      ).resolves.toBeNull();

      expect(vi.mocked(auth.getCallerRole)).not.toHaveBeenCalled();
    });

    it("is idempotent across consecutive resets", async () => {
      seedExistingProfiles();

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});
      const firstSnapshot = snapshotCounts();

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      expect(snapshotCounts()).toEqual(firstSnapshot);
    });
  });

  describe("destructive access control", () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
      vi.spyOn(console, "warn").mockImplementation(() => {
        // Intentional no-op: suppress seed script warnings during tests
      });
    });

    afterEach(() => {
      process.env = originalEnv;
      vi.restoreAllMocks();
    });

    describe("runSeed", () => {
      it("allows admin caller", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_SEED;
        vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

        seedExistingProfiles();

        await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("admin access path")
        );
        expect(vi.mocked(adminUtils.logAudit)).toHaveBeenCalled();
      });

      it("allows correct SEED_SECRET", async () => {
        process.env.NODE_ENV = "production";
        process.env.SEED_SECRET = "my-secret";
        delete process.env.ALLOW_DEV_SEED;
        vi.mocked(auth.getCallerRole).mockResolvedValue(null);

        seedExistingProfiles();

        await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {
          providedSeed: "my-secret",
        });

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("secret access path")
        );
      });

      it("allows dev with ALLOW_DEV_SEED=true", async () => {
        process.env.NODE_ENV = "development";
        process.env.ALLOW_DEV_SEED = "true";
        delete process.env.SEED_SECRET;
        vi.mocked(auth.getCallerRole).mockResolvedValue(null);

        seedExistingProfiles();

        await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("dev access path")
        );
      });

      it("denies unauthenticated in production", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_SEED;
        delete process.env.SEED_SECRET;
        vi.mocked(auth.getCallerRole).mockResolvedValue(null);

        await expect(
          handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {})
        ).rejects.toThrow("Unauthorized:");
      });

      it("denies non-admin without secret", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_SEED;
        delete process.env.SEED_SECRET;
        vi.mocked(auth.getCallerRole).mockResolvedValue("buyer");

        await expect(
          handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {})
        ).rejects.toThrow("Unauthorized:");
      });

      it("denies wrong SEED_SECRET", async () => {
        process.env.NODE_ENV = "production";
        process.env.SEED_SECRET = "correct-secret";
        delete process.env.ALLOW_DEV_SEED;
        vi.mocked(auth.getCallerRole).mockResolvedValue(null);

        await expect(
          handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {
            providedSeed: "wrong-secret",
          })
        ).rejects.toThrow("Unauthorized:");
      });

      it("denies dev without ALLOW_DEV_SEED opt-in", async () => {
        process.env.NODE_ENV = "development";
        delete process.env.ALLOW_DEV_SEED;
        delete process.env.SEED_SECRET;
        vi.mocked(auth.getCallerRole).mockResolvedValue(null);

        await expect(
          handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {})
        ).rejects.toThrow("Unauthorized:");
      });
    });

    describe("clearAuctions", () => {
      it("allows admin and logs audit", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_SEED;
        vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

        await handlerOf(clearAuctions)(mockCtx as unknown as MutationCtx, {});

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("admin access path")
        );
        expect(vi.mocked(adminUtils.logAudit)).toHaveBeenCalled();
      });

      it("clears lot viewer rows and view counters with the lots", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_SEED;
        vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
        mockDb.db.insert("lotViewers", {
          lotId: "gone",
          viewerKey: "s:abcdefgh",
          lastViewedAt: 1,
        });
        mockDb.db.insert("counters", { name: "views:gone", total: 3 });
        mockDb.db.insert("counters", { name: "anonviews:gone:1", total: 3 });

        await handlerOf(clearAuctions)(mockCtx as unknown as MutationCtx, {});

        expect(mockDb.rows("lotViewers")).toEqual([]);
        expect(mockDb.rows("counters")).toEqual([]);
      });

      it("clears bid counters and engagement scores with the lots", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_SEED;
        vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
        insertStaleEngagementData();

        await handlerOf(clearAuctions)(mockCtx as unknown as MutationCtx, {});

        expect(mockDb.rows("counters")).toEqual([]);
        expectStaleEngagementDataGone();
      });

      it("denies non-admin", async () => {
        process.env.NODE_ENV = "development";
        delete process.env.ALLOW_DEV_SEED;
        vi.mocked(auth.getCallerRole).mockResolvedValue("buyer");

        await expect(
          handlerOf(clearAuctions)(mockCtx as unknown as MutationCtx, {})
        ).rejects.toThrow("Unauthorized:");
      });

      it("allows dev with ALLOW_DEV_SEED=true", async () => {
        process.env.NODE_ENV = "development";
        process.env.ALLOW_DEV_SEED = "true";
        vi.mocked(auth.getCallerRole).mockResolvedValue(null);

        await handlerOf(clearAuctions)(mockCtx as unknown as MutationCtx, {});

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("dev access path")
        );
      });
    });

    describe("clearAllData", () => {
      it("allows admin and logs audit", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_SEED;
        vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

        await handlerOf(clearAllData)(mockCtx as unknown as MutationCtx, {});

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("admin access path")
        );
        expect(vi.mocked(adminUtils.logAudit)).toHaveBeenCalled();
      });

      it("denies unauthenticated in production", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_SEED;
        vi.mocked(auth.getCallerRole).mockResolvedValue(null);

        await expect(
          handlerOf(clearAllData)(mockCtx as unknown as MutationCtx, {})
        ).rejects.toThrow("Unauthorized:");
      });

      it("clears profiles and their KYC blobs via the dev access path", async () => {
        process.env.NODE_ENV = "development";
        process.env.ALLOW_DEV_SEED = "true";
        delete process.env.SEED_SECRET;
        vi.mocked(auth.getCallerRole).mockResolvedValue(null);
        seedExistingProfiles();
        mockDb.db.insert("lotViewers", {
          lotId: "gone",
          viewerKey: "u:someone",
          lastViewedAt: 1,
        });

        const deleted = await handlerOf(clearAllData)(
          mockCtx as unknown as MutationCtx,
          {}
        );

        expect(typeof deleted).toBe("number");
        expect(mockDb.rows("lotViewers")).toEqual([]);
        expect(mockDb.rows("engagementScores")).toEqual([]);
        expect(mockDb.rows("profiles").length).toBe(0);
        expect(mockDb.rows("auctions").length).toBe(0);
        expect(mockDb.rows("lots").length).toBe(0);
        expect(mockCtx.storage.delete).toHaveBeenCalledWith("kyc-blob-1");
        expect(vi.mocked(adminUtils.logAudit)).not.toHaveBeenCalled();
      });
    });

    describe("role re-check after access validation", () => {
      it("skips the runSeed audit entry when the role check downgrades", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_SEED;
        delete process.env.SEED_SECRET;
        vi.mocked(auth.getCallerRole)
          .mockResolvedValueOnce("admin")
          .mockResolvedValueOnce("buyer");
        seedExistingProfiles();

        await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

        expect(vi.mocked(adminUtils.logAudit)).not.toHaveBeenCalled();
      });

      it("skips the clearAuctions audit entry when the role check downgrades", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_SEED;
        delete process.env.SEED_SECRET;
        vi.mocked(auth.getCallerRole)
          .mockResolvedValueOnce("admin")
          .mockResolvedValueOnce("buyer");

        await handlerOf(clearAuctions)(mockCtx as unknown as MutationCtx, {});

        expect(vi.mocked(adminUtils.logAudit)).not.toHaveBeenCalled();
      });

      it("skips the clearAllData audit entry when the role check downgrades", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEV_SEED;
        delete process.env.SEED_SECRET;
        vi.mocked(auth.getCallerRole)
          .mockResolvedValueOnce("admin")
          .mockResolvedValueOnce("buyer");

        await handlerOf(clearAllData)(mockCtx as unknown as MutationCtx, {});

        expect(vi.mocked(adminUtils.logAudit)).not.toHaveBeenCalled();
      });
    });
  });
});
