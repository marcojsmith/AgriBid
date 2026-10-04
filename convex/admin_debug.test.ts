import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { promoteToAdmin } from "./admin_debug";
import * as auth from "./lib/auth";
import * as adminUtils from "./admin_utils";
import type { MutationCtx } from "./_generated/server";

vi.mock("./_generated/server", () => ({
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
      unique: vi.fn(() => rowsOf(table).find(matches) ?? null),
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
  };

  return {
    db,
    rows: (table: string): MockRow[] => rowsOf(table),
  };
}

type MockDb = ReturnType<typeof createMockDb>;
interface MockCtx {
  db: MockDb["db"];
}

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

describe("promoteToAdmin", () => {
  let mockDb: MockDb;
  let mockCtx: MockCtx;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    vi.spyOn(console, "log").mockImplementation(() => {
      // Intentional no-op: suppress admin_debug logging during tests
    });
    vi.spyOn(console, "warn").mockImplementation(() => {
      // Intentional no-op: suppress admin_debug warnings during tests
    });
    mockDb = createMockDb();
    mockCtx = { db: mockDb.db };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("deny paths", () => {
    it("throws when flag is unset and caller is not admin", async () => {
      process.env.NODE_ENV = "development";
      delete process.env.ALLOW_DEV_ADMIN_PROMOTION;
      vi.mocked(auth.getCallerRole).mockResolvedValue("buyer");

      await expect(
        handlerOf(promoteToAdmin)(mockCtx as unknown as MutationCtx, {
          email: "test@example.com",
        })
      ).rejects.toThrow("Unauthorized: Only admins can promote users");
    });

    it("throws when flag is false and caller is not admin", async () => {
      process.env.NODE_ENV = "development";
      process.env.ALLOW_DEV_ADMIN_PROMOTION = "false";
      vi.mocked(auth.getCallerRole).mockResolvedValue(null);

      await expect(
        handlerOf(promoteToAdmin)(mockCtx as unknown as MutationCtx, {
          email: "test@example.com",
        })
      ).rejects.toThrow("Unauthorized: Only admins can promote users");
    });
  });

  describe("allow paths", () => {
    it("allows admin caller to promote without flag", async () => {
      process.env.NODE_ENV = "development";
      delete process.env.ALLOW_DEV_ADMIN_PROMOTION;
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

      mockDb.db.insert("profiles", {
        userId: "user-456",
        email: "promote-me@example.com",
        role: "buyer",
      });

      const result = await handlerOf(promoteToAdmin)(
        mockCtx as unknown as MutationCtx,
        { email: "promote-me@example.com" }
      );

      expect(result).toEqual({ success: true, userId: "user-456" });
      expect(vi.mocked(adminUtils.logAudit)).toHaveBeenCalled();
    });

    it("allows promotion via flag in development", async () => {
      process.env.NODE_ENV = "development";
      process.env.ALLOW_DEV_ADMIN_PROMOTION = "true";
      vi.mocked(auth.getCallerRole).mockResolvedValue(null);

      mockDb.db.insert("profiles", {
        userId: "user-789",
        email: "flag-promote@example.com",
        role: "seller",
      });

      const result = await handlerOf(promoteToAdmin)(
        mockCtx as unknown as MutationCtx,
        { email: "flag-promote@example.com" }
      );

      expect(result).toEqual({ success: true, userId: "user-789" });
      expect(vi.mocked(adminUtils.logAudit)).toHaveBeenCalled();
    });

    it("validates email format when access is allowed", async () => {
      process.env.NODE_ENV = "development";
      process.env.ALLOW_DEV_ADMIN_PROMOTION = "true";
      vi.mocked(auth.getCallerRole).mockResolvedValue(null);

      await expect(
        handlerOf(promoteToAdmin)(mockCtx as unknown as MutationCtx, {
          email: "not-an-email",
        })
      ).rejects.toThrow("Invalid email format");
    });

    it("throws when user not found when access is allowed", async () => {
      process.env.NODE_ENV = "development";
      process.env.ALLOW_DEV_ADMIN_PROMOTION = "true";
      vi.mocked(auth.getCallerRole).mockResolvedValue(null);

      await expect(
        handlerOf(promoteToAdmin)(mockCtx as unknown as MutationCtx, {
          email: "missing@example.com",
        })
      ).rejects.toThrow("User not found");
    });
  });
});
