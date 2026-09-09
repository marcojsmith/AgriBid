import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { runSeed, weeklyReset } from "./seed";
import * as auth from "./lib/auth";
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

type MockRow = { _id: string } & Record<string, unknown>;

type MockIndexFilter = {
  eq: (field: string, value: unknown) => MockIndexFilter;
};

type MockQueryFilter = {
  field: (name: string) => { __mockField: string };
  eq: (left: unknown, right: unknown) => void;
};

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
    let constraints: Array<[string, unknown]> = [];
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
    patch: vi.fn((id: string, patch: Record<string, unknown>) => {
      for (const rows of tables.values()) {
        const row = rows.find((r) => r._id === id);
        if (row) {
          Object.assign(row, patch);
          return;
        }
      }
    }),
    delete: vi.fn((id: string) => {
      for (const rows of tables.values()) {
        const index = rows.findIndex((r) => r._id === id);
        if (index !== -1) {
          rows.splice(index, 1);
          return;
        }
      }
    }),
    get: vi.fn((id: string) => {
      for (const rows of tables.values()) {
        const row = rows.find((r) => r._id === id);
        if (row) return row;
      }
      return null;
    }),
  };

  return {
    db,
    rows: (table: string): MockRow[] => rowsOf(table),
  };
}

type MockDb = ReturnType<typeof createMockDb>;
type MockCtx = { db: MockDb["db"] };

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
    vi.spyOn(console, "log").mockImplementation(() => {});
    mockDb = createMockDb();
    mockCtx = { db: mockDb.db };
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
      "bids",
      "proxy_bids",
      "profiles",
      "reviews",
      "conversations",
      "messages",
      "notifications",
      "supportTickets",
      "userActivity",
      "auctionFees",
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

      expect(mockDb.rows("auctions").length).toBe(0);
    });

    it("seeds the full showcase via the Clerk-synced mock seller", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      const { adminId } = seedExistingProfiles();

      await handlerOf(runSeed)(mockCtx as unknown as MutationCtx, {});

      expect(mockDb.rows("auctions").length).toBe(20);
      expect(mockDb.rows("bids").length).toBeGreaterThan(0);
      expect(mockDb.rows("reviews").length).toBe(3);
      expect(mockDb.rows("platformFees").length).toBe(2);
      expect(mockDb.rows("auctionFees").length).toBe(6);

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

    it("repopulates the database after clearing all mock data", async () => {
      seedExistingProfiles();

      await handlerOf(weeklyReset)(mockCtx as unknown as MutationCtx, {});

      expect(mockDb.rows("auctions").length).toBe(20);
      expect(mockDb.rows("bids").length).toBeGreaterThan(0);
      expect(mockDb.rows("proxy_bids").length).toBe(2);
      expect(mockDb.rows("reviews").length).toBe(3);
      expect(mockDb.rows("auctionFees").length).toBe(6);
      expect(mockDb.rows("platformFees").length).toBe(2);
      expect(mockDb.rows("watchlist").length).toBe(6);
      expect(mockDb.rows("conversations").length).toBe(3);
      expect(mockDb.rows("messages").length).toBeGreaterThanOrEqual(9);
      expect(mockDb.rows("notifications").length).toBe(4);
      expect(mockDb.rows("supportTickets").length).toBe(3);
      expect(mockDb.rows("userActivity").length).toBeGreaterThan(0);
      expect(mockDb.rows("auctionFlags").length).toBe(1);
      expect(mockDb.rows("profileFlags").length).toBe(1);
      expect(mockDb.rows("counters").length).toBeGreaterThan(0);

      const soldAuctions = mockDb
        .rows("auctions")
        .filter((a) => a.status === "sold");
      expect(soldAuctions.length).toBe(3);
      expect(
        soldAuctions.every(
          (a) =>
            typeof a.winnerId === "string" && typeof a.settledAt === "number"
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
});
