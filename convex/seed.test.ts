import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { runSeed, weeklyReset, clearAuctions, clearAllData } from "./seed";
import * as auth from "./lib/auth";
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
  scheduler: { runAfter: ReturnType<typeof vi.fn> };
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
    mockCtx = {
      db: mockDb.db,
      storage: { delete: vi.fn() },
      scheduler: { runAfter: vi.fn() },
    };
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

      // The old US demo lots and sales are retired: the catalogue comes from
      // the webuytractors.shop import, not the seed.
      expect(mockDb.rows("auctions").length).toBe(0);
      expect(mockDb.rows("lots").length).toBe(0);
      expect(mockDb.rows("bids").length).toBe(0);
      expect(mockDb.rows("platformFees").length).toBe(2);

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
      expect(mockDb.rows("auctions").length).toBe(0);
      expect(mockDb.rows("lots").length).toBe(0);
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

    it("keeps the seeded fee rows inactive so the auction snapshots are the one premium and commission", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      seedExistingProfiles();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      const fees = mockDb.rows("platformFees");
      expect(fees.find((f) => f.appliesTo === "buyer")?.isActive).toBe(false);
      expect(fees.find((f) => f.appliesTo === "seller")?.isActive).toBe(false);
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
    /**
     * Inserts an imported sale with one lot, as the import script would.
     * @param role - The sale's timeline role
     * @param order - Its closed order
     * @returns The auction id
     */
    function insertImportedSale(
      role: "live" | "upcoming" | "closed",
      order: number
    ) {
      const auctionId = mockDb.db.insert("auctions", {
        title: `Imported ${role}`,
        seedId: `wbt:auction:${role}${order.toString()}`,
        demoRole: role,
        demoOrder: order,
        startTime: 1,
        endTime: 2,
        status: "closed",
      });
      mockDb.db.insert("lots", {
        title: `${role} lot`,
        seedId: `wbt:lot:${role}${order.toString()}`,
        auctionId,
        lotNumber: 1,
        status: "assigned",
      });
      return auctionId;
    }

    it("never deletes profiles, lots or auctions (production safe)", async () => {
      const { adminId, buyerId } = seedExistingProfiles();
      const importedId = insertImportedSale("live", 0);
      const userLot = mockDb.db.insert("lots", {
        title: "A real user's lot",
        status: "assigned",
        images: { additional: ["user-photo"] },
      });
      const userSale = mockDb.db.insert("auctions", {
        title: "A real sale",
        status: "published",
        bannerImage: "banner",
      });

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      const profiles = mockDb.rows("profiles");
      expect(profiles.some((p) => p._id === adminId)).toBe(true);
      expect(profiles.some((p) => p._id === buyerId)).toBe(true);
      expect(mockDb.rows("lots").some((l) => l._id === userLot)).toBe(true);
      expect(mockDb.rows("auctions").map((a) => a._id)).toEqual(
        expect.arrayContaining([importedId, userSale])
      );
      expect(mockCtx.storage.delete).not.toHaveBeenCalled();
    });

    it("recreates the synthetic mock seller only when it is missing", async () => {
      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {}).catch(
        () => undefined
      );
      expect(
        mockDb
          .rows("profiles")
          .some(
            (p) =>
              p.userId === "mock-seller" && p.email === "mock-seller@farm.com"
          )
      ).toBe(true);
    });

    it("schedules a re-time for each imported sale only", async () => {
      seedExistingProfiles();
      const live = insertImportedSale("live", 0);
      const closed = insertImportedSale("closed", 2);
      mockDb.db.insert("auctions", {
        title: "Not imported",
        status: "published",
      });

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      const calls = mockCtx.scheduler.runAfter.mock.calls as [
        number,
        unknown,
        { auctionId: string; role: string; status: string; endTime: number },
      ][];
      expect(calls).toHaveLength(2);
      const byId = new Map(calls.map(([, , args]) => [args.auctionId, args]));
      expect(byId.get(live)).toMatchObject({
        role: "live",
        status: "published",
      });
      expect(byId.get(live)?.endTime).toBeGreaterThan(Date.now());
      expect(byId.get(closed)).toMatchObject({
        role: "closed",
        status: "closed",
      });
      expect(byId.get(closed)?.endTime).toBeLessThan(Date.now());
    });

    it("skips imported sales that have no timeline role", async () => {
      seedExistingProfiles();
      mockDb.db.insert("auctions", {
        title: "Odd",
        seedId: "wbt:auction:odd",
        status: "published",
      });

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
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
