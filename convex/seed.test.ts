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
    const matches = (row: MockRow) =>
      constraints.every(([field, value]) => Reflect.get(row, field) === value);

    const builder = {
      withIndex: vi.fn(
        (_indexName: string, cb?: (q: MockIndexFilter) => void) => {
          constraints = [];
          if (cb) {
            const filter: MockIndexFilter = {
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
      expect(mockDb.rows("lots").length).toBe(22);
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
      });

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {
        clear: true,
      });

      // Storage blobs referenced by the cleared rows are swept first.
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("stale-banner");
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("stale-report");

      // Tables listed for clearing end up repopulated by the seed itself.
      expect(mockDb.rows("equipmentCategories").length).toBeGreaterThan(0);
      expect(mockDb.rows("auctions").length).toBe(7);
      expect(mockDb.rows("lots").length).toBe(22);
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
      expect(mockDb.rows("lots").length).toBe(22);
      expect(mockDb.rows("bids").length).toBeGreaterThan(0);
      expect(mockDb.rows("proxy_bids").length).toBe(2);
      expect(mockDb.rows("reviews").length).toBe(3);
      expect(mockDb.rows("lotFees").length).toBe(6);
      expect(mockDb.rows("platformFees").length).toBe(2);
      expect(mockDb.rows("watchlist").length).toBe(6);
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

        const deleted = await handlerOf(clearAllData)(
          mockCtx as unknown as MutationCtx,
          {}
        );

        expect(typeof deleted).toBe("number");
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
